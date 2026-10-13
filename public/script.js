import { addMessage, messageInput, sendButton, sendMessage } from "./modules/chat.js";
import { drawMap, drawPlayers, drawBullets, drawTeamPoint } from "./modules/draw.js";
import { PLAYER_MAX_POWER } from "./modules/config.js";
(() => {
    const websocketProtocol = ((window.location.protocol === "https:") ? "wss:" : "ws:");
    const socket = new WebSocket(`${websocketProtocol}//${window.location.host}`);

    const canvas = document.getElementById("gamecanvas");
    const ctx = canvas.getContext("2d");

    const inputState = {
        up: false,
        down: false,
        left: false,
        right: false,
        isPainting: false,
        isShooting: false,
        pointerX: 0,
        pointerY: 0,
    };

    const gameState = {
        players: new Map(),
        bullets: new Set(),
        myId: null,
        myPower: 100,
        map: [],
        teamPoint: null,
    };

    const keys = {};

    sendButton.addEventListener("click", () => {
        sendMessage(socket, gameState.myId);
    });
    messageInput.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Enter" && document.activeElement === messageInput) {
            messageInput.blur();
            sendMessage(socket, gameState.myId);
        }
    });

    window.addEventListener("keydown", (event) => {
        if (event.key === "Enter" && !event.isComposing) {
            if (document.activeElement !== messageInput) {
                messageInput.focus();
            }
        }
    });

    window.addEventListener("keydown", (event) => {
        keys[event.code] = true;
    });
    window.addEventListener("keyup", (event) => {
        keys[event.code] = false;
    });

    window.addEventListener("beforeunload", () => {
        socket.close();
    });

    function calculatePointerPosition(event) {
        const rect = canvas.getBoundingClientRect();
        inputState.pointerX = event.clientX - rect.left;
        inputState.pointerY = event.clientY - rect.top;
    }

    window.addEventListener("pointermove", (event) => {
        calculatePointerPosition(event);
    });
    window.addEventListener("pointerdown", (event) => {
        calculatePointerPosition(event);
        inputState.isShooting = true;
    });
    window.addEventListener("pointerup", (event) => {
        calculatePointerPosition(event);
        inputState.isShooting = false;
    });
    window.addEventListener("pointercancel", () => {
        inputState.isShooting = false;
    });

    socket.addEventListener("message", (event) => {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch (error) {
            addMessage("受信エラー");
            console.error(error);
        }

        if (data.type === "init") {
            gameState.myId = data.playerId;
            gameState.map = data.map;
            gameState.bullets = new Set(data.bullets);
            gameState.teamPoint = data.teamPoint;
            gameState.players = new Map(data.players.map((p) => [p.id, p]));
            addMessage("Connected to the server.");
            addMessage("Your ID: " + gameState.myId);
            addMessage("Your team: " + (gameState.players.get(gameState.myId).team === "R" ? "Red" : "Blue"));
        } else if (data.type === "chat") {
            addMessage(data.message);
        } else if (data.type === "updatePlayers") {
            for (const p of data.players) {
                gameState.players.set(p.id, p);
            }
        } else if (data.type === "updateBullets") {
            gameState.bullets = new Set(data.bullets);
        } else if (data.type === "updateMap") {
            const nowStr = gameState.map[data["tileY"]];
            const newStr = nowStr.slice(0, data["tileX"]) + data["color"] + nowStr.slice(data["tileX"] + 1);
            gameState.map[data["tileY"]] = newStr;
        } else if (data.type === "updateTeamPoint") {
            gameState.teamPoint = data.teamPoint;
        } else if (data.type === "playerJoined") {
            addMessage(`${data.player.id} joined the game.`);
        } else if (data.type === "playerLeft") {
            addMessage(`${data.id} left the game.`);
            gameState.players.delete(data.id);
        } else if (data.type === "playerDied") {
            addMessage(`${data.died} was killed by ${data.killer}.`);
        } else if (data.type === "playerRespawn") {
            gameState.players.set(data.player.id, data.player);
        } else if (data.type === "updateYourPower") {
            gameState.myPower = data.power;
        }
    });

    socket.addEventListener("close", (event) => {
        addMessage("Disconnected from the server.");
        addMessage("Code: " + event.code);
        if (event.reason !== null && event.reason !== undefined && event.reason !== "") {
            addMessage("Reason: " + event.reason);
        }
    });

    socket.addEventListener("error", (event) => {
        console.log("WebSocketエラー: ", event);
        addMessage("An error has occurred in the WebSocket connection.");
    });

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener("resize", () => {
        setTimeout(() => {
            resizeCanvas();
        }, 50);
    });
    resizeCanvas();

    function Input() {
        if (document.activeElement !== messageInput) {
            inputState.up = Boolean(keys["KeyW"] || keys["KeyI"] || keys["ArrowUp"]);
            inputState.down = Boolean(keys["KeyS"] || keys["KeyK"] || keys["ArrowDown"]);
            inputState.left = Boolean(keys["KeyA"] || keys["KeyJ"] || keys["ArrowLeft"]);
            inputState.right = Boolean(keys["KeyD"] || keys["KeyL"] || keys["ArrowRight"]);
            inputState.isPainting = Boolean(keys["ShiftLeft"] || keys["KeyG"] || keys["Space"]);
        }
    }

    function sendInput() {
        if (socket.readyState === WebSocket.OPEN && gameState.myId !== null) {
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const dx = inputState.pointerX - centerX;
            const dy = inputState.pointerY - centerY;
            const length = Math.hypot(dx, dy);
            const directionX = (length === 0 ? 1 : dx / length);
            const directionY = (length === 0 ? 0 : dy / length);
            socket.send(JSON.stringify({
                "type": "input",
                "id": gameState.myId,
                "up": inputState.up,
                "down": inputState.down,
                "left": inputState.left,
                "right": inputState.right,
                "isPainting": inputState.isPainting,
                "isShooting": inputState.isShooting,
                "directionX": directionX,
                "directionY": directionY,
            }));
        }
    }

    function draw(ctx) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        const you = gameState.players.get(gameState.myId);
        if (you === null || you === undefined) {
            return;
        }
        drawMap(ctx, you, gameState.map);
        drawBullets(ctx, you, gameState.bullets);
        drawPlayers(ctx, you, gameState.players);
        drawTeamPoint(ctx, gameState.teamPoint);
    }

    function mainLoop() {
        draw(ctx);
        Input();
        sendInput();
    }

    setInterval(() => {
        mainLoop();
    }, 1000 / 60);
})();