# Explicación del Servidor: IETI Park (Sprint 1)

Este documento ha sido redactado para que todo el equipo pueda entender la arquitectura base del servidor Node.js desarrollado para el juego, los motivos detrás de las decisiones técnicas y cómo interactúan las distintas capas de la aplicación.

## 1. Decisiones Técnicas Base

### Cambio a WebSockets Nativos (`ws`)
Inicialmente se consideró utilizar librerías de terceros (ej. `socket.io`). Sin embargo, en un juego multijugador 2D de ritmo rápido, la latencia es un factor crítico. Muchas librerías añaden una capa extra de procesamiento de red y metadatos. Por esta razón, se ha optado por implementar **WebSockets puros** utilizando el paquete `ws` de `npm`. 

Esto significa que:
- Las aplicaciones cliente (Android/libGDX y el observador en Flutter Web) deberán usar implementaciones nativas de WebSocket.
- Los mensajes ya no se emiten por "eventos" o métodos de librería predecibles, sino que nos comunicamos bidireccionalmente obligando al sistema a generar y descifrar cadenas de texto en formato `JSON` estructurado.

### Base de Datos en Memoria (Fallback)
La infraestructura del servidor está preparada para conectar con nuestra base de datos MongoDB (alojada en Proxmox). Sin embargo, para evitar que una hipotética caída del servidor virtual bloquee el desarrollo y prueba técnica del multijugador en este Sprint 1, el archivo `src/config/db.js` está diseñado para atrapar y no penalizar el error de conexión. Si no hay base de datos disponible, el servidor avisa en consola pero mantendrá la sala abierta, registrando todas las físicas y conexiones en memoria local (RAM) con un diseño de clase Singleton.

---

## 2. Estructura de Directorios y Ficheros

*   **`package.json`**
    Contiene las dependencias críticas actualizadas de Backend. Destaca el paquete `ws` para el protocolo interno, `uuid` para auto-generar identificadores de sesión únicos de la capa network y `nodemon` para entorno de desarrollo (con la instrucción `npm run dev`, el servidor se reinicia de manera continua ante cualquier guardado de código, evitando apagarlo y encenderlo a mano).

*   **`.env`**
    Destinado a mantener variables que cambiarán según la máquina en la que corra el código. Especialmente `PORT` para elegir red, y la `MONGODB_URI`.

*   **`index.js`**
    El orquestador principal. Intenta cargar el MongoDB sin bloquear código. Genera la máquina HTTP de interconexiones y delega su capa WS.

*   **`src/app.js`**
    El cerebro HTTP mediante `express`. Habilita middlewares y la configuración fundamental CORS (Cross-Origin Resource Sharing). Requisito para que el frontend (Flutter Web) consuma o lea las partidas, de forma abierta, sin fallar por temas de origen cruzado de protocolos de internet.

*   **`src/config/db.js`**
    Peto del servidor MongoDB.

---

## 3. Arquitectura Multijugador en Tiempo Real

El servidor divide el motor lógico en dos áreas especializadas: Comunicaciones Sockets, y el Motor de Física o GameRoom.

### El Protocolo JSON
Para solucionar la falta de "eventos" programados en WS Puro, siempre que hablemos entre Android, Flutter y el Server, debe respetarse esta arquitectura preestablecida:

```json
{
  "type": "tipo_de_evento",
  "data": { "parametros": "de la transaccion" }
}
```

### El Directorio `src/socket`

*   **`index.js`**: Módulo monitor general, controla quién entra y quién se va, proveyendo a cualquier nuevo socket una ID `uuid` inalterable. Caza el string puro de los clientes, lo somete a parseo, identifica el rol (`player:join` o `player:input`) y lo envía a los Handlers para ser procesado.
*   **`handlers/playerHandler.js`**:
    *   Firma de `player:join`: Instaura un jugador explícitamente solicitando su aparición en el espacio al GameRoom. Toma la instancia y le devuelve mediante UDP/TCP el color específico asignado. Ademas emite mensaje genérico a toda la lista de gente para notificar de que el estado de jugadores se amplió.
    *   Firma de `player:input`: Actualiza exclusivamente un control binario en los movimientos para dictar su comportamiento inminente (`left`, `right` y/o `jump`).
    *   `disconnect`: Borra todo rastro orgánico del jugador del mapa e informa generalizadamente.
*   **`handlers/gameHandler.js`**: Transmite en masa unidireccional todo el espectro de mapeo, estado y objetos mediante la etiqueta JSON `game:state` a todos de una vez, optimizando concurrencia.

### El Motor Maestro Matemático: `src/game/GameRoom.js`

Exportado generalista (`module.exports = globalRoom`) que se usa de núcleo in-memory en todos los ficheros del Server. Alberga el entorno físico central del juego, llamado **Game Loop**.

Este Bucle Infinito de física matemática está parametrizado cada 50ms, equivalentes a **20 fotogramas por segundo del servidor (20 Tickrate)**. Sus operaciones fundamentales, ejecutadas en cada vuelta, son:

1.  **Regresión `updatePhysics(delta)`**:
    *   Mide el lapso temporal ("delta").
    *   Itera por cada uno de los avatares activos.
    *   Les suma obligatoriamente un índice de gravedad vertical destructiva asimétrica (hacia abajo constantemente).
    *   Revisa el boolean de iteración de Input. Si detecta lateralidad positiva/negativa, instaura desplazamiento vectorizado `vx`. Si el Android dicta orden de Salto, aplica contraimpulso vertical (elevación programada `vy`) con regla subyacente de comprobación de `hitbox` (para la colisión inferior contra el suelo, requiriendo `onGround` para evitar saltos en el aire).
    *   Por motivos de Sprint 1, traslada e invierte el vector de un obstáculo local que actúa a modo de patrulla en todo momento con márgenes.
    
2.  **Fase Emisora**:
    *   Extrae un sumatorio representativo del estado matemático.
    *   Lo vuelca sobre una callback insertada por Socket.js, forzando la replicación en todos los sistemas que observan o manipulan el tablero interactuando asincrónicamente.

---

## 4. Instrucción de Arranque
Dado que la aplicación incluye un servidor Nodemon de auto-actualización instanciado en Scripts:

```bash
npm install
npm run dev
```

El servidor expondrá logs en consola especificando si se encuentra en modo memoria RAM y el estatus del puerto activo a la escucha.
