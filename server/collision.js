export function checkCircleCircleCollision(circle1, circle2) {
    const dx = circle1.x - circle2.x;
    const dy = circle1.y - circle2.y;
    const distance = (dx * dx) + (dy * dy);
    return (distance < (circle1.r + circle2.r) * (circle1.r + circle2.r));
}

export function checkCircleRectCollision(circle, rect) {
    const px = Math.max(Math.min(circle.x, rect.right), rect.left);
    const py = Math.max(Math.min(circle.y, rect.bottom), rect.top)

    const dx = Math.abs(circle.x - px);
    const dy = Math.abs(circle.y - py);

    const distance = (dx * dx) + (dy * dy);
    return (distance < circle.r * circle.r);
}