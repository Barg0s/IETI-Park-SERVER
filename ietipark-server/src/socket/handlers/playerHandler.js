const room = require('../../game/GameRoom');

// Envia un missatge JSON a un socket de forma estàndard
const sendToSocket = (ws, type, data) => {
    if (ws.readyState === 1) { // WebSocket.OPEN equival a 1
        ws.send(JSON.stringify({ type, data }));
    }
};

// Funcio broadcast equivalent a "io.emit" pero per websockets natius
const broadcast = (wss, type, data) => {
    const msg = JSON.stringify({ type, data });
    wss.clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(msg);
        }
    });
};

const handleJoin = (wss, ws, data) => {
    const nickname = data.nickname || `Player_${ws.id.substring(0,4)}`;
    
    // Afegim jugador al mon de fisica
    const player = room.addPlayer(ws.id, nickname);

    console.log(`[GAME] Nou jugador a la sala - ${nickname} (Color: ${player.color})`);

    // 1. Contestem unicatariament a qui acaba d'entrar perque sàpiga el seu color
    sendToSocket(ws, 'game:start', {
        id: player.id,
        nickname: player.nickname,
        color: player.color,
        players: Object.values(room.players)
    });

    // 2. Avisar a la resta que la sala s'ha actualitzat
    broadcast(wss, 'room:update', {
        players: Object.values(room.players)
    });
};

const handleInput = (ws, data) => {
    // data.direction vindrá de l'Enum del Dpad d'Android
    room.updatePlayerInputs(ws.id, data.direction || 'none');
};

const handleDisconnect = (wss, ws) => {
    // Esborrem el jugador del món
    room.removePlayer(ws.id);
    
    // Avisem de la llista nova sense aquest jugador
    broadcast(wss, 'room:update', {
        players: Object.values(room.players)
    });
};

module.exports = { handleJoin, handleInput, handleDisconnect };
