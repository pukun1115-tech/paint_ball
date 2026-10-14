import { map } from "./map.js";
import { sendTextFrame } from "./connection.js";
import { checkCircleCircleCollision, checkCircleRectCollision } from "./collision.js";
import {
    MESSAGE_TYPES,
    ENEMY_TEAM,
    MAP_WIDTH,
    MAP_HEIGHT,
    TILE_SIZE,
    PLAYER_RADIUS,
    BULLET_RADIUS,
    PLAYER_MAX_HP,
    PLAYER_MOVE_SPEED,
    SHOOT_COOLDOWN,
    BULLET_SPEED,
    BULLET_DAMAGE,
    PLAYER_RECOVER_HP,
    PLAYER_HP_COOLDOWN,
    PLAYER_MAX_POWER,
    PLAYER_POWER_COOLDOWN,
    PLAYER_RECOVER_POWER,
    PLAYER_SHOOT_COST,
    PLAYER_PAINT_COST,
} from "./config.js";

export class Game {
    constructor() {
        this.map = [...map];
        this.players = new Map();
        this.playerInputs = new Map();
        this.playerStates = new Map();
        this.bullets = new Set();
        this.teamPoint = { "R": 0, "B": 0 };
        this.playerCount = { "R": 0, "B": 0 };
        this.time = 0;
        this.remainingTime = 180;
        this.connections = {
            sockets: new Set(),
            playerIdsBySockets: new Map(),
            socketsByPlayerIds: new Map(),
        };

        this.resetTime = -100;
    }

    resetGame() {
        this.map = [...map];
        this.teamPoint = { "R": 0, "B": 0 };
        this.broadcast(true, null, { type: "resetMap" });
        this.broadcast(true, null, { type: "updateTeamPoint", teamPoint: this.teamPoint });
        
        for (const id of this.players.keys()) {
            const player = this.players.get(id);
            player.hp = PLAYER_MAX_HP;
            player.x = (player.team === "R" ? TILE_SIZE * 1.5 : TILE_SIZE * (MAP_WIDTH - 1.5));
            player.y = (player.team === "R" ? TILE_SIZE * 1.5 : TILE_SIZE * (MAP_HEIGHT - 1.5));
            this.broadcast(true, null, { "type": "playerRespawn", "player": player });
            const playerState = this.playerStates.get(id);
            playerState.recoverdHpTime = this.time;
            playerState.power = PLAYER_MAX_POWER;
            playerState.recoverdPowerTime = this.time;
            this.sendYourPower(this.connections.socketsByPlayerIds.get(id), plyerState.power);
        }
    }

