import { GameObject } from './Objects.js';

export class MobileEntity extends GameObject {
    constructor(x, y, type) {
        super(x, y, type);

        // Physics Properties
        this.velocity = { x: 0, y: 0 };
        this.friction = 0.82; // Determines how fast we stop (0.0 - 1.0)
        this.acceleration = 1.2; // How fast we speed up
        this.radius = 15; // Default collision radius
    }

    /**
     * Updates position based on input, physics, and collision.
     * @param {number} dt - Delta time in ms
     * @param {Object} inputVector - {x, y} normalized direction
     * @param {number} currentMaxSpeed - Maximum speed for this frame
     * @param {Function} collisionCheck - Function(x, y) returning boolean (true if blocked)
     * @returns {boolean} - True if entity moved
     */
    updatePhysics(dt, inputVector, currentMaxSpeed, collisionCheck) {
        const isMoving = (inputVector.x !== 0 || inputVector.y !== 0);

        // 1. Apply Acceleration
        if (isMoving) {
            this.velocity.x += inputVector.x * this.acceleration;
            this.velocity.y += inputVector.y * this.acceleration;

            // Update Rotation to face movement direction
            this.rotation = Math.atan2(inputVector.y, inputVector.x);
        }

        // 2. Apply Friction
        this.velocity.x *= this.friction;
        this.velocity.y *= this.friction;

        // 3. Cap Speed (Soft Limit)
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
            if (!isMoving) return false;
        }

        // 4. Calculate Next Position
        // dt is typically around 16ms. We scale movement to be framerate independent-ish.
        const timeScale = dt / 16.0;

        const nextX = this.x + this.velocity.x * timeScale;
        const nextY = this.y + this.velocity.y * timeScale;

        // 5. Collision Detection & Resolution
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
            canMoveX = false;
            canMoveY = false;
            this.velocity.x = 0;
            this.velocity.y = 0;
        }

        if (canMoveX) this.x += this.velocity.x * timeScale;
        if (canMoveY) this.y += this.velocity.y * timeScale;

        return (canMoveX || canMoveY) && (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.y) > 0.1);
    }
}
