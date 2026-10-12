export const messageInput = document.getElementById("messageInput");
export const sendButton = document.getElementById("sendButton");
export const messages = document.getElementById("messages");

export function addMessage(message) {
    const messageElement = document.createElement("div");
    messageElement.textContent = message;
    messages.appendChild(messageElement);
    messages.scrollTop = messages.scrollHeight;
}

export function sendMessage(socket, myId) {
    const message = messageInput.value.trim();
    if (message.length > 100) {
        return;
    }

    if (message !== "" && socket.readyState === WebSocket.OPEN && myId !== null) {
        socket.send(JSON.stringify({ "type": "chat", "id": myId, "message": message }));
        messageInput.value = "";
    }
}