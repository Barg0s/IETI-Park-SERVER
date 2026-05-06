# Documentació de Millores i Estat del Projecte

Aquest document detalla el protocol de comunicació actual basat en el codi font i analitza les millores sol·licitades per a l'optimització, visualització i físiques.

## 1. Documentació del Protocol JSON (Basat en el Codi)

El servidor utilitza un sistema de missatges basat en `type` i `data`. A continuació es detalla l'estructura exacta extreta de `GameRoom.js` i els handlers.

### A. Servidor -> Client (Outgoing)

| Tipus de Missatge | Origen del Codi | Estructura de Dades (`data`) |
| :--- | :--- | :--- |
| `room:update` | `playerHandler.js` | `players`: Llista d'objectes amb `id`, `nickname`, `color`. |
| `room:full` | `playerHandler.js` | `message`: Missatge d'error de sala plena. |
| `game:start` | `playerHandler.js` | `id`, `nickname`, `color`, `players` (estat inicial). |
| `game:state` | `GameRoom.js` | `currentLevel`, `door`, `players`, `obstacle`, `key`, `platform`, `precipice`. |
| `game:door_open` | `GameRoom.js` | `openedBy`: Nickname de qui ha obert la porta. |
| `game:level_complete`| `GameRoom.js` | `level`, `nextLevel`. |
| `game:victory` | `GameRoom.js` | `message`: Text de victòria. |
| `game:level_change` | `GameRoom.js` | `level`: El número del nivell al qual es canvia. |

### B. Client -> Servidor (Incoming)

| Tipus de Missatge | Handler | Estructura de Dades (`data`) |
| :--- | :--- | :--- |
| `player:join` | `playerHandler.js` | `nickname`: Nom d'usuari. |
| `player:input` | `playerHandler.js` | `direction`: Direcció de l'Enum (left, right, up, none). |

---

## 2. Optimització de Rendiment i Tràfic (Lag)

**Estat actual:** El servidor processa la física a **60 FPS** (`tickRate = 16`). Per optimitzar la xarxa, el servidor només realitza el `broadcast` de l'estat si aquest ha canviat respecte a l'últim "tick" (`_lastStateStr !== newStateStr`).

## 3. Registre de Logs (Timestamps)

**Estat actual:** Implementat a `index.js`. S'utilitza un override de `console.log` per incloure la data local.
```javascript
// Localització: index.js (línies 14-32)
function getTimestamp() {
    return '[' + new Date().toLocaleString('es-ES', {
        timeZone: 'Europe/Madrid',
        hour12: false
    }) + ']';
}
```
Això garanteix que tots els logs del servidor (connexions, events de joc, errors) tinguin la marca temporal automàticament.

---
 ## 4. Aplicació mòbil i Flutter Web

 **Augmentat** el tamany dels jugadors per una major facilitat de localitzar-los al joc i refactorització d'algunes parts del codi.
