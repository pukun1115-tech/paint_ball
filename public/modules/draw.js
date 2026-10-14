import {
    PLAYER_MAX_HP,
    PLAYER_MAX_POWER,
    TILE_SIZE,
    PLAYER_RADIUS,
    BULLET_RADIUS,
    MAP_WIDTH,
    MAP_HEIGHT
} from "./config.js";

export function drawMap(ctx, you, map) {
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (map[y][x] === ".") {
                ctx.fillStyle = "rgba(0, 0, 0, 1)";
            } else if (map[y][x] === "#") {
                ctx.fillStyle = "rgba(127, 127, 127, 1)";
            } else if (map[y][x] === "R") {
                ctx.fillStyle = "rgba(127, 0, 0, 1)";
            } else if (map[y][x] === "G") {
                ctx.fillStyle = "rgba(0, 127, 0, 1)";
            } else if (map[y][x] === "B") {
                ctx.fillStyle = "rgba(0, 0, 127, 1)";
            }
            ctx.fillRect((x * TILE_SIZE) - you.x + centerX - 1, (y * TILE_SIZE) - you.y + centerY - 1, TILE_SIZE + 1, TILE_SIZE + 1);
        }
    }
}

export function drawBullets(ctx, you, bullets) {
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    for (const b of bullets) {
        ctx.fillStyle = (b.team === "R" ? "rgba(255, 0, 0, 1)" : "rgba(0, 0, 255, 1)");
        ctx.lineWidth = BULLET_RADIUS / 4;
        ctx.strokeStyle = "rgba(255, 255, 255, 1)";
        ctx.beginPath();
        ctx.arc((b.x - you.x) + centerX, (b.y - you.y) + centerY, BULLET_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
}

export function drawPlayers(ctx, you, players) {
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    for (const p of players.keys()) {
        ctx.strokeStyle = (players.get(p).team === "R" ? "rgba(255, 0, 0, 1)" : "rgba(0, 0, 255, 1)");
        ctx.lineWidth = 4;

        const playerCenterX = (players.get(p).x - you.x) + centerX;
        const playerCenterY = (players.get(p).y - you.y) + centerY;

        ctx.beginPath();
        ctx.arc(playerCenterX, playerCenterY, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.stroke();

        if (players.get(p).isShooting) {
            ctx.lineWidth = PLAYER_RADIUS * 3 / 8;
        }

        ctx.beginPath();
        ctx.moveTo(playerCenterX, playerCenterY);
        ctx.lineTo(playerCenterX + players.get(p).directionX * PLAYER_RADIUS, playerCenterY + players.get(p).directionY * PLAYER_RADIUS);
        ctx.stroke();

        if (players.get(p).shooted) {
            ctx.fillStyle = "rgba(255, 255, 0, 0.8)";
            ctx.beginPath();
            ctx.arc(playerCenterX + players.get(p).directionX * PLAYER_RADIUS, playerCenterY + players.get(p).directionY * PLAYER_RADIUS, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.strokeStyle = "rgba(255, 255, 255, 1)";
        ctx.lineWidth = 1;
        ctx.strokeRect(playerCenterX - PLAYER_RADIUS, playerCenterY - PLAYER_RADIUS * 2, PLAYER_RADIUS * 2, PLAYER_RADIUS / 2);

        if (players.get(p).hp >= PLAYER_MAX_HP * 0.6) {
            ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
        } else if (players.get(p).hp >= PLAYER_MAX_HP * 0.2) {
            ctx.fillStyle = "rgba(255, 255, 0, 0.5)";
        } else {
            ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
        }
        const hpWidth = Math.max(0, Math.min(PLAYER_RADIUS * 2, PLAYER_RADIUS * 2 * (players.get(p).hp / PLAYER_MAX_HP)));
        ctx.fillRect(playerCenterX - PLAYER_RADIUS, playerCenterY - PLAYER_RADIUS * 2, hpWidth, PLAYER_RADIUS / 2);
    }
}

export function drawTeamPoint(ctx, teamPoint) {
    const centerX = ctx.canvas.width / 2;
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "rgba(255, 0, 0, 1)";
    ctx.fillRect(centerX - 56, 12, 48, 24);
    ctx.fillStyle = "rgba(0, 0, 255, 1)";
    ctx.fillRect(centerX + 8, 12, 48, 24);

    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.fillText(teamPoint["R"], centerX - 32, 24);
    ctx.fillText(teamPoint["B"], centerX + 32, 24);
}

export function drawMyPower(ctx, myPower) {
    ctx.strokeStyle = "rgba(255, 255, 255, 1)";
    ctx.lineWidth = 2;
    if (myPower >= PLAYER_MAX_POWER * 0.6) {
        ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
    } else if (myPower >= PLAYER_MAX_POWER * 0.2) {
        ctx.fillStyle = "rgba(255, 255, 0, 0.5)";
    } else {
        ctx.fillStyle = "rgba(255, 0, 0, 0.5)";
    }
    ctx.strokeRect(ctx.canvas.width - 32, ctx.canvas.height - 128, 24, 120);
    const powerHeight = Math.max(0, Math.min(120, 120 * (myPower / PLAYER_MAX_POWER)));
    ctx.fillRect(ctx.canvas.width - 32, ctx.canvas.height - 8 - powerHeight, 24, powerHeight);
}

export function drawRemainingTime(ctx, time) {
    ctx.fillStyle = "rgba(191, 191, 191, 1)";
    ctx.fillRect(8, 8, 120, 24);
    
    ctx.fillStyle = "rgba(255, 255, 255, 1)";
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(Math.floor(time / 60) + ((time % 60) < 10 ? ":0" + (time % 60) : ":" + (time % 60)), 68, 20);
}
