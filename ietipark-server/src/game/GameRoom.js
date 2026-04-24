class GameRoom {
    constructor() {
        this.players = {};
        this.currentLevel = 1;
        this.playersAtDoor = new Set();
        this.levelTransitioning = false;

        // === CONFIGURACIÓ DELS NIVELLS ===
        this.levelConfigs = {
            1: {
                groundY: 160,
                worldWidth: 800,
                spawnX: 30,
                spawnY: 160,
                precipice: null,
                platform: null,
                obstacle: { x: 280, y: 180, width: 20, height: 33, speed: 100, direction: 1, minX: 200, maxX: 500 },
                key: { x: 225, y: 300, width: 20, height: 47, state: 'floor', carriedBy: null },
                door: { x: 740, y: 160, width: 20, height: 160, isOpen: false }
            },
            2: {
                groundY: 160,
                worldWidth: 800,
                spawnX: 30,
                spawnY: 160,
                precipice: { x: 350, y: 0, width: 100, height: 160 },
                platform: { x: 370, y: 220, width: 60, height: 10 },
                obstacle: null,
                key: null,
                door: { x: 740, y: 160, width: 20, height: 160, isOpen: false }
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
        this.door = { ...cfg.door };
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
        // Si portava la clau, la deixa caure
        if (this.key && this.key.state === 'carried' && this.key.carriedBy === id) {
            this.key.state = 'floor';
            this.key.carriedBy = null;
        }
        this.playersAtDoor.delete(id);
        delete this.players[id];
    }

    updatePlayerInputs(id, directionEnum) {
        if (!this.players[id]) return;

        const inputs = this.players[id].inputs;

        if (!directionEnum || directionEnum === 'none') return;

        const dir = directionEnum.toLowerCase();

        if (dir.includes('left')) {
            inputs.left = true;
            inputs.right = false;
        }

        if (dir.includes('right')) {
            inputs.right = true;
            inputs.left = false;
        }

        if (dir === 'up') {
            inputs.jump = true;
        }
    }

    startGameLoop() {
        setInterval(() => {
            const now = Date.now();
            const delta = (now - this.lastTime) / 1000;
            this.lastTime = now;
            this.updatePhysics(delta);
            if (this.broadcastState) this.broadcastState(this._buildGameState());
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
        }
        if (this.platform) state.platform = this.platform;
        if (this.precipice) state.precipice = this.precipice;
        return state;
    }

    updatePhysics(delta) {
        const P_SPEED = 80, GRAVITY = -200, JUMP_POWER = 120, PLAYER_W = 32, PLAYER_H = 32;
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

                // colisión horizontal
                if (this.checkCollision(nextX, p.y, PLAYER_W, PLAYER_H,
                    door.x, door.y, door.width, door.height)) {
                    nextX = p.x;
                }

                // colisión vertical (IMPORTANTE)
                if (this.checkCollision(p.x, nextY, PLAYER_W, PLAYER_H,
                    door.x, door.y, door.width, door.height)) {
                    if (p.vy > 0) {
                        nextY = door.y - PLAYER_H; // cae encima
                        p.vy = 0;
                        setOnGround = true;
                    } else if (p.vy < 0) {
                        nextY = p.y; // choca por abajo
                        p.vy = 0;
                    }
                }
            }

            // --- COL·LISIONS ENTRE JUGADORS (apilament) ---
            for (let otherId in this.players) {
                if (id === otherId) continue;
                const other = this.players[otherId];
                if (this.checkCollision(nextX, p.y, PLAYER_W, PLAYER_H, other.x, other.y, PLAYER_W, PLAYER_H)) {
                    nextX = p.x;
                }
                if (this.checkCollision(p.x, nextY, PLAYER_W, PLAYER_H, other.x, other.y, PLAYER_W, PLAYER_H)) {
                    if (p.vy < 0 && p.y >= other.y + PLAYER_H - 1) {
                        nextY = other.y + PLAYER_H; p.vy = 0; setOnGround = true;
                    } else if (p.vy > 0 && p.y + PLAYER_H <= other.y + 1) {
                        nextY = p.y; p.vy = 0;
                    }
                }
            }

            // --- COL·LISIÓ PLATAFORMA (Nivell 2) ---
            if (this.platform) {
                const pl = this.platform;
                if (this.checkCollision(p.x, nextY, PLAYER_W, PLAYER_H, pl.x, pl.y, pl.width, pl.height)) {
                    if (p.vy < 0 && p.y >= pl.y + pl.height - 2) {
                        nextY = pl.y + pl.height; p.vy = 0; setOnGround = true;
                    }
                }
            }

            // --- COL·LISIÓ TERRA (amb suport de precipici) ---
            const overSolid = this._isOverSolidGround(nextX, PLAYER_W);
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
                p.y = 400; // cau des d'alt
                p.vx = 0; p.vy = 0; p.onGround = false;
                console.log(`[GAME] Jugador ${p.nickname} ha caigut al precipici, reapareix al principi`);
            }

            // --- TASK 13: RECOLLIR LA CLAU ---
            if (this.key && this.key.state === 'floor') {
                if (this.checkCollision(p.x, p.y, PLAYER_W, PLAYER_H, this.key.x, this.key.y, this.key.width, this.key.height)) {
                    this.key.state = 'carried';
                    this.key.carriedBy = id;
                    console.log(`[GAME] Jugador ${p.nickname} ha agafat la clau`);
                }
            }
            // La clau segueix el portador (dibuixada sobre el jugador a l'APP)
            if (this.key && this.key.state === 'carried' && this.key.carriedBy === id) {
                this.key.x = p.x + PLAYER_W * 0.5;
                this.key.y = p.y + PLAYER_H + 5;
            }

            // --- TASK 20: CLAU OBRE LA PORTA ---
            if (this.key && !this.door.isOpen && this.key.state === 'carried' && this.key.carriedBy === id) {
                if (p.x + PLAYER_W >= this.door.x - 30) {
                    this.door.isOpen = true;
                    console.log(`[GAME] Porta oberta! Jugador ${p.nickname} ha portat la clau fins a la porta`);
                    if (this.broadcastLevelEvent) this.broadcastLevelEvent('game:door_open', { openedBy: p.nickname });
                }
            }

            // --- TASK 22: DETECTAR QUE EL JUGADOR CREUA LA PORTA ---
            if (this.door.isOpen && !p.crossedDoor && p.x > this.door.x + this.door.width) {
                p.crossedDoor = true;
                this.playersAtDoor.add(id);
                console.log(`[GAME] Jugador ${p.nickname} ha creuat la porta (${this.playersAtDoor.size}/${Object.keys(this.players).length})`);
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
                setTimeout(() => this._switchToLevel2(), 3000);
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