    update() {
        if (this.time === this.resetTime) {
            this.resetGame();
        }
        if (this.remainingTime === 0) {
            this.resetGame();
        }
        for (const id of this.players.keys()) {
            const playerInput = this.playerInputs.get(id);
            if (playerInput === null || playerInput === undefined) {
                continue;
            }
            const player = this.players.get(id);
            const playerState = this.playerStates.get(id);
            const tileX = Math.floor(player.x / TILE_SIZE);
            const tileY = Math.floor(player.y / TILE_SIZE);

            if (playerInput.directionX === 0 && playerInput.directionY === 0) {
                player.directionX = 1;
                player.directionY = 0;
            } else {
                player.directionX = playerInput.directionX / Math.hypot(playerInput.directionX, playerInput.directionY);
                player.directionY = playerInput.directionY / Math.hypot(playerInput.directionX, playerInput.directionY);
            }

            if (player.hp < PLAYER_MAX_HP) {
                if (this.time - playerState.recoveredHpTime >= PLAYER_HP_COOLDOWN) {
                    player.hp = Math.min(player.hp + PLAYER_RECOVER_HP, PLAYER_MAX_HP);
                    playerState.recoveredHpTime = this.time;
                }
            }

            if (playerState.power < PLAYER_MAX_POWER) {
                if (this.time - playerState.recoveredPowerTime >= PLAYER_POWER_COOLDOWN) {
                    playerState.power = Math.min(playerState.power + PLAYER_RECOVER_POWER, PLAYER_MAX_POWER);
                    playerState.recoveredPowerTime = this.time;
                    sendTextFrame(this.connections.socketsByPlayerIds.get(id), JSON.stringify({ "type": "updateYourPower", "power": playerState.power }));
                }
            }

            player.isShooting = playerInput.isShooting;

            if (playerInput.left || playerInput.right || playerInput.up || playerInput.down) {
                const moveX = Number(playerInput.right) - Number(playerInput.left);
                const moveY = Number(playerInput.down) - Number(playerInput.up);
                const length = Math.hypot(moveX, moveY);
                if (length !== 0) {
                    const normalizedX = moveX / length;
                    const normalizedY = moveY / length;
                    const speed = this.getPlayerSpeed(player.team, tileX, tileY);
                    for (let i = 0; i < 10; i++) {
                        const nextX = player.x + normalizedX * speed / 10;
                        const nextY = player.y + normalizedY * speed / 10;
                        if (!this.checkPlayerWallCollision(nextX, player.y)) {
                            player.x = nextX;
                        }
                        if (!this.checkPlayerWallCollision(player.x, nextY)) {
                            player.y = nextY;
                        }
                    }
                }
            }

            if (playerInput.isPainting) {
                if (playerState.power >= PLAYER_PAINT_COST) {
                    const painted = this.paintTile(player.team, tileX, tileY);
                    if (painted) {
                        playerState.power -= PLAYER_PAINT_COST;
                        playerState.recoveredPowerTime = this.time;
                        this.sendYourPower(this.connections.socketsByPlayerIds.get(id), playerState.power);
                    }
                }
            }

            if (playerInput.isShooting) {
                if (this.time - playerState.shootedTime >= SHOOT_COOLDOWN && playerState.power >= PLAYER_SHOOT_COST) {
                    playerState.power -= PLAYER_SHOOT_COST;
                    playerState.recoveredPowerTime = this.time;
                    this.sendYourPower(this.connections.socketsByPlayerIds.get(id), playerState.power);
                    const bullet = {
                        id: id,
                        x: player.x + player.directionX * PLAYER_RADIUS,
                        y: player.y + player.directionY * PLAYER_RADIUS,
                        directionX: player.directionX,
                        directionY: player.directionY,
                        team: player.team,
                        hasHit: false,
                    };
                    this.bullets.add(bullet);
                    playerState.shootedTime = this.time;
                    player.shooted = true;
                    setTimeout(() => {
                        player.shooted = false;
                    }, 50);
                }
            }
        }

        for (const bullet of this.bullets) {
            if (bullet.hasHit) {
                this.bullets.delete(bullet);
                if (this.map[Math.floor(bullet.y / TILE_SIZE)][Math.floor(bullet.x / TILE_SIZE)] !== "#") {
                    this.paintTile(bullet.team, Math.floor(bullet.x / TILE_SIZE), Math.floor(bullet.y / TILE_SIZE));
                }
                continue;
            }
            let hasHit = false;
            for (let i = 0; i < 20; i++) {
                bullet.x += bullet.directionX * BULLET_SPEED / 20;
                bullet.y += bullet.directionY * BULLET_SPEED / 20;
                if (this.checkBulletWallCollision(bullet.x, bullet.y)) {
                    bullet.hasHit = true;
                    break;
                }

                for (const p of this.players.values()) {
                    if (p.team !== bullet.team && this.checkBulletPlayerCollision(bullet, p)) {
                        p.hp -= BULLET_DAMAGE;
                        if (p.hp <= 0) {
                            this.broadcast(true, null, { "type": "playerDied", "died": p.id, "killer": bullet.id });
                            p.hp = PLAYER_MAX_HP;
                            p.x = (p.team === "R" ? TILE_SIZE * 1.5 : TILE_SIZE * (MAP_WIDTH - 1.5));
                            p.y = (p.team === "R" ? TILE_SIZE * 1.5 : TILE_SIZE * (MAP_HEIGHT - 1.5));
                            this.broadcast(true, null, { "type": "playerRespawn", "player": p });
                            this.playerStates.get(p.id).power = PLAYER_MAX_POWER;
                            this.playerStates.get(p.id).recoveredPowerTime = this.time;
                            this.sendYourPower(this.connections.socketsByPlayerIds.get(p.id), this.playerStates.get(p.id).power);
                        }
                        bullet.hasHit = true;
                        hasHit = true;
                        break;
                    }
                }
                if (hasHit) {
                    break;
                }
            }
        }
        this.broadcast(true, null, { "type": "updatePlayers", "players": Array.from(this.players.values()) });
        this.broadcast(true, null, { "type": "updateBullets", "bullets": Array.from(this.bullets.values()) });
        this.tick();
    }

