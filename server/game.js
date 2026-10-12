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
        this.connections = {
            sockets: new Set(),
            playerIdsBySockets: new Map(),
        };
    }

    update() {
        for (const id of this.players.keys()) {
            const playerInput = this.playerInputs.get(id);
            if (playerInput === null || playerInput === undefined) {
                continue;
            }
            const player = this.players.get(id);
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
                if (this.time - this.playerStates.get(id).recoveredTime >= PLAYER_HP_COOLDOWN) {
                    player.hp = Math.min(player.hp + PLAYER_RECOVER_HP, PLAYER_MAX_HP);
                    this.playerStates.get(id).recoveredTime = this.time;
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
                if (this.map[tileY][tileX] === ".") {
                    this.paintTile(player.team, tileX, tileY);
                    this.teamPoint[player.team]++;
                } else if (this.map[tileY][tileX] === ENEMY_TEAM[player.team]) {
                    this.paintTile(player.team, tileX, tileY);
                    this.teamPoint[player.team]++;
                    this.teamPoint[ENEMY_TEAM[player.team]]--;
                }
            }

            if (playerInput.isShooting) {
                if (this.time - this.playerStates.get(id).shootedTime >= SHOOT_COOLDOWN) {
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
                    this.playerStates.get(id).shootedTime = this.time;
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

                for (const player of this.players.values()) {
                    if (player.team !== bullet.team && this.checkBulletPlayerCollision(bullet, player)) {
                        player.hp -= BULLET_DAMAGE;
                        if (player.hp <= 0) {
                            this.broadcast(true, null, { "type": "playerDied", "died": player.id, "killer": bullet.id });
                            player.hp = PLAYER_MAX_HP;
                            player.x = (player.team === "R" ? TILE_SIZE * 1.5 : TILE_SIZE * (MAP_WIDTH - 1.5));
                            player.y = (player.team === "R" ? TILE_SIZE * 1.5 : TILE_SIZE * (MAP_HEIGHT - 1.5));
                            this.broadcast(true, null, { "type": "playerRespawn", "player": player });
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
        this.broadcast(true, null, { "type": "updateMap", "map": this.map });
        this.broadcast(true, null, { "type": "updateTeamPoint", "teamPoint": this.teamPoint });
        this.tick();
    }

    tick() {
        this.time++;
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
        this.players.set(player.id, player);
        this.connections.playerIdsBySockets.set(socket, player.id);
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
            recoveredTime: this.time,
        });
        sendTextFrame(socket, JSON.stringify({
            type: "init",
            playerId: player.id,
            map: this.map,
            players: Array.from(this.players.values()),
            bullets: Array.from(this.bullets),
            teamPoint: this.teamPoint,
        }));
        this.broadcast(false, socket, { type: "playerJoined", player: player });
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
        this.players.delete(playerId);
        this.playerInputs.delete(playerId);
        this.connections.playerIdsBySockets.delete(socket);
        this.broadcast(false, socket, { type: "playerLeft", id: playerId });
    }

    paintTile(color, tileX, tileY) {
        const nowStr = this.map[tileY];
        const newStr = nowStr.slice(0, tileX) + color + nowStr.slice(tileX + 1);
        this.map[tileY] = newStr;
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