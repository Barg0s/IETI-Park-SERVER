class GameRoom {
    constructor() {
        this.players = {}; // Guardarem jugadors per WebSocket
        this.obstacle = {
            x: 50,
            y: 0,
            width: 20,
            height: 20,
            speed: 50, // units per second
            direction: 1
        };

        // Activitat 10: La porta impedeix avançar
        this.door = {
            x: 100,
            y: 0,
            width: 5,
            height: 25,
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

        this.players[id] = {
            id: id,
            nickname: nickname,
            color: assignedColor,
            x: 20,
            y: 50,
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
            if (directionEnum.toLowerCase().includes('up')) inputs.jump = true;
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
                    door: this.door
                };
                this.broadcastState(gameState);
            }
        }, this.tickRate);
    }

    updatePhysics(delta) {
        const P_SPEED = 80;
        const GRAVITY = -200;
        const JUMP_POWER = 120;
        const GROUND_Y = 0;
        const PLAYER_W = 8;
        const PLAYER_H = 10;

        // Actualitzar cada jugador
        for (let id in this.players) {
            const p = this.players[id];

            p.vx = 0;
            if (p.inputs.left) p.vx = -P_SPEED;
            if (p.inputs.right) p.vx = P_SPEED;

            if (p.inputs.jump && p.onGround) {
                p.vy = JUMP_POWER;
                p.onGround = false;
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

            // Límits pantalla relacionats amb libGDX (assumint món 110x80)
            if (p.x < 0) p.x = 0;
            if (p.x > 110) p.x = 110;
        }

        // Moure l'obstacle de costat a costat (obstacle patrulla simple)
        this.obstacle.x += this.obstacle.speed * this.obstacle.direction * delta;
        if (this.obstacle.x > 80) {
            this.obstacle.x = 80;
            this.obstacle.direction = -1;
        } else if (this.obstacle.x < 30) {
            this.obstacle.x = 30;
            this.obstacle.direction = 1;
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
