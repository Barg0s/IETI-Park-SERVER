# IETI Park — Canvis del Sprint 1 (Explicació completa)

Aquest document explica **tots els canvis realitzats** als tres repositoris durant el Sprint 1, per a qui vulgui entendre el codi sense llegir-lo tot.

---

## Resum de tasques completades

| Activitat | Que s'ha fet |
|-----------|-------------|
| **#3** Servidor — Sala i connexions | Límit de 8 jugadors afegit. El servidor ara envia l'estat de la sala a qualsevol client que es connecti, fins i tot abans de fer join. |
| **#4** App — Menú principal | `FirstScreen` es connecta al servidor com a observador i mostra en temps real qui hi ha a la sala. |
| **#5** App — GameScreen | `GameScreen` completament reescrita: ara dibuixa el nivell, els sprites dels owlets i l'obstacle. |
| **#6** App — Joystick | El `Dpad` ja existent s'ha connectat al WebSocket. Cada pulsació envia `player:input` al servidor. |
| **#7** Servidor — Física i broadcast | Ja estava implementat. S'ha verificat que funciona correctament. |
| **#8** Web — Flutter visualitzador | S'han corregit els bugs crítics: protocol, coordenades i obstacle. |

---

## SERVIDOR (`IETI-Park-SERVER`)

### `src/socket/index.js` — Nova funcionalitat: enviar estat de la sala en connectar

**Problema anterior:** El servidor només enviava `room:update` quan algú entrava o sortia. Si l'app estava al menú i es connectava com a observadora, no veia res fins que algú fes alguna acció.

**Solució afegida:** En el moment que qualsevol client es connecta, el servidor li envia immediatament l'estat actual de la sala:

```javascript
// Quan un client es connecta, rep l'estat actual de la sala al moment
ws.send(JSON.stringify({
    type: 'room:update',
    data: { players: Object.values(room.players) }
}));
```

Això permet que el menú de l'app Android mostri la llista de jugadors des del primer instant.

---

### `src/socket/handlers/playerHandler.js` — Límit de 8 jugadors

**Problema anterior:** No hi havia cap límit. Podien entrar-hi infinits jugadors.

**Solució afegida:** Si ja hi ha 8 jugadors, el servidor rebutja la connexió:

```javascript
if (Object.keys(room.players).length >= 8) {
    sendToSocket(ws, 'room:full', { message: 'Room is full (max 8 players)' });
    ws.close();
    return;
}
```

---

## APP ANDROID (`IETI-Park-APP`)

### `JugadorData.java` — Camp `nickname` afegit

S'ha afegit el camp `nickname` (String) a la classe de dades del jugador per poder mostrar el nom de cada jugador a la pantalla de joc.

---

### `FirstScreen.java` — Connexió d'observador i llista de jugadors en temps real

**Problema anterior:** El menú tenia el camp de text i el botó PLAY, però no es connectava al servidor. No es veia qui hi havia a la sala.

**Canvis realitzats:**

1. **Connexió d'observador:** En obrir el menú, s'obre una connexió WebSocket al servidor **sense enviar `player:join`.** Això permet rebre `room:update` sense aparèixer com a jugador.

2. **Llista en temps real:** Quan arriba un missatge `room:update`, s'actualitza el label `playerListLabel` amb el format `In room (N/8): - Jugador1 - Jugador2...`

3. **Navegació:** En prémer PLAY, es tanca la connexió d'observador i es navega a `GameScreen` amb el nickname escollit. `GameScreen` crearà una connexió nova i enviarà `player:join`.

4. **Fallback de nickname:** Si el camp és buit, es genera un nom aleatori (`JugadorXXXXXX`).

**Flux resultant:**
```
FirstScreen mostra menú → connecta com observador → rep room:update → mostra llista
    → usuari escriu nom → prem PLAY → tanca observador → va a GameScreen
```

---

### `GameScreen.java` — Reescriptura completa com a pantalla de joc real

**Problema anterior:** El que s'anomenava `GameScreen` en realitat era una pantalla de lobby (mostrava text amb la llista de jugadors connectats, no dibuixava cap món). No hi havia cap rendering de joc.

**Ara `GameScreen` és la pantalla de joc real.** Funciona així:

