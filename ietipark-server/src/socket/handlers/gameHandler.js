const room = require('../../game/GameRoom');

const startBroadcasting = (wss) => {
    // Això es crida 20 vegades per segon des de GameRoom
    room.setBroadcastAction((gameState) => {
        const msg = JSON.stringify({
            type: 'game:state',
            data: gameState
        });
        
        wss.clients.forEach(client => {
            if (client.readyState === 1) { // 1 = OPEN
               client.send(msg);
            }
        });
    });
};

module.exports = { startBroadcasting };
