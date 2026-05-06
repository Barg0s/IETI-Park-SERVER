const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const playerHandler = require('./handlers/playerHandler');
const { startBroadcasting } = require('./handlers/gameHandler');

const initSocket = (server) => {
    // Configura el servidor WebSocket per escoltar el mateix port HTTP
    const wss = new WebSocket.Server({ server });
    
    // Iniciar el game loop intern que farà broadcast a "wss.clients"
    startBroadcasting(wss);

    wss.on('connection', (ws) => {
        // Generate a unique ID for this connection and attach it to the ws object
        ws.id = uuidv4();
        console.log(`[WS] New connection: ${ws.id}`);

        // Send the current room state immediately so any observer (e.g. menu screen)
        // can display who is already connected without waiting for a join/leave event
        const room = require('../game/GameRoom');
        if (ws.readyState === 1) {
            ws.send(JSON.stringify({
                type: 'room:update',
                data: { players: Object.values(room.players) }
            }));
        }

        ws.on('message', (message) => {
            try {
                // Amb ws (raw) hem de parsejar manualment els missatges JSON 
                const parsed = JSON.parse(message);
                
                // Switch basat en el nostre disseny { type: '...', data: {} }
                switch (parsed.type) {
                    case 'player:join':
                        playerHandler.handleJoin(wss, ws, parsed.data);
                        break;
                    case 'player:input':
                        playerHandler.handleInput(ws, parsed.data);
                        break;
                    default:
                        console.warn(`[WS] Tipus de missatge desconegut: ${parsed.type}`);
                }
            } catch (err) {
                console.error(`[WS] Error parsejant missatge JSON: ${message}`, err);
            }
        });

        ws.on('close', () => {
            console.log(`[WS] Connexio tancada: ${ws.id}`);
            playerHandler.handleDisconnect(wss, ws);
        });
    });
};

module.exports = { initSocket };