    tick() {
        this.time++;
        if (this.time % 60 === 0) {
            this.remainingTime--;
            this.broadcast(true, null, { "type": "updateRemainingTime", "remainingTime": this.remainingTime });
        }
    }

    getPlayerSpeed(team, tileX, tileY) {
        return (this.map[tileY][tileX] === "." ? PLAYER_MOVE_SPEED["neutral"] : (this.map[tileY][tileX] === team ? PLAYER_MOVE_SPEED["own"] : PLAYER_MOVE_SPEED["enemy"]));
    }

    processReceivedText(socket, text) {
        let message;
        try {
            message = JSON.parse(text);
        } catch (error) {
            throw new Error("Invalid JSON");
        }

        if (message.type === null || message.type === undefined) {
            throw new Error("Invalid text: missing type");
        }

        if (MESSAGE_TYPES[message.type] === null || MESSAGE_TYPES[message.type] === undefined) {
            throw new Error(`Invalid text: unknown message type ${message.type}`);
        }

        for (const key of MESSAGE_TYPES[message.type]) {
            if (message[key] === null || message[key] === undefined) {
                throw new Error(`Invalid text: missing ${key}`);
            }
        }

        if (message.type === "chat") {
            if (message.message === "/reset") {
                this.resetTime = this.time + 300;
                this.broadcast(true, null, { type: "chat", message: "サーバーの300フレーム後にリセットされます。" });
                return;
            }
            const playerId = this.connections.playerIdsBySockets.get(socket);
            if (playerId !== undefined) {
                this.broadcast(true, null, { type: "chat", message: `${playerId}: ${message.message}` });
            }
        } else if (message.type === "input") {
            const playerId = this.connections.playerIdsBySockets.get(socket);
            if (playerId !== undefined) {
                this.playerInputs.set(playerId, message);
            }
        }
    }

    broadcast(isAll, socket, message) {
        const text = JSON.stringify(message);

        for (const s of this.connections.sockets) {
            if (isAll || s !== socket) {
                sendTextFrame(s, text);
            }
        }
    }

    createPlayerId() {
        const f = Math.random().toString(36).substring(2, 2 + 6);
        return f.charAt(0).toUpperCase() + f.slice(1);
    }

    createNewPlayer(socket) {
        const playerId = this.createPlayerId();
        let playerTeam;
        if (this.playerCount["R"] === this.playerCount["B"]) {
            playerTeam = (Math.random() > 0.5 ? "R" : "B");
        } else {
            playerTeam = (this.playerCount["R"] > this.playerCount["B"] ? "B" : "R");
        }

        const player = {
            id: playerId,
            hp: PLAYER_MAX_HP,
            team: playerTeam,
            x: (playerTeam === "R" ? TILE_SIZE * 1.5 : TILE_SIZE * (MAP_WIDTH - 1.5)),
            y: (playerTeam === "R" ? TILE_SIZE * 1.5 : TILE_SIZE * (MAP_HEIGHT - 1.5)),
            isPainting: false,
            isShooting: false,
            directionX: 1,
            directionY: 0,
        };
        this.addPlayer(socket, player);
    }

