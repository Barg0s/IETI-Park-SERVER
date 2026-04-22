class GameRoom {
    constructor() {
        this.players = {}; // Guardarem jugadors per WebSocket
        this.obstacle = {
            x: 280,
            y: 180,
            width: 20,
            height: 33,
            speed: 0, // units per second
            direction: 1
        };

        this.key = {
            x: 225,
            y: 275,
            width: 20,
            height: 47,
        }

        // Activitat 10: La porta impedeix avançar
        this.door = {
            x: 300,
            y: 160,
            width: 5,
            height: 32,
            isOpen: false // Per defecte tancada en Sprint 1
        };

        this.colors = ['azul', 'rojo', 'verde', 'amarillo', 'marron', 'morado', 'naranja'];
        this.usedColors = new Set();

        // Loop a 20 FPS (50ms)
        this.tickRate = 50;
        this.lastTime = Date.now();

        this.startGameLoop();
    }

    // Funcio referenciada directament per avisar als clients connectats
    setBroadcastAction(broadcastAction) {
        this.broadcastState = broadcastAction;
    }

    addPlayer(id, nickname) {
        let assignedColor = 'base';
        for (let c of this.colors) {
            if (!this.usedColors.has(c)) {
                assignedColor = c;
                this.usedColors.add(c);
                break;
            }
        }
        
        const spawnIndex = Object.keys(this.players).length;

        this.players[id] = {
            id: id,
            nickname: nickname,
            color: assignedColor,
            x: 20 + spawnIndex * 40,
            y: 160,
            vx: 0,
            vy: 0,
            onGround: false,
            inputs: {
                left: false,
                right: false,
                upLeft: false,
                upRight: false,
                downLeft: false,
                downRight: false,
                jump: false
            }
        };

        return this.players[id];
    }

    removePlayer(id) {
        const p = this.players[id];
        if (p && p.color !== 'base') {
            this.usedColors.delete(p.color);
        }
        delete this.players[id];
    }

    updatePlayerInputs(id, directionEnum) {
        if (!this.players[id]) return;

        // Resetejar inputs
        const inputs = this.players[id].inputs;
        for (let key in inputs) {
            inputs[key] = false;
        }

        // Activació segons l'enum de la direcció (amunt fa saltar).
        if (directionEnum !== 'none' && directionEnum !== '') {
            if (directionEnum.toLowerCase().includes('left')) inputs.left = true;
            if (directionEnum.toLowerCase().includes('right')) inputs.right = true;
            if (directionEnum === 'up') {
                inputs.jump = true; // SOLO EVENTO
            }
        }
    }

    startGameLoop() {
        setInterval(() => {
            const now = Date.now();
            const delta = (now - this.lastTime) / 1000; // Segons
            this.lastTime = now;

            this.updatePhysics(delta);

            if (this.broadcastState) {
                const gameState = {
                    players: Object.values(this.players),
                    obstacle: this.obstacle,
                    door: this.door,
                    key: this.key,
                };
                this.broadcastState(gameState);
            }
        }, this.tickRate);
    }

    updatePhysics(delta) {
        const P_SPEED = 80;
        const GRAVITY = -200;
        const JUMP_POWER = 120;
        const GROUND_Y = 160;
        const PLAYER_W = 32;
        const PLAYER_H = 32;

        // Actualitzar cada jugador
        for (let id in this.players) {
            const p = this.players[id];

            p.vx = 0;
            if (p.inputs.left) p.vx = -P_SPEED;
            if (p.inputs.right) p.vx = P_SPEED;

            if (p.inputs.jump && p.onGround) {
                p.vy = JUMP_POWER;
                p.onGround = false;
                p.inputs.jump = false;
            }

            p.vy += GRAVITY * delta;

            // Intent de moviment x
            let nextX = p.x + p.vx * delta;
            let nextY = p.y + p.vy * delta;

            // --- COL·LISIONS AMB LA PORTA (Activitat 10) ---
            if (!this.door.isOpen) {
                if (this.checkCollision(nextX, p.y, PLAYER_W, PLAYER_H, this.door.x, this.door.y, this.door.width, this.door.height)) {
                    nextX = p.x; // Bloqueja moviment X
                }
            }

            // --- COL·LISIONS AMB ALTRES JUGADORS (Activitat 10) ---
            for (let otherId in this.players) {
                if (id === otherId) continue;
                const other = this.players[otherId];
                if (this.checkCollision(nextX, nextY, PLAYER_W, PLAYER_H, other.x, other.y, PLAYER_W, PLAYER_H)) {
                    // Obstaculització simple: bloqueja el moviment si col·lisionen
                    nextX = p.x;
                    // FIX: He borrado la linea "nextX = p.y;" que había aquí porque era un bug que teletransportaba al jugador
                    // No bloquegem Y per evitar que es quedin flotant un sobre l'altre de forma estranya en aquest Sprint
                }
            }

            p.x = nextX;
            p.y = nextY;

            if (p.y <= GROUND_Y) {
                p.y = GROUND_Y;
                p.vy = 0;
                p.onGround = true;
            } else {
                p.onGround = false;
            }

            // Límits pantalla relacionats amb libGDX (assumint món 800x...)
            if (p.x < 0) p.x = 0;
            if (p.x > 800) p.x = 800;
        }
    }

    // Utilitat de col·lisió AABB
    checkCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x1 < x2 + w2 &&
               x1 + w1 > x2 &&
               y1 < y2 + h2 &&
               y1 + h1 > y2;
    }
}

// Singleton global de la sala
const globalRoom = new GameRoom();
module.exports = globalRoom;
