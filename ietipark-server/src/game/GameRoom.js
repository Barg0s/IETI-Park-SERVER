class GameRoom {
    constructor() {
        this.players = {};
        this.currentLevel = 1;
        this.playersAtDoor = new Set();
        this.levelTransitioning = false;

        // === CONFIGURACIÓ DELS NIVELLS ===
        // === CONFIGURACIÓ DELS NIVELLS (Ajustado para Sprites 64x64) ===
        this.levelConfigs = {
            1: {
                groundY: 160,          // El suelo ahora está a 64px (antes 160 era demasiado alto)
                worldWidth: 800,
                spawnX: 30,
                spawnY: 160,          // Aparecen justo sobre el suelo
                precipice: null,
                platform: null,
                // El candado (obstacle) está quieto, un poco más arriba
                obstacle: { x: 280, y: 192, width: 32, height: 32 },
                // Llave más grande y más alta
                key: { x: 225, y: 230, width: 30, height: 47, state: 'floor', carriedBy: null },
                // Puerta más alta para evitar que la salten por encima
                door: { x: 740, y: 160, width: 40, height: 200, isOpen: false }
            },
            2: {
                groundY: 160,
                worldWidth: 800,
                spawnX: 30,
                spawnY: 160,
                // Precipicio ajustado al nuevo groundY
                precipice: { x: 350, y: 0, width: 100, height: 64 },
                // Plataforma un poco más alta para que tengan que saltar
                platform: { x: 370, y: 180, width: 80, height: 20 },
                obstacle: null,
                key: null,
                door: { x: 740, y: 64, width: 40, height: 100, isOpen: false }
            }
        };

        this._initLevel(1);

        this.colors = ['azul', 'rojo', 'verde', 'amarillo', 'marron', 'morado', 'naranja'];
        this.usedColors = new Set();

        this.tickRate = 16;
        this.lastTime = Date.now();
        this.startGameLoop();
    }

    _initLevel(levelNum) {
        const cfg = this.levelConfigs[levelNum];
        this.currentLevel = levelNum;
        this.playersAtDoor = new Set();
        this.levelTransitioning = false;
        this.obstacle = cfg.obstacle ? { ...cfg.obstacle } : null;
        this.key = cfg.key ? { ...cfg.key } : null;
        this.door = structuredClone(cfg.door);
        this.platform = cfg.platform ? { ...cfg.platform } : null;
        this.precipice = cfg.precipice ? { ...cfg.precipice } : null;
    }

    // Callbacks injectats des de fora
    setBroadcastAction(broadcastAction) { this.broadcastState = broadcastAction; }
    setBroadcastEvent(broadcastEvent) { this.broadcastLevelEvent = broadcastEvent; }

    addPlayer(id, nickname) {
        let assignedColor = 'base';
        for (let c of this.colors) {
            if (!this.usedColors.has(c)) { assignedColor = c; this.usedColors.add(c); break; }
        }
        const spawnIndex = Object.keys(this.players).length;
        const cfg = this.levelConfigs[this.currentLevel];
        this.players[id] = {
            id, nickname, color: assignedColor,
            x: cfg.spawnX + spawnIndex * 40, y: cfg.spawnY,
            vx: 0, vy: 0, onGround: false, crossedDoor: false,
            inputs: { left: false, right: false, jump: false }
        };
        return this.players[id];
    }

    removePlayer(id) {
        const p = this.players[id];
        if (p && p.color !== 'base') this.usedColors.delete(p.color);
        // Si portava la clau, la deixa caure al seu lloc original
        if (this.key && this.key.state === 'carried' && this.key.carriedBy === id) {
            this.key.state = 'floor';
            this.key.carriedBy = null;
            const originalKey = this.levelConfigs[this.currentLevel].key;
            if (originalKey) {
                this.key.x = originalKey.x;
                this.key.y = originalKey.y;
            }
        }
        this.playersAtDoor.delete(id);
        delete this.players[id];

        // Reiniciar el nivel completamente si la sala se queda vacía
        if (Object.keys(this.players).length === 0) {
            console.log('[GAME] Sala vacía. Reiniciando el nivel 1...');
            this._initLevel(1);
        }
    }

    updatePlayerInputs(id, directionEnum) {
        const player = this.players[id];
        if (!player) return;

        const inputs = player.inputs;

        // RESET siempre primero
        inputs.left = false;
        inputs.right = false;
        inputs.jump = false;

        if (!directionEnum || directionEnum === 'none') return;

        const dir = directionEnum.toLowerCase();

        if (dir.includes('left')) inputs.left = true;
        if (dir.includes('right')) inputs.right = true;

        if (dir === 'up') inputs.jump = true;
    }

    startGameLoop() {
        setInterval(() => {
            const now = Date.now();
            // Límite de delta a 0.05s (aprox 20fps) para evitar el "Tunneling" (atravesar paredes si hay lag)
            const delta = Math.min((now - this.lastTime) / 1000, 0.05);
            this.lastTime = now;
            this.updatePhysics(delta);

            if (this.broadcastState) {
                const newState = this._buildGameState();
                const newStateStr = JSON.stringify(newState);

                // Optimización: Solo enviamos si el estado ha cambiado, reduciendo el tráfico de red drásticamente
                if (this._lastStateStr !== newStateStr) {
                    this._lastStateStr = newStateStr;
                    this.broadcastState(newState);
                }
            }
        }, this.tickRate);
    }

    _buildGameState() {
        const state = {
            currentLevel: this.currentLevel,
            door: this.door,
            players: Object.values(this.players).map(p => ({
                id: p.id, nickname: p.nickname, color: p.color,
                x: parseFloat(p.x.toFixed(1)), y: parseFloat(p.y.toFixed(1)),
                vx: parseFloat(p.vx.toFixed(1)), vy: parseFloat(p.vy.toFixed(1)),
                onGround: p.onGround, inputs: p.inputs, crossedDoor: p.crossedDoor
            }))
        };
        if (this.obstacle) {
            state.obstacle = { ...this.obstacle, x: parseFloat(this.obstacle.x.toFixed(1)), y: parseFloat(this.obstacle.y.toFixed(1)) };
        }
        if (this.key) {
            state.key = {
                ...this.key,
                carriedByNickname: (this.key.carriedBy && this.players[this.key.carriedBy]) ? this.players[this.key.carriedBy].nickname : null
            };
        } else {
            // Enviamos la llave fuera de la pantalla porque la APP Android no borra la llave si viene null
            state.key = { x: -1000, y: -1000, width: 0, height: 0 };
        }
        if (this.platform) state.platform = this.platform;
        if (this.precipice) state.precipice = this.precipice;
        return state;
    }

    updatePhysics(delta) {
        // Dentro de updatePhysics(delta)
        const P_SPEED = 120;      
        const GRAVITY = -400;     
        const JUMP_POWER = 300;   
        const PLAYER_W = 32;      // Hitbox física más estrecha
        const PLAYER_H = 58;      // Ajustado -2px para que pisen las cabezas exactas
        const OFFSET_X = 16;      // Offset para centrar la hitbox en el sprite visual de 64x64
        const cfg = this.levelConfigs[this.currentLevel];
        const GROUND_Y = cfg.groundY;


        for (let id in this.players) {
            const p = this.players[id];

            p.vx = 0;
            if (p.inputs.left) p.vx = -P_SPEED;
            if (p.inputs.right) p.vx = P_SPEED;
            if (p.inputs.jump && p.onGround) { p.vy = JUMP_POWER; p.onGround = false; p.inputs.jump = false; }
            p.vy += GRAVITY * delta;

            let nextX = p.x + p.vx * delta;
            let nextY = p.y + p.vy * delta;
            let setOnGround = false;

            // --- COL·LISIÓ PORTA TANCADA ---
            if (!this.door.isOpen) {
                const door = this.door;

                // colisión horizontal (empuje estricto para que no la puedan atravesar de ninguna manera)
                if (this.checkCollision(nextX + OFFSET_X, p.y, PLAYER_W, PLAYER_H, door.x, door.y, door.width, door.height)) {
                    if (p.vx > 0) { // Choca yendo a la derecha
                        nextX = door.x - PLAYER_W - OFFSET_X - 0.1;
                    } else if (p.vx < 0) { // Choca yendo a la izquierda
                        nextX = door.x + door.width - OFFSET_X + 0.1;
                    }
                    p.vx = 0;
                }

                // colisión vertical
                if (this.checkCollision(p.x + OFFSET_X, nextY, PLAYER_W, PLAYER_H, door.x, door.y, door.width, door.height)) {
                    if (p.vy > 0 && p.y + PLAYER_H <= door.y + 15) {
                        nextY = door.y - PLAYER_H;
                        p.vy = 0;
                    } else if (p.vy < 0 && p.y >= door.y + door.height - 15) {
                        nextY = door.y + door.height;
                        p.vy = 0;
                        setOnGround = true;
                    } else {
                        nextX = p.x;
                        p.vx = 0;
                    }
                }
            }

            // --- COL·LISIONS ENTRE JUGADORS (apilament) ---
            for (let otherId in this.players) {
                if (id === otherId) continue;
                const other = this.players[otherId];

                // Colisión Horizontal
                if (this.checkCollision(nextX + OFFSET_X, p.y, PLAYER_W, PLAYER_H, other.x + OFFSET_X, other.y, PLAYER_W, PLAYER_H)) {
                    nextX = p.x;
                }

                // Colisión Vertical
                if (this.checkCollision(p.x + OFFSET_X, nextY, PLAYER_W, PLAYER_H, other.x + OFFSET_X, other.y, PLAYER_W, PLAYER_H)) {
                    if (p.vy < 0 && p.y >= other.y + PLAYER_H - 15) {
                        nextY = other.y + PLAYER_H;
                        p.vy = 0;
                        setOnGround = true;
                    } else if (p.vy > 0 && p.y + PLAYER_H <= other.y + 15) {
                        nextY = other.y - PLAYER_H;
                        p.vy = 0;
                    }
                }
            }

            // --- COL·LISIÓ PLATAFORMA (Nivell 2) ---
            if (this.platform) {
                const pl = this.platform;
                if (this.checkCollision(p.x + OFFSET_X, nextY, PLAYER_W, PLAYER_H, pl.x, pl.y, pl.width, pl.height)) {
                    if (p.vy < 0 && p.y >= pl.y + pl.height - 2) {
                        nextY = pl.y + pl.height; p.vy = 0; setOnGround = true;
                    }
                }
            }

            // --- COL·LISIÓ TERRA (amb suport de precipici) ---
            const overSolid = this._isOverSolidGround(nextX + OFFSET_X, PLAYER_W);
            if (nextY <= GROUND_Y && overSolid) {
                nextY = GROUND_Y; p.vy = 0; setOnGround = true;
            } else if (!setOnGround) {
                setOnGround = false;
            }

            p.x = nextX;
            p.y = nextY;
            p.onGround = setOnGround;

            // Límits del món
            if (p.x < 0) p.x = 0;
            if (p.x > cfg.worldWidth) p.x = cfg.worldWidth;

            // Nivell 2: caiguda al precipici → reaparèixer al principi
            if (this.currentLevel === 2 && p.y < 0) {
                const spawnOffset = Object.keys(this.players).indexOf(id) * 40;
                p.x = cfg.spawnX + spawnOffset;
                p.y = 400; 
                p.vx = 0; p.vy = 0; p.onGround = false;
            }

            // --- TASK 13: RECOLLIR LA CLAU ---
            if (this.key && this.key.state === 'floor') {
                if (this.checkCollision(p.x + OFFSET_X, p.y, PLAYER_W, PLAYER_H, this.key.x, this.key.y, this.key.width, this.key.height)) {
                    this.key.state = 'carried';
                    this.key.carriedBy = id;
                }
            }
            
            if (this.key && this.key.state === 'carried' && this.key.carriedBy === id) {
                this.key.x = p.x + 32 - (this.key.width * 0.5); // Centrada visualmente
                this.key.y = p.y + 64 + 10; // Encima de la cabeza visual
            }

            // --- TASK 20: CLAU OBRE LA PORTA ---
            if (this.key && !this.door.isOpen && this.key.state === 'carried' && this.key.carriedBy === id) {
                if (p.x + 64 >= this.door.x - 30) {
                    this.door.isOpen = true;
                    if (this.broadcastLevelEvent) this.broadcastLevelEvent('game:door_open', { openedBy: p.nickname });
                }
            }

            // --- TASK 22: DETECTAR QUE EL JUGADOR CREUA LA PORTA ---
            if (this.door.isOpen && !p.crossedDoor && p.x > this.door.x + this.door.width) {
                p.crossedDoor = true;
                this.playersAtDoor.add(id);
                this._checkAllCrossed();
            }
        }
    }

    // Comprova si el punt del terra és sòlid (per al precipici del nivell 2)
    _isOverSolidGround(playerX, playerW) {
        if (!this.precipice) return true;
        const pRight = playerX + playerW;
        const gLeft = this.precipice.x;
        const gRight = this.precipice.x + this.precipice.width;
        return !(pRight > gLeft && playerX < gRight);
    }

    // Task 22: comprova si tots han creuat
    _checkAllCrossed() {
        const total = Object.keys(this.players).length;
        if (total === 0 || this.levelTransitioning) return;
        if (this.playersAtDoor.size >= total) {
            this.levelTransitioning = true;
            console.log(`[GAME] Tots els jugadors han creuat la porta del Nivell ${this.currentLevel}!`);
            if (this.currentLevel === 1) {
                if (this.broadcastLevelEvent) this.broadcastLevelEvent('game:level_complete', { level: 1, nextLevel: 2 });
                setTimeout(() => this._switchToLevel2(), 1000); // Tarda solo 1 segundo en cambiar
            } else {
                if (this.broadcastLevelEvent) this.broadcastLevelEvent('game:victory', { message: 'Tots els jugadors han completat el joc!' });
            }
        }
    }

    // Task 22/23: canvi a Nivell 2
    _switchToLevel2() {
        console.log('[GAME] Canviant a Nivell 2...');
        this._initLevel(2);
        // Reaparèixer als jugadors al principi del nivell 2 de forma escalonada
        let i = 0;
        for (let id in this.players) {
            const p = this.players[id];
            p.x = 30 + i * 40; p.y = 400; // cauen des d'alt
            p.vx = 0; p.vy = 0; p.onGround = false; p.crossedDoor = false;
            i++;
        }
        if (this.broadcastLevelEvent) this.broadcastLevelEvent('game:level_change', { level: 2 });
        console.log('[GAME] Nivell 2 iniciat!');
    }

    // Utilitat de col·lisió AABB
    checkCollision(x1, y1, w1, h1, x2, y2, w2, h2) {
        return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
    }
}

const globalRoom = new GameRoom();
module.exports = globalRoom;
