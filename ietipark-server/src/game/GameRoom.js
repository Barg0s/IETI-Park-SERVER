class GameRoom {
    constructor() {
        this.players = {};
        this.currentLevel = 1;
        this.playersAtDoor = new Set();
        this.levelTransitioning = false;

        // === CONFIGURACIÓ DELS NIVELLS (Ajustado para Sprites 64x64) ===
        this.levelConfigs = {
            1: {
                groundY: 160,
                worldWidth: 992,
                spawnX: 32,
                spawnY: 160,
                precipice: null,
                platform: null,
                door: { x: 288, y: 160, width: 32, height: 160, isOpen: false },
                key: { x: 216, y: 340, width: 21, height: 47, state: 'floor', carriedBy: null },
                obstacle: { x: 285, y: 160, width: 20, height: 33 },
            },
            2: {
                groundY: 160,
                worldWidth: 992,
                spawnX: 32,
                spawnY: 160,
                // Precipici: Buit real del tilemap (columnes 10 a 20) -> x=320 fins x=672 (Amplada=352)
                precipice: { x: 320, y: 0, width: 352, height: 160 },
                // Plataforma: "Ferry" que es mou de banda a banda
                platform: { x: 480, y: 192, width: 128, height: 32, moving: false, speed: 100, direction: 1, minX: 320, maxX: 544 },
                // Botó: A l'altra banda del precipici (dreta)
                button: { x: 680, y: 160, width: 32, height: 32, pressed: false },
                // Obstacle: Com al nivell 1, enganxat a la porta
                obstacle: { x: 893, y: 160, width: 20, height: 33 },
                // Clau alta: y=340 (requereix stacking + jump)
                key: { x: 750, y: 340, width: 21, height: 47, state: 'floor', carriedBy: null },
                // Porta a la columna 28 del tilemap
                door: { x: 896, y: 160, width: 32, height: 160, isOpen: false }
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
        // Botó de la plataforma mòbil (Nivell 2)
        this.button = cfg.button ? { ...cfg.button } : null;
        this._partidaInici = Date.now(); // Marca el inici del nivell per a les estadístiques
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

    // FIX #15: Permite salto diagonal (moverse y saltar a la vez)
    updatePlayerInputs(id, directionEnum) {
        const player = this.players[id];
        if (!player) return;

        const dir = (directionEnum || 'none').toLowerCase().trim();

        // Si el cliente envía 'none' (al soltar un botón), limpiamos todo.
        if (dir === 'none') {
            player.inputs.left = false;
            player.inputs.right = false;
            player.inputs.jump = false;
            return;
        }

        // Si es movimiento horizontal, actualizamos solo el eje X
        if (dir.includes('left')) {
            player.inputs.left = true;
            player.inputs.right = false;
        } else if (dir.includes('right')) {
            player.inputs.right = true;
            player.inputs.left = false;
        }

        // Si es salto, activamos el salto SIN borrar el eje X
        if (dir.includes('up') || dir.includes('jump')) {
            player.inputs.jump = true;
        }
    }

    startGameLoop() {
        setInterval(() => {
            const now = Date.now();
            // FIX #13: Cap reducido a 33ms (~30fps) para evitar tunneling con menos margen de error
            const delta = Math.min((now - this.lastTime) / 1000, 0.033);
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
        if (this.platform) state.platform = { ...this.platform, x: parseFloat(this.platform.x.toFixed(1)) };
        if (this.precipice) state.precipice = this.precipice;
        if (this.button) state.button = this.button;
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

        // --- LÓGICA DE PLATAFORMA OSCILANTE (Nivell 2) ---
        let platformDx = 0;
        if (this.platform && this.platform.moving) {
            platformDx = this.platform.speed * this.platform.direction * delta;
            this.platform.x += platformDx;

            if (this.platform.x >= this.platform.maxX) {
                this.platform.x = this.platform.maxX;
                this.platform.direction = -1;
            } else if (this.platform.x <= this.platform.minX) {
                this.platform.x = this.platform.minX;
                this.platform.direction = 1;
            }
        }

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

            // Mover al jugador con la plataforma si está apoyado en ella
            if (this.platform && platformDx !== 0 && p.onGround) {
                const platformTop = this.platform.y + this.platform.height;
                // Verificamos si estaba exactamente en la cima de la plataforma (margen pequeño por floats)
                if (Math.abs(p.y - platformTop) < 0.1) {
                    // Verificamos si estaba sobre la plataforma horizontalmente (usando las coordenadas antes de que la plataforma se moviera, aprox)
                    if (p.x + PLAYER_W > this.platform.x - platformDx && p.x < this.platform.x - platformDx + this.platform.width) {
                        nextX += platformDx;
                    }
                }
            }

            // --- COL·LISIÓ PORTA TANCADA (separación de ejes estricta) ---
            if (!this.door.isOpen) {
                const door = this.door;
                const blockingHeight = 2000; // FIX: Pared invisible infinita hacia arriba para evitar que se salten la puerta apilándose

                // Primero resolvemos el eje X (el más importante: evitar atravesar lateralmente)
                // Usamos blockingHeight para que la pared llegue hasta el cielo
                const colX = this.checkCollision(nextX, p.y, PLAYER_W, PLAYER_H, door.x, door.y, door.width, blockingHeight);
                if (colX) {
                    const pCenterX = p.x + PLAYER_W / 2;
                    const dCenterX = door.x + door.width / 2;
                    if (pCenterX < dCenterX) {
                        nextX = door.x - PLAYER_W;
                    } else {
                        nextX = door.x + door.width;
                    }
                    p.vx = 0;
                }

                // Después resolvemos el eje Y usando nextX ya corregido
                const colY = this.checkCollision(nextX, nextY, PLAYER_W, PLAYER_H, door.x, door.y, door.width, door.height);
                if (colY) {
                    const pCenterY = p.y + PLAYER_H / 2;
                    const dCenterY = door.y + door.height / 2;
                    if (pCenterY > dCenterY) {
                        nextY = door.y + door.height;
                        p.vy = 0;
                        setOnGround = true;
                    } else {
                        nextY = door.y - PLAYER_H;
                        p.vy = 0;
                    }
                }
            }

            // --- COLISIONES CON PAREDES DEL PRECIPICIO ---
            // Evita el bug del "teleport" al caer: si estás debajo del suelo, no puedes volver a entrar a la tierra
            if (this.precipice && p.y < GROUND_Y) {
                // Pared izquierda (bloque sólido antes del precipicio)
                if (this.checkCollision(nextX, p.y, PLAYER_W, PLAYER_H, -1000, -1000, 1000 + this.precipice.x, 1000 + GROUND_Y)) {
                    if (p.vx < 0) { nextX = this.precipice.x; p.vx = 0; }
                }
                // Pared derecha (bloque sólido después del precipicio)
                if (this.checkCollision(nextX, p.y, PLAYER_W, PLAYER_H, this.precipice.x + this.precipice.width, -1000, 2000, 1000 + GROUND_Y)) {
                    if (p.vx > 0) { nextX = this.precipice.x + this.precipice.width - PLAYER_W; p.vx = 0; }
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

                // FIX #4: Eje Y ahora usa nextX (posición horizontal ya resuelta)
                if (this.checkCollision(nextX, nextY, PLAYER_W, PLAYER_H, other.x, other.y, PLAYER_W, PLAYER_H)) {
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
            // FIX #2 + #5: Plataforma one-way (solo colisiona desde arriba) y usa nextX
            if (this.platform) {
                const pl = this.platform;
                const platformTop = pl.y + pl.height; // Borde superior de la plataforma (Y-up)
                if (this.checkCollision(nextX, nextY, PLAYER_W, PLAYER_H, pl.x, pl.y, pl.width, pl.height)) {
                    // Solo aterriza si los pies del jugador estaban sobre (o al nivel de) la plataforma
                    // y está cayendo (vy <= 0 en Y-up con gravedad negativa)
                    if (p.y >= platformTop && p.vy <= 0) {
                        nextY = platformTop;
                        p.vy = 0;
                        setOnGround = true;
                    }
                    // Si viene de abajo, pasa a través (plataforma one-way)
                }
            }

            // --- COL·LISIÓ TERRA ---
            // FIX #1: _isOverSolidGround ahora usa el centro del jugador para evitar el snap en el borde
            const overSolid = this._isOverSolidGround(nextX, PLAYER_W);
            if (nextY <= GROUND_Y && overSolid) {
                nextY = GROUND_Y; p.vy = 0; setOnGround = true;
            }
            // FIX #6: Eliminado el bloque "else if (!setOnGround) { setOnGround = false; }" que era código muerto

            p.x = nextX;
            p.y = nextY;
            p.onGround = setOnGround;

            // --- LÍMITES DEL MUNDO Y PRECIPICIO ---
            if (p.x < 0) p.x = 0;
            if (p.x > cfg.worldWidth - PLAYER_W) p.x = cfg.worldWidth - PLAYER_W;

            // Nivell 2: caiguda al precipici → reaparèixer al principi
            // Cae completamente por debajo de la pantalla (y < -64) antes de respawnear
            if (this.currentLevel === 2 && p.y < -64) {
                const spawnOffset = Object.keys(this.players).indexOf(id) * 40;
                p.x = cfg.spawnX + spawnOffset;
                p.y = 400; // Caen desde el cielo de forma escalonada (spawnOffset) para evitar atascarse
                p.vx = 0; p.vy = 0; p.onGround = false;
            }

            // --- TASK 27: BOTÓN PLATAFORMA MÓVIL ---
            if (this.button && !this.button.pressed) {
                if (this.checkCollision(p.x, p.y, PLAYER_W, PLAYER_H, this.button.x, this.button.y, this.button.width, this.button.height)) {
                    this.button.pressed = true;
                    if (this.platform) this.platform.moving = true; // Activa el movimiento
                    console.log(`[GAME] ${p.nickname} ha pulsado el botón! La plataforma se mueve.`);
                }
            }

            // --- TASK 13/26: RECOLLIR LA CLAU ---
            if (this.key && this.key.state === 'floor') {
                if (this.checkCollision(p.x, p.y, PLAYER_W, PLAYER_H, this.key.x, this.key.y, this.key.width, this.key.height)) {
                    this.key.state = 'carried';
                    this.key.carriedBy = id;
                }
            }

            // FIX #9: La llave aparece justo encima de la cabeza del jugador (Y-up: cabeza = p.y + PLAYER_H)
            if (this.key && this.key.state === 'carried' && this.key.carriedBy === id) {
                this.key.x = p.x + (PLAYER_W / 2) - (this.key.width / 2); // Centrada horizontalmente
                this.key.y = p.y + PLAYER_H;                               // Justo encima de la cabeza
            }

            // --- TASK 20: CLAU OBRE LA PORTA ---
            // FIX #7: Ahora también verifica que el jugador esté a la altura de la puerta (eje Y)
            if (this.key && !this.door.isOpen && this.key.state === 'carried' && this.key.carriedBy === id) {
                const nearDoorX = p.x + PLAYER_W >= this.door.x - 10;
                const nearDoorY = p.y < this.door.y + this.door.height && p.y + PLAYER_H > this.door.y;
                if (nearDoorX && nearDoorY) {
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

    // FIX #1: Usa el centro horizontal del jugador en lugar del borde para determinar si hay suelo sólido.
    // Esto elimina el snap/teleport que ocurría cuando un pixel del borde rozaba el precipicio.
    _isOverSolidGround(playerX, playerW) {
        if (!this.precipice) return true;
        const centerX = playerX + playerW / 2;
        return !(centerX > this.precipice.x && centerX < this.precipice.x + this.precipice.width);
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
                setTimeout(() => this._switchToLevel2(), 1000);
            } else {
                if (this.broadcastLevelEvent) this.broadcastLevelEvent('game:victory', { message: 'Tots els jugadors han completat el joc!' });
            }
        }
    }

    // Task 22/23: canvi a Nivell 2
    _switchToLevel2() {
        console.log('[GAME] Canviant a Nivell 2...');
        this._initLevel(2);
        let i = 0;
        for (let id in this.players) {
            const p = this.players[id];
            p.x = 30 + i * 40; p.y = 400;
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