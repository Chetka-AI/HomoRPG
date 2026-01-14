import { CharacterStats } from './Stats.js';

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

        // Speed reduced by 50% as requested (was 5.0)
        this.baseSpeed = 2.5;
        this.sprintMultiplier = 1.6;

        // Stats System
        this.stats = new CharacterStats();

        // State Machine
        this.state = 'IDLE'; // IDLE, WALK, RUN

        // Animation
        this.animTimer = 0;
        this.bobOffset = 0;
    }

    update(dt, inputVector, isSprinting, collisionCheck) {
        // inputVector is expected to be {x, y} normalized world direction

        // 0. Update Stats
        // Check if we can sprint
        const canSprint = this.stats.canSprint();
        const actualSprint = isSprinting && canSprint;

        // 1. Determine Target Speed & Acceleration
        const isMoving = (inputVector.x !== 0 || inputVector.y !== 0);

        // Calculate Max Speed based on Stats
        const speedMultiplier = this.stats.getSpeedMultiplier();
        const currentMaxSpeed = this.baseSpeed * speedMultiplier * (actualSprint ? this.sprintMultiplier : 1.0);

        // Update Vital Stats
        // Velocity magnitude for accurate calorie burn approximation
        const speed = Math.hypot(this.velocity.x, this.velocity.y);

        // Determine state for stats
        let statState = 'IDLE';
        if (isMoving) {
            statState = actualSprint ? 'RUN' : 'WALK';
        }
        this.stats.update(dt, statState, speed);

        // 2. Apply Acceleration
        if (isMoving) {
            this.velocity.x += inputVector.x * this.acceleration;
            this.velocity.y += inputVector.y * this.acceleration;

            // Update Rotation to face movement direction
            this.rotation = Math.atan2(inputVector.y, inputVector.x);

            this.state = actualSprint ? 'RUN' : 'WALK';
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
        // Step Frequency: Sync with actual distance traveled.
        // We want one full step cycle (Left+Right) every X units of distance.
        // Let's say 1 step every 30 pixels. Cycle is 2*PI.
        // So factor = (Speed * dt) / 30 * (2*PI)

        // Distance moved this frame = speed * timeScale.
        const distMoved = currentSpeed * timeScale;

        if (distMoved > 0.01) {
            // Adjust divisor (70.0) to change stride length/frequency.
            // Slower animation as requested.
            this.animTimer += (distMoved / 70.0) * Math.PI;
        } else {
            // Return to neutral stance when stopped
            const target = Math.round(this.animTimer / Math.PI) * Math.PI;
            this.animTimer += (target - this.animTimer) * 0.1;
        }

        this.bobOffset = Math.sin(this.animTimer) * 2;
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Colors
        const skinColor = '#ffdbac';
        const shirtColor = '#2c3e50';
        const hairColor = '#3e2723';
        const shoeColor = '#1a1a1a';

        // --- FEET ---
        const footRadius = 5;
        const footOffsetY = 9;
        const stride = 10;

        const rightFootProgress = Math.sin(this.animTimer);
        const leftFootProgress = Math.sin(this.animTimer + Math.PI);

        ctx.fillStyle = shoeColor;

        // Left Foot
        ctx.beginPath();
        ctx.ellipse(leftFootProgress * stride, -footOffsetY, footRadius * 1.5, footRadius, 0, 0, Math.PI * 2);
        ctx.fill();

        // Right Foot
        ctx.beginPath();
        ctx.ellipse(rightFootProgress * stride, footOffsetY, footRadius * 1.5, footRadius, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- SHADOW ---
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.radius, this.radius * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- TORSO (Oval) ---
        let scaleX = 1.0;
        let scaleY = 1.0;

        // Bounce/Stretch
        const bounce = Math.abs(Math.sin(this.animTimer));
        scaleX = 1.0 + bounce * 0.02;
        scaleY = 1.0 - bounce * 0.02;

        ctx.scale(scaleX, scaleY);

        ctx.fillStyle = shirtColor;
        ctx.beginPath();
        // Oval shape: Wider (shoulders) than deep (chest).
        // Movement is along X-axis, so Shoulders are along Y-axis.
        // Therefore, Y-radius should be larger.
        ctx.ellipse(0, 0, this.radius * 0.6, this.radius * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();

        // --- HEAD ---
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2); // Central head
        ctx.fill();

        // --- HAIR ---
        ctx.fillStyle = hairColor;
        ctx.beginPath();
        // Full hair cap covering top, slightly offset back
        ctx.arc(-1, 0, 8.5, 0, Math.PI * 2);
        ctx.fill();

        // Face cutout (optional, or just style the hair to not cover the "face" area which is forward/+X)
        // If we want a "top down" look, the face is barely visible at the front.
        // Let's add a "nose" or face tint to the front to show direction.

        // Re-draw face area on top of hair at the front
        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(6, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        // --- HANDS ---
        const handSwing = 8;
        const leftHandX = rightFootProgress * handSwing;
        const rightHandX = leftFootProgress * handSwing;

        ctx.fillStyle = skinColor;

        // Left Hand
        ctx.beginPath();
        ctx.arc(leftHandX + 2, -this.radius - 4, 4, 0, Math.PI*2);
        ctx.fill();

        // Right Hand
        ctx.beginPath();
        ctx.arc(rightHandX + 2, this.radius + 4, 4, 0, Math.PI*2);
        ctx.fill();

        ctx.restore();

        // --- STAMINA BAR (In World Space, above head) ---
        // Don't rotate with character
        ctx.save();
        ctx.translate(this.x, this.y);
        // No rotation here

        // Bar bg
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-20, -30, 40, 5);

        // Bar fg
        const pct = this.stats.currentStamina / this.stats.maxStamina;
        ctx.fillStyle = pct > 0.3 ? '#00b894' : '#d63031';
        ctx.fillRect(-19, -29, 38 * pct, 3);

        ctx.restore();
    }

    getDebugInfo() {
        return `
Mass: ${this.stats.mass.toFixed(1)} kg
Health: ${this.stats.health.toFixed(0)}%
Energy: ${this.stats.energy.toFixed(0)}%
Hunger: ${this.stats.hunger.toFixed(0)}%
Thirst: ${this.stats.thirst.toFixed(0)}%
Toilet: ${this.stats.toilet.toFixed(0)}%
SpeedMult: ${this.stats.getSpeedMultiplier().toFixed(2)}x
`;
    }
}
