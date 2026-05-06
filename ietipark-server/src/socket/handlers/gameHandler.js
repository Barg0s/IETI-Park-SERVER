const room = require('../../game/GameRoom');
const { guardarPartida } = require('../../services/gameService');

const startBroadcasting = (wss) => {
    // Broadcast del game state (60 FPS)
    room.setBroadcastAction((gameState) => {
        const msg = JSON.stringify({ type: 'game:state', data: gameState });
        wss.clients.forEach(client => {
            if (client.readyState === 1) client.send(msg);
        });
    });

    // Broadcast d'events de nivell + integració MongoDB
    room.setBroadcastEvent((eventType, eventData) => {
        const msg = JSON.stringify({ type: eventType, data: eventData });
        console.log(`[GAME] Event: ${eventType}`, JSON.stringify(eventData));
        wss.clients.forEach(client => {
            if (client.readyState === 1) client.send(msg);
        });

        // Guardar partida a MongoDB quan es completa un nivell o s'aconsegueix la victòria
        if (eventType === 'game:level_complete') {
            guardarPartida(room, eventData.level, false);
        } else if (eventType === 'game:victory') {
            guardarPartida(room, room.currentLevel, true);
        }
    });
};

module.exports = { startBroadcasting };
