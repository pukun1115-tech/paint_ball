import path from "node:path";

export const DEFAULT_PATH = path.resolve(import.meta.dirname, "../");
export const PORT = Number(process.env.PORT ?? 3000);
export const isLocal = (process.env.PORT === undefined);
export const MIME_TYPES = {
    ".txt": "text/plain; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".ico": "image/x-icon",
};

export const TEXT_OPCODE = 0b00000001;
export const CLOSE_OPCODE = 0b00001000;

export const MAX_BUFFER_SIZE = 512 * 512;

export const MESSAGE_TYPES = {
    "chat": ["type", "id", "message"],
    "input": ["type", "id", "up", "down", "left", "right", "directionX", "directionY", "isPainting", "isShooting"],
};

export const PUBLIC_FILES = [
    "/images/favicon.ico",
    "/index.html",
    "/style.css",
    "/modules/chat.js",
    "/modules/draw.js",
    "/modules/config.js",
    "/script.js",
];

export const PLAYER_MAX_HP = 100;
export const PLAYER_HP_COOLDOWN = 30;
export const PLAYER_RECOVER_HP = 1;
export const PLAYER_MOVE_SPEED = { own: 6, neutral: 4, enemy: 3 };
export const TILE_SIZE = 64;
export const PLAYER_RADIUS = 16;
export const BULLET_RADIUS = 4;
export const ENEMY_TEAM = { R: "B", B: "R" };
export const SHOOT_COOLDOWN = 10;
export const BULLET_SPEED = 48;
export const BULLET_DAMAGE = 5;

export const MAP_WIDTH = 40;
export const MAP_HEIGHT = 40;