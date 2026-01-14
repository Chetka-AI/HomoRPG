export class Character {
    constructor(x, y) {
        // Position & Dimensions
        this.x = x;
        this.y = y;
        this.radius = 15;
        this.rotation = 0; // Radians

        // Physics Properties
        this.velocity = { x: 0, y: 0 };
        this.friction = 0.82; // Determines how fast we stop (0.0 - 1.0)
        this.acceleration = 1.2; // How fast we speed up
        this.baseSpeed = 5.0;
        this.sprintMultiplier = 1.6;

        // State Machine
        this.state = 'IDLE'; // IDLE, WALK, RUN

        // Animation
        this.animTimer = 0;
        this.bobOffset = 0;
    }

    update(dt, inputVector, isSprinting, collisionCheck) {
        // inputVector is expected to be {x, y} normalized world direction

        // 1. Determine Target Speed & Acceleration
        const isMoving = (inputVector.x !== 0 || inputVector.y !== 0);
        const currentMaxSpeed = this.baseSpeed * (isSprinting ? this.sprintMultiplier : 1.0);

        // 2. Apply Acceleration
        if (isMoving) {
            this.velocity.x += inputVector.x * this.acceleration;
            this.velocity.y += inputVector.y * this.acceleration;

            // Update Rotation to face movement direction
            this.rotation = Math.atan2(inputVector.y, inputVector.x);

            this.state = isSprinting ? 'RUN' : 'WALK';
        } else {
            this.state = 'IDLE';
        }

        // 3. Apply Friction
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;

        // 4. Cap Speed (Soft Limit)
        const currentSpeed = Math.hypot(this.velocity.x, this.velocity.y);
        if (currentSpeed > currentMaxSpeed) {
            const scale = currentMaxSpeed / currentSpeed;
            this.velocity.x *= scale;
            this.velocity.y *= scale;
        }

        // Stop completely if very slow
        if (currentSpeed < 0.1) {
            this.velocity.x = 0;
            this.velocity.y = 0;
        }

        // 5. Calculate Next Position
        // dt is typically around 16ms. We scale movement to be framerate independent-ish.
        // Assuming dt is in ms.
        const timeScale = dt / 16.0;

        const nextX = this.x + this.velocity.x * timeScale;
        const nextY = this.y + this.velocity.y * timeScale;

        // 6. Collision Detection & Resolution
        // We check X and Y axes separately to allow "sliding" along walls

        let canMoveX = true;
        let canMoveY = true;

        if (collisionCheck(nextX, this.y)) {
            canMoveX = false;
            this.velocity.x = 0; // Kill velocity on impact
        }

        if (collisionCheck(this.x, nextY)) {
            canMoveY = false;
            this.velocity.y = 0;
        }

        // Corner case: if both individual checks passed, but the diagonal position is blocked
        if (canMoveX && canMoveY && collisionCheck(nextX, nextY)) {
            // Simple resolve: stop both or prioritize one. Let's stop.
            canMoveX = false;
            canMoveY = false;
            this.velocity.x = 0;
            this.velocity.y = 0;
        }

        if (canMoveX) this.x += this.velocity.x * timeScale;
        if (canMoveY) this.y += this.velocity.y * timeScale;

        // 7. Update Animation State
        this.animTimer += dt * (currentSpeed * 0.2);
        this.bobOffset = Math.sin(this.animTimer * 0.05) * 2;
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Procedural Body (e.g., a "Capsule" look from top-down)

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius, this.radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body Animation (Breathing/Walking Bob)
        // If moving, we might stretch/squash slightly
        let scaleX = 1.0;
        let scaleY = 1.0;

        if (this.state !== 'IDLE') {
            scaleX = 1.0 + Math.sin(this.animTimer * 0.1) * 0.05;
            scaleY = 1.0 - Math.sin(this.animTimer * 0.1) * 0.05;
        }

        ctx.scale(scaleX, scaleY);

        // Main Shape
        ctx.fillStyle = this.state === 'RUN' ? '#ff6b6b' : '#ff4757';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Inner Detail (Head/Helmet indication)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(5, -5, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        // Direction Indicator (Triangle)
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(this.radius - 2, 0); // Front
        ctx.lineTo(this.radius - 12, -6);
        ctx.lineTo(this.radius - 12, 6);
        ctx.fill();

        // Hands/Shoulders (Simple circles orbiting)
        const handOffset = Math.sin(this.animTimer * 0.1) * 5;
        ctx.fillStyle = '#c0392b';

        // Left Hand
        ctx.beginPath();
        ctx.arc(0, -this.radius, 6, 0, Math.PI*2);
        ctx.fill();

        // Right Hand
        ctx.beginPath();
        ctx.arc(0, this.radius, 6, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();
    }
}
