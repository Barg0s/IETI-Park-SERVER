


# 🚀 IETI Park: Manual Técnico del Servidor (Sprint 1)

Este documento detalla la arquitectura, el flujo de datos y la lógica de negocio del backend para el proyecto **IETI Park**. El servidor actúa como el "Cerebro Central" que sincroniza a los jugadores en tiempo real, gestiona la física del mundo y comunica las aplicaciones de Android y Flutter.

---

## 🏗️ 1. Arquitectura del Sistema

El servidor es una aplicación **Node.js** híbrida que utiliza dos canales de comunicación simultáneos:

### A. Canal Administrativo (HTTP + Express)
* **Función**: Gestión de configuración, seguridad y comprobación de estado.
* **CORS**: Configurado específicamente para permitir conexiones desde clientes Flutter Web (`Access-Control-Allow-Origin: *`).
* **Base de Datos**: Se conecta a **MongoDB** mediante Mongoose. Si la conexión falla, el servidor entra en "modo memoria" para permitir el desarrollo del Sprint 1 sin bloqueos.

### B. Canal de Tiempo Real (WebSockets)
* **Librería**: `ws` (WebSockets nativos).
* **Función**: Envío de coordenadas y recepción de inputs cada **50ms**.
* **Identificación**: Cada conexión recibe un `UUID` único que se mantiene durante toda la sesión.

---

## 📂 2. Anatomía de los Archivos

### 🌐 `app.js` (La Base)
Configura el servidor Express. Su tarea principal es levantar el puerto HTTP y asegurar que los navegadores (Flutter) no bloqueen las peticiones por políticas de origen.

### 🔌 `index.js` (El Portero)
Gestiona la entrada de nuevas conexiones de red. 
* Cuando un jugador se conecta, crea el socket y escucha eventos.
* Utiliza un `switch` para dirigir los mensajes JSON al controlador adecuado según su propiedad `type`.

### 🧠 `GameRoom.js` (El Motor de Físicas)
Es el corazón del juego. Funciona como un **Singleton** (una única instancia para todo el servidor).
* **Tick Rate**: El motor se actualiza 20 veces por segundo ($20 \text{ FPS}$).
* **Física**: Calcula el movimiento usando un valor `delta` (tiempo transcurrido), lo que garantiza que la velocidad sea constante aunque haya lag.
* **Coordenadas**: El mundo está diseñado para una resolución de $110 \times 80$ unidades, compatible con la cámara de libGDX.

### 🎮 `handlers/` (Los Controladores)
* **`playerHandler.js`**: Gestiona el ciclo de vida del jugador (unirse, enviar inputs, desconectarse).
* **`gameHandler.js`**: Se encarga de hacer el "Broadcast" (gritar a todos los clientes a la vez) el estado actual del juego.

---

## 📨 3. El Contrato JSON (Protocolo de Comunicación)

Para que el servidor y los clientes se entiendan, todos los mensajes deben seguir este formato de objeto:

### 📤 Entrante (Del Cliente al Servidor)

#### Unirse a la partida (`player:join`)
Enviado por Android al iniciar la conexión.
```json
{
  "type": "player:join",
  "data": { "nickname": "NombreDelJugador" }
}
```

#### Enviar Movimiento (`player:input`)
Enviado cada vez que se pulsa o suelta un botón del D-Pad.
```json
{
  "type": "player:input",
  "data": { "direction": "left" }
}
```
*Direcciones válidas: `left`, `right`, `up`, `upLeft`, `upRight`, `none`.*

---

### 📥 Saliente (Del Servidor al Cliente)

#### Inicio de Partida (`game:start`)
Respuesta inmediata del servidor al jugador que acaba de entrar.
```json
{
  "type": "game:start",
  "data": {
    "id": "uuid-unico",
    "nickname": "Nombre",
    "color": "azul",
    "players": [{ "id": "...", "x": 20, "y": 50 }]
  }
}
```

#### Estado del Mundo (`game:state`)
Se envía a **todos** los clientes cada 50ms. Contiene las posiciones de jugadores y obstáculos.
```json
{
  "type": "game:state",
  "data": {
    "players": [{ "id": "...", "x": 45.2, "y": 10.5, "color": "azul" }],
    "obstacle": { "x": 55.0, "y": 0, "width": 20, "height": 20 }
  }
}
```

---

## 🛠️ 4. Hoja de Ruta: Cambios Críticos para el Sprint 1

Según los requerimientos del proyecto, el código actual necesita estas actualizaciones para estar completo:

| Requisito | Estado | Archivo a modificar | Acción necesaria |
| :--- | :--- | :--- | :--- |
| **Límite de Jugadores** | ⚠️ Pendiente | `GameRoom.js` | Añadir validación para no superar los 8 jugadores. |
| **La Puerta** | ⚠️ Pendiente | `GameRoom.js` | Crear el objeto `this.door` en el constructor y enviarlo en el `gameState`. |
| **Colisiones** | ⚠️ Pendiente | `GameRoom.js` | Implementar lógica de colisión AABB para que los jugadores se obstaculicen entre ellos. |
| **Colores** | ✅ Listo | `GameRoom.js` | Ya asigna colores únicos de una lista predefinida. |

---

## ⚙️ 5. Instalación y Ejecución

1.  **Instalar dependencias**:
    ```bash
    npm install
    ```
2.  **Configurar Variables de Entorno** (Opcional):
    `MONGODB_URI`: Dirección de tu base de datos.
3.  **Lanzar el servidor**:
    ```bash
    npm start
    ```

---

### Notas de Implementación (Física)
El servidor utiliza una gravedad constante de $-200 \text{ unidades/s}^2$ y una potencia de salto de $120 \text{ unidades/s}$. Es vital que el cliente Android use estos mismos valores o confíe plenamente en las coordenadas recibidas del servidor para evitar el "efecto fantasma".

---

