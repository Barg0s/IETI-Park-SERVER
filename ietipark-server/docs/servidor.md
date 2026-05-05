# 📖 Documentació Tècnica del Servidor — IETI Park

> **IETI Park** és un joc cooperatiu multijugador en temps real. Aquest document descriu en detall l'arquitectura del servidor, el protocol de comunicació WebSocket, el sistema de físiques del joc i la integració amb MongoDB.

---

## Taula de continguts

1. [Arquitectura general](#1-arquitectura-general)
2. [Tecnologies utilitzades](#2-tecnologies-utilitzades)
3. [Estructura de fitxers](#3-estructura-de-fitxers)
4. [Arrencada del servidor](#4-arrencada-del-servidor)
5. [Protocol WebSocket — Missatges client → servidor](#5-protocol-websocket--missatges-client--servidor)
6. [Protocol WebSocket — Missatges servidor → client](#6-protocol-websocket--missatges-servidor--client)
7. [El Game State (JSON en temps real)](#7-el-game-state-json-en-temps-real)
8. [Configuració dels nivells](#8-configuració-dels-nivells)
9. [Motor de físiques (GameRoom.js)](#9-motor-de-físiques-gamerooomjs)
10. [Mecàniques de joc cooperatiu](#10-mecàniques-de-joc-cooperatiu)
11. [Integració amb MongoDB](#11-integració-amb-mongodb)
12. [Esquemes MongoDB](#12-esquemes-mongodb)
13. [Variables d'entorn](#13-variables-dentorn)
14. [Desplegament a Proxmox](#14-desplegament-a-proxmox)

---

## 1. Arquitectura general

El servidor segueix una arquitectura **event-driven** basada en WebSockets natius. No hi ha sessions HTTP persistents per al joc — tota la comunicació del gameplay passa per un canal WebSocket de baixa latència.

```
┌───────────────────────────────────────────────────────────┐
│                  Clients (APP / Web)                      │
│   LibGDX (Android)          Flutter (Web)                 │
└─────────────┬───────────────────────────┬─────────────────┘
              │ ws://                     │ ws://
              ▼                           ▼
┌─────────────────────────────────────────────────────────┐
│              Node.js HTTP Server (index.js)              │
│                                                         │
│  ┌──────────────────┐   ┌───────────────────────────┐  │
│  │  Express (app.js) │   │  WebSocket Server (ws)    │  │
│  │  · CORS headers   │   │  · socket/index.js        │  │
│  │  · Health check   │   │  · playerHandler.js       │  │
│  └──────────────────┘   │  · gameHandler.js         │  │
│                          └──────────┬────────────────┘  │
│                                     │                    │
│                          ┌──────────▼────────────────┐  │
│                          │  GameRoom.js               │  │
│                          │  · Game Loop (60 ticks/s)  │  │
│                          │  · Motor de físiques       │  │
│                          │  · Gestió de jugadors      │  │
│                          │  · Lògica de nivells       │  │
│                          └──────────┬────────────────┘  │
│                                     │                    │
│                          ┌──────────▼────────────────┐  │
│                          │  gameService.js            │  │
│                          │  · guardarPartida()        │  │
│                          └──────────┬────────────────┘  │
│                                     │                    │
│                          ┌──────────▼────────────────┐  │
│                          │  MongoDB                   │  │
│                          │  · partidas                │  │
│                          │  · jugadors                │  │
│                          │  · records                 │  │
│                          │  · nivells                 │  │
│                          └───────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

El punt clau del disseny és que el servidor és **l'única font de veritat** (*single source of truth*). Les apps client no calculen res de física ni col·lisió — simplement envien l'input de l'usuari i dibuixen l'estat que rep del servidor.

---

## 2. Tecnologies utilitzades

| Tecnologia | Versió | Propòsit |
|---|---|---|
| **Node.js** | ≥ 18 | Entorn d'execució del servidor |
| **Express** | ^4.x | Servidor HTTP, CORS, health-check |
| **ws** | ^8.x | WebSockets natius (baixa latència) |
| **Mongoose** | ^8.x | ODM per a MongoDB |
| **MongoDB** | ^6.x | Base de dades de persistència |
| **uuid** | ^9.x | Generació d'IDs únics per connexió |
| **dotenv** | ^16.x | Gestió de variables d'entorn |

---

## 3. Estructura de fitxers

```
ietipark-server/
│
├── index.js                  # Punt d'entrada: HTTP + WebSocket + MongoDB
├── .env                      # Variables d'entorn (no versionat)
├── package.json
│
├── src/
│   ├── app.js                # Configuració Express (CORS, rutas estàtiques)
│   │
│   ├── config/
│   │   └── db.js             # Connexió a MongoDB (no bloquejant)
│   │
│   ├── game/
│   │   └── GameRoom.js       # ⭐ Nucli del joc: físiques, nivells, jugadors
│   │
│   ├── models/
│   │   ├── Jugador.js        # Esquema MongoDB: estadístiques de jugador
│   │   ├── Partida.js        # Esquema MongoDB: registre de partida
│   │   ├── Record.js         # Esquema MongoDB: millors temps (rànquing)
│   │   └── Nivel.js          # Esquema MongoDB: metadades dels nivells
│   │
│   ├── services/
│   │   └── gameService.js    # Lògica de persistència: guardarPartida()
│   │
│   └── socket/
│       ├── index.js          # Inicialitzador WebSocket Server
│       └── handlers/
│           ├── playerHandler.js  # join, input, disconnect
│           └── gameHandler.js    # Game loop broadcast + events MongoDB
│
└── docs/
    └── servidor.md           # Aquest document
```

---

## 4. Arrencada del servidor

### Seqüència d'inici

Quan s'executa `npm start` (o `node index.js`), passen les coses següents en ordre:

1. **`dotenv`** carrega el fitxer `.env` i exposa `process.env.MONGODB_URI` i `process.env.PORT`.
2. **`connectDB()`** intenta connectar-se a MongoDB de forma **no bloquejant**. Si falla, el servidor continua funcionant en mode memòria (el joc funciona, però no es guarden estadístiques).
3. **Express** configura les capçaleres CORS per permetre connexions des de Flutter Web.
4. **`http.createServer(app)`** crea el servidor HTTP sobre Express.
5. **`initSocket(server)`** adjunta el servidor WebSocket al mateix port HTTP. Quan arrenca, crea la instància global de `GameRoom`, la qual inicia el **game loop intern** automàticament.
6. El servidor escolta al port configurat (per defecte `3000`).

### Logs d'arrencada correcta

```
[DD/MM/AAAA, HH:MM:SS] [DB] MongoDB database connected successfully
[DD/MM/AAAA, HH:MM:SS] [SERVER] IETI Park game server running on port 3000
```

---

## 5. Protocol WebSocket — Missatges client → servidor

Tots els missatges segueixen el format JSON:

```json
{
  "type": "tipus_de_missatge",
  "data": { ... }
}
```

### `player:join`
El client l'envia quan un usuari vol unir-se a la partida.

```json
{
  "type": "player:join",
  "data": {
    "nickname": "OwletKing"
  }
}
```

| Camp | Tipus | Descripció |
|---|---|---|
| `nickname` | `String` | Nom d'usuari que es mostrarà en pantalla |

**Resposta del servidor:** El servidor assigna un color únic al jugador i respon amb `game:start` (unicast) i `room:update` (broadcast).

---

### `player:input`
El client l'envia contínuament mentre l'usuari prem botons del Dpad.

```json
{
  "type": "player:input",
  "data": {
    "direction": "right"
  }
}
```

| Valor de `direction` | Acció |
|---|---|
| `"left"` | Moure's cap a l'esquerra |
| `"right"` | Moure's cap a la dreta |
| `"up"` o `"jump"` | Saltar (si el jugador és a terra) |
| `"none"` | Aturar el moviment |

> **Nota important:** El client envia `"none"` quan l'usuari deixa anar el botó. Si el servidor no rep res, el jugador es queda quiet per seguretat (no hi ha inputs pendents).

---

## 6. Protocol WebSocket — Missatges servidor → client

### `game:start` *(unicast — només al jugador que s'uneix)*

```json
{
  "type": "game:start",
  "data": {
    "id": "uuid-del-jugador",
    "nickname": "OwletKing",
    "color": "azul",
    "players": [ ... ]
  }
}
```

El jugador ha de guardar el seu `id` per saber quins jugadors de l'array `players` és ell.

---

### `game:state` *(broadcast — a tots, ~60 vegades per segon)*

És el missatge més important. El servidor l'envia contínuament amb l'estat complet del món de joc. Veure la [secció 7](#7-el-game-state-json-en-temps-real) per al format complet.

---

### `room:update` *(broadcast)*

S'envia quan un jugador entra o surt de la sala.

```json
{
  "type": "room:update",
  "data": {
    "players": [ { "id": "...", "nickname": "...", "color": "..." } ]
  }
}
```

---

### `game:level_complete` *(broadcast)*

S'envia quan tots els jugadors han creuat la porta del **Nivell 1**.

```json
{
  "type": "game:level_complete",
  "data": {
    "level": 1,
    "nextLevel": 2
  }
}
```

En rebre aquest missatge, els clients han de carregar els recursos visuals del Nivell 2.

---

### `game:level_change` *(broadcast)*

S'envia immediatament quan el servidor canvia de nivell internament.

```json
{
  "type": "game:level_change",
  "data": {
    "level": 2
  }
}
```

---

### `game:victory` *(broadcast)*

S'envia quan tots els jugadors han creuat la porta del **Nivell 2** (final del joc).

```json
{
  "type": "game:victory",
  "data": {
    "message": "Tots els jugadors han completat el joc!"
  }
}
```

En rebre aquest missatge, els clients mostren la pantalla de victòria.

---

### `game:door_open` *(broadcast)*

S'envia quan un jugador porta la clau fins a la porta i la porta s'obre.

```json
{
  "type": "game:door_open",
  "data": {
    "openedBy": "OwletKing"
  }
}
```

---

### `room:full` *(unicast — error)*

Si la sala ja té 8 jugadors, el servidor tanca la connexió del nou intent.

```json
{
  "type": "room:full",
  "data": {
    "message": "Room is full (max 8 players)"
  }
}
```

---

## 7. El Game State (JSON en temps real)

Aquest és el JSON complet que el servidor envia com a `game:state` a cada tick:

```json
{
  "type": "game:state",
  "data": {
    "currentLevel": 1,
    "players": [
      {
        "id": "550e8400-e29b-...",
        "nickname": "OwletKing",
        "color": "azul",
        "x": 128.0,
        "y": 160.0,
        "vx": 120.0,
        "vy": 0.0,
        "onGround": true,
        "inputs": { "left": false, "right": true, "jump": false },
        "crossedDoor": false
      }
    ],
    "door": {
      "x": 288,
      "y": 160,
      "width": 32,
      "height": 160,
      "isOpen": false
    },
    "key": {
      "x": 216,
      "y": 340,
      "width": 21,
      "height": 47,
      "state": "floor",
      "carriedBy": null,
      "carriedByNickname": null
    },
    "obstacle": {
      "x": 285,
      "y": 160,
      "width": 20,
      "height": 33
    },
    "platform": null,
    "precipice": null,
    "button": null
  }
}
```

> **Optimització de xarxa:** El servidor compara el nou estat amb l'anterior (`JSON.stringify`). Si l'estat és idèntic, **no s'envia cap missatge**. Això redueix dràsticament el trànsit de xarxa en moments d'inactivitat.

### Camps del Game State

| Camp | Present al Nivell | Descripció |
|---|---|---|
| `currentLevel` | 1 i 2 | Nivell actual del servidor (1 o 2) |
| `players[]` | 1 i 2 | Llista de tots els jugadors connectats |
| `door` | 1 i 2 | Posició i estat de la porta (oberta/tancada) |
| `key` | 1 i 2 | Posició de la clau. Si `state='carried'`, `carriedByNickname` indica qui la porta |
| `obstacle` | 1 i 2 | El cadenat davant de la porta |
| `platform` | Només Nivell 2 | La plataforma mòbil. `moving: true` quan el botó ha estat pressionat |
| `precipice` | Només Nivell 2 | Les coordenades del precipici (per evitar que els clients calculin la caiguda) |
| `button` | Només Nivell 2 | El botó d'activació de la plataforma. `pressed: true` un cop tocat |

---

## 8. Configuració dels nivells

Tota la configuració de la física dels nivells es troba centralitzada a l'objecte `levelConfigs` dins de `GameRoom.js`. Això permet modificar els nivells sense tocar la lògica de físiques.

### Nivell 1

```javascript
1: {
    groundY: 160,       // Alçada del terra (eix Y positiu cap amunt)
    worldWidth: 992,    // Amplada total del món en píxels (31 tiles × 32px)
    spawnX: 32,         // Posició X d'aparició dels jugadors
    spawnY: 160,        // Posició Y d'aparició (sobre el terra)
    precipice: null,    // Sense precipici
    platform: null,     // Sense plataforma mòbil
    door: { x: 288, y: 160, width: 32, height: 160, isOpen: false },
    key: { x: 216, y: 340, width: 21, height: 47, state: 'floor', carriedBy: null },
    obstacle: { x: 285, y: 160, width: 20, height: 33 }
}
```

**Mecànica de la clau (Nivell 1):** La clau es troba a `y=340`, però el terra és a `y=160`. Un jugador sol saltant arriba a una alçada màxima de cabeza de `~330px`, just per sota. Cal que **2 jugadors s'apilin** per arribar-hi.

### Nivell 2

```javascript
2: {
    groundY: 160,
    worldWidth: 992,
    spawnX: 32,
    spawnY: 160,
    // El precipici cobreix les columnes 10 a 20 del tilemap
    precipice: { x: 320, y: 0, width: 352, height: 160 },
    // Plataforma mòbil ("ferry") que oscil·la un cop activada
    platform: { x: 480, y: 192, width: 128, height: 32, moving: false,
                speed: 100, direction: 1, minX: 320, maxX: 544 },
    // Botó a l'altra banda del precipici
    button: { x: 680, y: 160, width: 32, height: 32, pressed: false },
    obstacle: { x: 893, y: 160, width: 20, height: 33 },
    // La clau requereix stacking per arribar-hi
    key: { x: 750, y: 340, width: 21, height: 47, state: 'floor', carriedBy: null },
    door: { x: 896, y: 160, width: 32, height: 160, isOpen: false }
}
```

---

## 9. Motor de físiques (GameRoom.js)

El motor de físiques s'executa dins del mètode `updatePhysics(delta)`, cridat pel game loop a cada tick.

### Sistema de coordenades

El servidor utilitza un **sistema de coordenades Y-positiu cap amunt** (com és habitual en física), igual que LibGDX. Els clients Flutter han d'invertir l'eix Y en dibuixar.

```
Y ↑
  |
  |
  +──────────────────────── X →
(0,0)
```

### Constants físiques

| Constant | Valor | Descripció |
|---|---|---|
| `P_SPEED` | 120 px/s | Velocitat horitzontal del jugador |
| `GRAVITY` | -400 px/s² | Acceleració de la gravetat (Y-up) |
| `JUMP_POWER` | 300 px/s | Velocitat inicial vertical en saltar |
| `PLAYER_W` | 32 px | Amplada de la hitbox del jugador |
| `PLAYER_H` | 58 px | Alçada de la hitbox del jugador* |

> *`PLAYER_H = 58px` en lloc de 64px és intencional. Permet que l'sprite visual sobresurti cap amunt, creant la sensació que quan t'apiles, et poses sobre el casc del company.

### Ordre de resolució de col·lisions per frame

Cada frame, per a cada jugador, el servidor resol les col·lisions en aquest ordre estricte:

1. **Aplicar inputs** (velocitat horitzontal i salt)
2. **Aplicar gravetat** (`vy += GRAVITY × delta`)
3. **Calcular posició provisional** (`nextX`, `nextY`)
4. **Col·lisió porta tancada** (separació d'eixos: primer X, després Y)
5. **Col·lisions precipici** (parets invisibles als costats del buit)
6. **Col·lisions entre jugadors** (apilament cooperatiu)
7. **Col·lisió plataforma mòbil** (one-way: només des de dalt)
8. **Col·lisió terra** (terra sòlid, detecta terra ferm vs. precipici)
9. **Aplicar posició final**
10. **Límits del món** (l'jugador no pot sortir dels extrems del mapa)
11. **Respawn** (si cau al precipici per sota de `y < -64`)
12. **Detectar botó** (Nivell 2)
13. **Recollir la clau** (si col·lideix amb ella)
14. **Obrir la porta** (si porta la clau i és a prop de la porta)
15. **Creuar la porta** (si la porta és oberta i el jugador passa per davant)

---

## 10. Mecàniques de joc cooperatiu

### Apilament de jugadors

Els jugadors actuen com a plataformes entre ells. Quan un jugador cau sobre un altre:
- El jugador de dalt queda a `y = y_altre + PLAYER_H`, com si estigués dret sobre ell.
- El jugador de dalt pot saltar des d'aquí, guanyant l'alçada extra de `PLAYER_H = 58px`.

Exemple de càlcul d'alçada màxima:

| Situació | Alçada de cap màxima |
|---|---|
| Jugador sol saltant | Terra (`160`) + `PLAYER_H` (`58`) + `JUMP_POWER²/(2×GRAVITY)` ≈ **330 px** |
| Jugador apilat saltant | `330 + 58` = **~388 px** |
| Posició de la clau | **340 px** ← entre les dues xifres → requereix apilament |

### Mecànica del precipici (Nivell 2)

El precipici (`x: 320` a `x: 672`) és un buit al terra. El servidor hi afegeix **parets invisibles laterals**: si un jugador està per sota del terra (`y < GROUND_Y`) i intenta anar cap als costats del precipici, és frenat. Això evita el *bug de teleportació* (caminar cap enrere quan ets a punt de caure per recuperar terra sòlid).

### Mecànica de la plataforma mòbil (Nivell 2)

1. La plataforma neix quieta al mig del precipici (`moving: false`).
2. Quan un jugador toca el botó (a l'altra banda), `moving` es posa a `true`.
3. La plataforma oscil·la entre `minX=320` i `maxX=544` a una velocitat de `100 px/s`.
4. La plataforma és **one-way**: només té col·lisió des de dalt. Un jugador pot saltar-hi des de baix sense bloquejar-se.
5. Els jugadors a sobre de la plataforma es mouen amb ella (la seva posició Y es manté a `platform.y + platform.height`).

---

## 11. Integració amb MongoDB

### Quan es guarda la informació

| Event | Acció a MongoDB |
|---|---|
| Tots els jugadors creuen la porta del **Nivell 1** | Es crea un document a `partides` (`victoria: false`). S'actualitzen les estadístiques de cada jugador a `jugadors`. |
| Tots els jugadors creuen la porta del **Nivell 2** | Es crea un document a `partides` (`victoria: true`). S'actualitzen estadístiques. Es creen documents a `records` per al rànquing. |

### Flux de persistència

```
_checkAllCrossed()  →  broadcastLevelEvent('game:victory', ...)
        ↓
gameHandler.js escolta l'event
        ↓
guardarPartida(room, nivell, victoria)  [gameService.js]
        ↓
Partida.create(...)        → Col·lecció 'partidas'
Jugador.findOneAndUpdate() → Col·lecció 'jugadors'  (upsert)
Record.create(...)         → Col·lecció 'records' (només si victoria=true)
```

### Tolerància a fallades

La connexió a MongoDB és **no bloquejant**. Si la base de dades no és disponible:
- El servidor continua funcionant normalment.
- S'escriu un `console.warn` amb el detall de l'error.
- El joc en memòria no es veu afectat.

---

## 12. Esquemes MongoDB

### Col·lecció: `partidas`

Registra cada partida jugada.

```javascript
{
  _id: ObjectId,
  data_inici: Date,           // Quan va entrar el primer jugador
  data_fi: Date,              // Quan es va superar el nivell
  duracio_segons: Number,     // Temps total de la partida
  nivell_completat: Number,   // 1 o 2
  victoria: Boolean,          // true si han guanyat (superat el nivell 2)
  jugadors_participants: [    // Qui ha jugat
    { nickname: String, color: String }
  ],
  createdAt: Date
}
```

**Exemple real:**
```json
{
  "_id": "69f8aed4392f...",
  "data_inici": "2026-05-04T14:35:50.000Z",
  "data_fi": "2026-05-04T14:36:04.950Z",
  "duracio_segons": 14,
  "nivell_completat": 2,
  "victoria": true,
  "jugadors_participants": [{ "nickname": "Jugador485722", "color": "azul" }]
}
```

---

### Col·lecció: `jugadors`

Acumula les estadístiques de cada jugador al llarg de totes les partides. Si el jugador no existeix, es crea (`upsert: true`).

```javascript
{
  _id: ObjectId,
  nickname: String,           // Únic (índex)
  color: String,              // Últim color assignat
  total_partides: Number,     // Incrementa +1 per cada partida
  millor_temps_segons: Number,// El temps mínim de totes les partides ($min)
  nivell_maxim_assolit: Number,// Màxim nivell completat ($max)
  createdAt: Date
}
```

---

### Col·lecció: `records`

Registra els millors temps per a cada nivell, accessible per al rànquing.

```javascript
{
  _id: ObjectId,
  nickname: String,
  nivell: Number,             // 1 o 2
  temps_segons: Number,
  jugadors_totals: Number,    // Amb quants jugadors es va fer el rècord
  data: Date
}
```

**Índex de rendiment:** La col·lecció té un índex compost `{ nivell: 1, temps_segons: 1 }` per obtenir ràpidament els millors temps d'un nivell ordenats.

---

### Col·lecció: `nivells`

Metadades descriptives de cada nivell (útil per a pantalles informatives o interfície d'administrador).

```javascript
{
  _id: ObjectId,
  num_nivell: Number,         // Únic
  nom: String,
  descripcio: String,
  mapa_amplada: Number,       // Amplada en píxels
  mapa_alcada: Number,        // Alçada en píxels
  te_precipici: Boolean,
  te_plataforma: Boolean,
  te_clau: Boolean,
  createdAt: Date
}
```

---

## 13. Variables d'entorn

El fitxer `.env` a l'arrel del projecte defineix:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/ietipark
```

| Variable | Valor per defecte | Descripció |
|---|---|---|
| `PORT` | `3000` | Port del servidor HTTP/WebSocket |
| `MONGODB_URI` | `mongodb://localhost:27017/ietipark` | URI de connexió a MongoDB |

> En producció (servidor Proxmox), `MONGODB_URI` apunta a la instància MongoDB del contenidor intern.

---

## 14. Desplegament a Proxmox

El servidor s'executa a una màquina virtual o contenidor LXC de **Proxmox** accessible a través de l'adreça:

```
ieticloudpro.ieti.cat  (port SSH: 20127)
```

### Accés SSH

```bash
ssh -p 20127 pico6@ieticloudpro.ieti.cat
```

### Gestió del procés

El servidor s'inicia com un procés de Node.js gestionat amb `pm2` o directament amb:

```bash
cd ietipark-server
npm start
```

### Comprovació de base de dades (MongoDB Shell)

```bash
# Connectar-se al MongoDB de la màquina
mongosh

# Seleccionar la base de dades
use ietipark

# Veure totes les partides guardades
db.partidas.find().pretty()

# Veure el rànquing del Nivell 2 (millors temps primer)
db.records.find({ nivell: 2 }).sort({ temps_segons: 1 }).limit(10)

# Veure estadístiques de jugadors
db.jugadors.find().sort({ millor_temps_segons: 1 }).pretty()
```

---

*Documentació generada per al projecte IETI Park — DAM/DAW IETI Barcelona.*
