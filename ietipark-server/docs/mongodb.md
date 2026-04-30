# Documentación de MongoDB (IETI-Park)

El servidor de IETI-Park utiliza MongoDB (mediante la librería Mongoose) para persistir las estadísticas de los jugadores y el historial de partidas jugadas. 

A continuación se detalla la estructura de la base de datos y cómo se guardan los datos automáticamente al terminar un nivel.

## Modelos de Datos (Schemas)

Los modelos se encuentran en la carpeta `src/models/` y definen las colecciones en MongoDB.

### 1. Jugador (`Jugador.js`)
Guarda el perfil y las estadísticas globales de un jugador.

```javascript
{
    nickname: String,             // Nombre único del jugador (Obligatorio)
    color: String,                // Color asignado ('azul', 'rojo', etc)
    total_partides: Number,       // Cantidad total de partidas jugadas
    millor_temps_segons: Number,  // Récord personal de tiempo en cualquier nivel
    nivell_maxim_assolit: Number, // Nivel más alto que ha logrado completar
    createdAt: Date               // Fecha de registro
}
```

### 2. Partida (`Partida.js`)
Registra cada sesión de juego multijugador. Una partida se crea cuando los jugadores completan un nivel.

```javascript
{
    data_inici: Date,             // Fecha y hora en la que entró el primer jugador a la sala
    data_fi: Date,                // Fecha y hora en la que completaron el nivel
    duracio_segons: Number,       // Tiempo total que han tardado en cruzar la puerta
    nivell_completat: Number,     // El nivel que acaban de superar
    victoria: Boolean,            // True si es el nivel final del juego, False si pasan a otro nivel
    jugadors_participants: [      // Array con los jugadores que estaban en la partida
        { nickname: String, color: String }
    ],
    createdAt: Date
}
```

### 3. Record (`Record.js`)
Guarda las marcas de tiempo (leaderboards). Está optimizado con un índice compuesto `{ nivell: 1, temps_segons: 1 }` para poder hacer consultas muy rápidas del "Top 10 mejores tiempos del Nivel 1", por ejemplo.

```javascript
{
    nickname: String,             // Jugador que logró el tiempo
    nivell: Number,               // Nivel completado
    temps_segons: Number,         // Segundos que tardó
    jugadors_totals: Number,      // Cuántos jugadores había en la sala (para separar récords en Solitario vs Cooperativo)
    data: Date
}
```

### 4. Nivel (`Nivel.js`)
Contiene metadatos de los niveles (opcional para el backend actual, pero útil si queréis hacer un CMS para editar niveles desde una web).

```javascript
{
    num_nivell: Number,           // Identificador (1, 2, etc)
    nom: String,                  // "Nivel 1: El comienzo"
    descripcio: String,
    mapa_amplada: Number,
    mapa_alcada: Number,
    te_precipici: Boolean,
    te_plataforma: Boolean,
    te_clau: Boolean,
    createdAt: Date
}
```

---

## Flujo de Guardado (`gameService.js`)

El guardado en la base de datos es **completamente automático**. 

### ¿Cuándo se guarda?
En `src/socket/handlers/gameHandler.js`, el servidor escucha los eventos del juego.
- Cuando el servidor emite el evento `game:level_complete` (pasan del Nivel 1 al 2), llama a `guardarPartida(room, 1, false)`.
- Cuando el servidor emite el evento `game:victory` (pasan el Nivel 2, final del juego), llama a `guardarPartida(room, 2, true)`.

### ¿Qué hace `guardarPartida`?
La función se encuentra en `src/services/gameService.js` y ejecuta las siguientes operaciones en bloque:

1. **Cálculo de tiempo:** Coge la hora actual y le resta `room._partidaInici` (el momento en que el primer jugador entró a la sala) para sacar los segundos exactos (`duracioSegons`).
2. **Crear Partida:** Inserta un documento en la colección `Partida` con el array de jugadores actuales y el tiempo.
3. **Actualizar Jugadores:** Recorre todos los jugadores de la sala y usa `$inc` para sumar 1 a su `total_partides`, `$max` para actualizar su nivel máximo si es mayor al que tenían, y `$min` para actualizar su mejor tiempo histórico. **Si el jugador no existe en MongoDB, lo crea automáticamente** (`upsert: true`).
4. **Guardar Récord (Opcional):** Si la partida es una victoria final (`victoria: true`), inserta en la colección `Record` las marcas de todos los participantes.

### Manejo de errores
Si la base de datos MongoDB no está encendida o no hay conexión, `guardarPartida` interceptará el error (bloque `try/catch`) y mostrará un *Warning* en la consola (`[DB] No s'ha pogut guardar la partida`), pero **el juego no crasheará** y los jugadores podrán seguir jugando normalmente.
