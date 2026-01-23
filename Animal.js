import { MobileEntity } from './Entities.js';
import { mulberry32 } from './TerrainGenerator.js';

const imageCache = {};
function getImage(path) {
    if (!imageCache[path] && typeof document !== 'undefined') {
        const img = new Image();
        img.src = path;
        imageCache[path] = img;
    }
    return imageCache[path];
}

export class Animal extends MobileEntity {
    constructor(x, y, species, seed) {
        super(x, y, 'animal');
        this.species = species || {
            name: "Generic",
            speed: 1.0,
            imagePath: null, // Fallback
            behavior: 'passive'
        };
        this.seed = seed || Date.now();

        // AI State
        this.aiState = 'IDLE'; // IDLE, WANDER
        this.aiTimer = 0;
        this.targetPos = { x: this.x, y: this.y };
        this.inputVector = { x: 0, y: 0 };

        // Animation
        this.animTimer = 0;
        this.frameIndex = 0;
        this.direction = 1; // 1 = Right, -1 = Left (for flipping sprite)

        // Load Image
        if (this.species.imagePath) {
            this.image = getImage(this.species.imagePath);
        }
    }

    update(dt, collisionCheck) {
        // AI Logic
        this.aiTimer -= dt;
        if (this.aiTimer <= 0) {
            this.decideNextAction();
        }

        if (this.aiState === 'WANDER') {
            const dx = this.targetPos.x - this.x;
            const dy = this.targetPos.y - this.y;
            const dist = Math.hypot(dx, dy);

            if (dist < 10) {
                this.inputVector = { x: 0, y: 0 };
                this.aiState = 'IDLE';
                this.aiTimer = 1000 + Math.random() * 2000;
            } else {
                this.inputVector = { x: dx / dist, y: dy / dist };
            }
        } else {
            this.inputVector = { x: 0, y: 0 };
        }

        // Determine Direction
        if (this.inputVector.x > 0.1) this.direction = 1;
        if (this.inputVector.x < -0.1) this.direction = -1;

        // Physics
        const maxSpeed = this.species.speed || 1.0;
        const moved = this.updatePhysics(dt, this.inputVector, maxSpeed, collisionCheck);

        // Animation Update
        const animState = moved ? 'walk' : 'idle';
        const animDef = this.species.animations ? this.species.animations[animState] : null;

        if (animDef) {
            this.animTimer += dt * 0.001;
            if (this.animTimer > animDef.speed) {
                this.animTimer = 0;
                this.frameIndex = (this.frameIndex + 1) % animDef.frames;
            }
        }
    }

    decideNextAction() {
        const rng = Math.random();
        if (rng < 0.6) {
            // Idle
            this.aiState = 'IDLE';
            this.aiTimer = 2000 + Math.random() * 3000;
            this.inputVector = { x: 0, y: 0 };
        } else {
            // Wander
            this.aiState = 'WANDER';
            const dist = 50 + Math.random() * 150;
            const angle = Math.random() * Math.PI * 2;
            this.targetPos = {
                x: this.x + Math.cos(angle) * dist,
                y: this.y + Math.sin(angle) * dist
            };
            this.aiTimer = 5000; // Max wander time before giving up
        }
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Simple shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        if (this.direction === -1) {
            ctx.scale(-1, 1);
        }

        const animState = (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.y) > 0.1) ? 'walk' : 'idle';

        if (this.image && this.image.complete && this.species.animations) {
            const def = this.species.animations[animState] || this.species.animations['idle'];
            if (def && this.species.frameSize) {
                const fw = this.species.frameSize.w;
                const fh = this.species.frameSize.h;
                const row = def.row || 0;
                const col = this.frameIndex % def.frames;

                ctx.drawImage(
                    this.image,
                    col * fw, row * fh, fw, fh,
                    -fw / 2, -fh + 5, fw, fh
                );
            }
        } else {
            // Fallback Rendering (Pixel Art Placeholder)
            ctx.fillStyle = this.species.color || '#795548';
            ctx.fillRect(-10, -20, 20, 20); // Body
            ctx.fillStyle = '#3e2723';
            ctx.fillRect(8, -25, 8, 8); // Head
        }

        ctx.restore();
    }
}