    addPlayer(socket, player) {
        this.connections.sockets.add(socket);
        this.connections.playerIdsBySockets.set(socket, player.id);
        this.connections.socketsByPlayerIds.set(player.id, socket);
        this.players.set(player.id, player);
        this.playerCount[player.team]++;
        this.playerInputs.set(player.id, {
            up: false,
            down: false,
            left: false,
            right: false,
            isPainting: false,
            isShooting: false,
            directionX: 1,
            directionY: 0,
        });

        this.playerStates.set(player.id, {
            shootedTime: this.time,
            paintedTime: this.time,
            recoveredHpTime: this.time,
            power: PLAYER_MAX_POWER,
            recoveredPowerTime: this.time,

        });
        
        sendTextFrame(socket, JSON.stringify({
            type: "init",
            playerId: player.id,
            map: this.map,
            players: Array.from(this.players.values()),
            bullets: Array.from(this.bullets),
            teamPoint: this.teamPoint,
        }));
        this.sendYourPower(socket, this.playerStates.get(player.id).power);
        this.broadcast(false, socket, { type: "playerJoined", player: player });
    }

    sendYourPower(socket, power) {
        sendTextFrame(socket, JSON.stringify({ "type": "updateYourPower", "power": power }));
    }

    removePlayer(socket) {
        const playerId = this.connections.playerIdsBySockets.get(socket);
        if (playerId === undefined) {
            return;
        }

        const team = this.players.get(playerId)?.team;
        if (team !== undefined) {
            this.playerCount[team]--;
        }
        this.connections.sockets.delete(socket);
        this.connections.playerIdsBySockets.delete(socket);
        this.connections.socketsByPlayerIds.delete(playerId);
        this.players.delete(playerId);
        this.playerInputs.delete(playerId);
        this.playerStates.delete(playerId);
        this.broadcast(false, socket, { type: "playerLeft", id: playerId });
    }

    paintTile(color, tileX, tileY) {
        if (this.map[tileY][tileX] === color || this.map[tileY][tileX] === "#") {
            return false;
        }
        const nowStr = this.map[tileY];
        const newStr = nowStr.slice(0, tileX) + color + nowStr.slice(tileX + 1);
        if (this.map[tileY][tileX] === ".") {
            this.map[tileY] = newStr;
            this.broadcast(true, null, { "type": "updateMap", "color": color, "tileX": tileX, "tileY": tileY });
        } else if (this.map[tileY][tileX] === ENEMY_TEAM[color]) {
            this.map[tileY] = newStr;
            this.teamPoint[ENEMY_TEAM[color]]--;
            this.broadcast(true, null, { "type": "updateMap", "color": color, "tileX": tileX, "tileY": tileY });
        }
        this.teamPoint[color]++;
        this.broadcast(true, null, { "type": "updateTeamPoint", "teamPoint": this.teamPoint });
        return true;
    }

    checkPlayerWallCollision(nx, ny) {
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                if (this.map[y][x] === "#") {
                    if (checkCircleRectCollision({ x: nx, y: ny, r: PLAYER_RADIUS }, { left: x * TILE_SIZE, right: (x + 1) * TILE_SIZE, top: y * TILE_SIZE, bottom: (y + 1) * TILE_SIZE })) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    checkBulletWallCollision(nx, ny) {
        for (let y = 0; y < MAP_HEIGHT; y++) {
            for (let x = 0; x < MAP_WIDTH; x++) {
                if (this.map[y][x] === "#") {
                    if (checkCircleRectCollision({ x: nx, y: ny, r: BULLET_RADIUS }, { left: x * TILE_SIZE, right: (x + 1) * TILE_SIZE, top: y * TILE_SIZE, bottom: (y + 1) * TILE_SIZE })) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    checkBulletPlayerCollision(bullet, player) {
        return checkCircleCircleCollision({ x: bullet.x, y: bullet.y, r: BULLET_RADIUS }, { x: player.x, y: player.y, r: PLAYER_RADIUS });
    }
}