#### Connexió i unió
En obrir-se (`show()`), crea una nova connexió WebSocket i envia `player:join`. El servidor respon amb `game:start` (que conté l'ID assignat al jugador) i comença a enviar `game:state` cada 50ms.

#### Rendering del món (`render()`)
S'utilitza el `SpriteBatch` compartit de `Main` amb la projecció de la càmera del joc (110x80 unitats). Ordre de dibuix:

1. **Fons blau cel** — color sòlid via `ScreenUtils.clear()`
2. **Terra marró** — rectangle de 110x3 unitats al fons (y=0 a y=3)
3. **Obstacle taronja** — rectangle a la posició rebuda del servidor (`obstacleX, obstacleY, obstacleW, obstacleH`)
4. **Owlets de cada jugador** — sprite de `assets/OWLETS/owlet_{color}.png` centrat a la posició `(player.x, player.y)` del servidor
5. **Nickname** — text petit sobre cada sprite

#### El `whitePixel`
Per dibuixar rectangles de colors (terra, obstacle) sense carregar imatges, es crea una textura d'1x1 píxel blanc i s'usa `batch.setColor()` per tenyir-la:
```java
game.batch.setColor(0.9f, 0.35f, 0.1f, 1f); // taronja
game.batch.draw(whitePixel, obstacleX, obstacleY, obstacleW, obstacleH);
game.batch.setColor(Color.WHITE); // restaurar
```

#### D-pad connectat al WebSocket
El `Dpad` ja existent s'integra en un `Stage` propi amb `ScreenViewport` (coordenades en píxels de pantalla reals) i se situa a la cantonada inferior esquerra. El listener del Dpad ara envia missatges al servidor:

```java
dpad = new Dpad(new Dpad.DPadListener() {
    @Override
    public void onDirectionPressed(String direction) {
        sendInput(direction); // Envia "left", "right", "up", "upLeft", etc.
    }
    @Override
    public void onDirectionReleased(String direction) {
        sendInput("none"); // El jugador ha deixat anar el botó
    }
}, game);
```

El mètode `sendInput()` empaqueta la direcció en el format que espera el servidor:
```json
{ "type": "player:input", "data": { "direction": "left" } }
```

#### Botó de tornada
Prémer el botó Back d'Android (o Escape a l'escriptori) tanca el socket i torna al menú.

---

## WEB FLUTTER (`IETI-Park-WEB`)

### `visor_partida_page.dart` — Protocol corregit

**Problema anterior:** El codi buscava `data['gameState']` però el servidor envia `{ "type": "game:state", "data": { ... } }`. Per tant, mai s'actualitzava cap estat del joc.

**Solució:**
```dart
// ABANS (incorrecte):
if (data['gameState'] != null) {
    _estadoJuego = data['gameState'];
}

// ARA (correcte):
if (type == 'game:state') {
    _estadoJuego = data['data'];
}
```

S'ha afegit una barra d'estat a la part superior que mostra si el client està connectat i un botó per connectar/desconnectar manualment.

---

### `game_painter.dart` — Correccions de coordenades i obstacle

Tres problemes crítics s'han corregit:

#### 1. Escala de coordenades
El servidor envia posicions en unitats de joc (x: 0–110, y: 0–80). El canvas de Flutter té mides de píxels variables. Ara s'aplica una transformació d'escala:

```dart
double toScreenX(double worldX, double canvasW) => (worldX / worldW) * canvasW;
double toScreenY(double worldY, double canvasH) => canvasH - (worldY / worldH) * canvasH;
```

#### 2. Inversió de l'eix Y
El servidor (libGDX) té `y=0` a **baix**. Flutter té `y=0` a **dalt**. Sense invertir l'eix, els jugadors apareixerien al revés. La funció `toScreenY` ja fa la inversió.

#### 3. Obstacle dibuixat
L'obstacle que el servidor envia (`obstacle: { x, y, width, height }`) ara es dibuixa al canvas com un rectangle taronja, correctament escalat i posicionat.

#### 4. Tilemap escalat a pantalla completa
Anteriorment, les tiles es dibuixaven en píxels absoluts (col × tileW), cosa que podia no omplir la pantalla. Ara les tiles s'escalen per omplir exactament el canvas:
```dart
final double tileW = size.width / matrix[0].length.toDouble();
final double tileH = size.height / matrix.length.toDouble();
```

#### 5. Colors de jugadors per owlet
Cada jugador es dibuixa amb el color del seu owlet assignat (en lloc d'un cercle vermell fix), i se li mostra el nickname a sobre.

---

## Com provar-ho tot

### Servidor (local)
```bash
cd IETI-Park-SERVER/ietipark-server
npm run dev
```
El servidor escolta al port 3000.

### App Android
Compilar i instal·lar a un dispositiu o emulador. L'adreça del servidor és `pico6.ieti.site:443` (el Proxmox desplegat). Per fer-ho local, canviar `SERVER_ADDRESS` a `10.0.2.2` (emulador) o a la IP del PC a la mateixa xarxa.

### Flutter Web
```bash
cd IETI-Park-WEB/web_park
flutter run -d chrome
```
Per desplegar a web: `flutter build web` i pujar la carpeta `build/web` a qualsevol servidor estàtic.

---

## Notes per al Sprint 2

- **Activitat #10** (porta + col·lisions entre jugadors): no implementada. Cal afegir un objecte `door` a `GameRoom.js` i la lògica AABB entre jugadors a `updatePhysics()`.
- **Sprites owlet al Flutter**: ara els jugadors es mostren com a cercles de color. Per Sprint 2 es poden carregar les imatges PNG reals dels owlets.
- **MongoDB**: la connexió existeix però no es fa servir. En Sprint 2 s'han de desar les partides i puntuacions.
