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
                // Mundo de 32 columnas * 32px = 1024px de ancho, 16 filas * 32px = 512 de alto
                groundY: 160,       // fila 11 del tilemap: Y = (16-1-11)*32 = 160 (LibGDX Y-up)
                worldWidth: 992,    // 31 tiles * 32px (limite derecho)
                spawnX: 32,         // Columna 1 del tilemap
                spawnY: 160,
                precipice: null,
                platform: null,
                // Puerta en columna 9 del tilemap: x = 9*32 = 288, filas 5-10 (desde arriba)
                // En LibGDX Y-up: top de la puerta = (16-1-5)*32 = 320, bottom = (16-1-10)*32 = 160
                // --> door.y = 160 (empieza en el suelo), door.height = 160 (5 tiles * 32px)
                door: { x: 288, y: 160, width: 32, height: 160, isOpen: false },
                // Llave: en game_data.json sprites: x=216, y=239 (editor Y-down)
                // En LibGDX Y-up: y = 512 - 239 - 47 = 226. Pero simplificamos al nivel del suelo + un poco.
                key: { x: 216, y: 192, width: 21, height: 47, state: 'floor', carriedBy: null },
                // Candado: en game_data.json: x=285, y=335 (editor Y-down)
                // En LibGDX Y-up: y = 512 - 335 - 33 = 144. Esta por debajo del suelo, usamos encima del suelo.
                obstacle: { x: 285, y: 160, width: 20, height: 33 },
            },
            2: {
                groundY: 160,
                worldWidth: 992,
                spawnX: 32,
                spawnY: 160,
                precipice: { x: 350, y: 0, width: 100, height: 160 },
                platform: { x: 370, y: 192, width: 96, height: 32 },
                obstacle: null,
                key: null,
                door: { x: 288, y: 160, width: 32, height: 160, isOpen: false }
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
        const P_SPEED = 120;
        const GRAVITY = -400;
        const JUMP_POWER = 300;
        const PLAYER_W = 32;
        const PLAYER_H = 58;
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

            // --- COL·LISIÓ PORTA TANCADA (separación de ejes estricta) ---
            if (!this.door.isOpen) {
                const door = this.door;

                // Primero resolvemos el eje X (el más importante: evitar atravesar lateralmente)
                const colX = this.checkCollision(nextX, p.y, PLAYER_W, PLAYER_H, door.x, door.y, door.width, door.height);
                if (colX) {
                    // Empuje estricto: calcula desde qué lado viene el jugador
                    const pCenterX = p.x + PLAYER_W / 2;
                    const dCenterX = door.x + door.width / 2;
                    if (pCenterX < dCenterX) {
                        // Viene de la izquierda → pararle en el borde izquierdo de la puerta
                        nextX = door.x - PLAYER_W;
                    } else {
                        // Viene de la derecha → pararle en el borde derecho de la puerta
                        nextX = door.x + door.width;
                    }
                    p.vx = 0;
                }

                // Después resolvemos el eje Y (colisión vertical: pisar encima o golpear el suelo)
                const colY = this.checkCollision(p.x, nextY, PLAYER_W, PLAYER_H, door.x, door.y, door.width, door.height);
                if (colY) {
                    const pCenterY = p.y + PLAYER_H / 2;
                    const dCenterY = door.y + door.height / 2;
                    if (pCenterY > dCenterY) {
                        // Jugador cae sobre la puerta desde arriba
                        nextY = door.y + door.height;
                        p.vy = 0;
                        setOnGround = true;
                    } else {
                        // Jugador salta y choca por debajo del dintel
                        nextY = door.y - PLAYER_H;
                        p.vy = 0;
                    }
                }
            }

            // --- COL·LISIONS ENTRE JUGADORS (apilament) ---
            for (let otherId in this.players) {
                if (id === otherId) continue;
                const other = this.players[otherId];

                // Eje X
                if (this.checkCollision(nextX, p.y, PLAYER_W, PLAYER_H, other.x, other.y, PLAYER_W, PLAYER_H)) {
                    const pCX = p.x + PLAYER_W / 2;
                    const oCX = other.x + PLAYER_W / 2;
                    nextX = pCX < oCX ? other.x - PLAYER_W : other.x + PLAYER_W;
                    p.vx = 0;
                }

                // Eje Y
                if (this.checkCollision(p.x, nextY, PLAYER_W, PLAYER_H, other.x, other.y, PLAYER_W, PLAYER_H)) {
                    const pCY = p.y + PLAYER_H / 2;
                    const oCY = other.y + PLAYER_H / 2;
                    if (pCY > oCY) {
                        // Cae encima
                        nextY = other.y + PLAYER_H;
                        p.vy = 0;
                        setOnGround = true;
                    } else {
                        // Salta y golpea por abajo
                        nextY = other.y - PLAYER_H;
                        p.vy = 0;
                    }
                }
            }

            // --- COL·LISIÓ PLATAFORMA (Nivell 2) ---
            if (this.platform) {
                const pl = this.platform;
                if (this.checkCollision(p.x, nextY, PLAYER_W, PLAYER_H, pl.x, pl.y, pl.width, pl.height)) {
                    if (p.y >= pl.y) {
                        nextY = pl.y + pl.height; p.vy = 0; setOnGround = true;
                    }
                }
            }

            // --- COL·LISIÓ TERRA ---
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
                p.y = 400;
                p.vx = 0; p.vy = 0; p.onGround = false;
            }

            // --- TASK 13: RECOLLIR LA CLAU ---
            if (this.key && this.key.state === 'floor') {
                if (this.checkCollision(p.x, p.y, PLAYER_W, PLAYER_H, this.key.x, this.key.y, this.key.width, this.key.height)) {
                    this.key.state = 'carried';
                    this.key.carriedBy = id;
                }
            }

            if (this.key && this.key.state === 'carried' && this.key.carriedBy === id) {
                this.key.x = p.x + (PLAYER_W / 2) - (this.key.width / 2); // Centrada sobre el jugador
                this.key.y = p.y + PLAYER_H + 5;  // Encima de la cabeza
            }

            // --- TASK 20: CLAU OBRE LA PORTA ---
            if (this.key && !this.door.isOpen && this.key.state === 'carried' && this.key.carriedBy === id) {
                if (p.x + PLAYER_W >= this.door.x - 10) {
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
