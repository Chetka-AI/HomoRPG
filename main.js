import { InputController, PhysicsController, Pathfinder } from './Mechanics.js';
import { Character } from './Character.js';
import { World, Stone, Tree, Bush } from './Objects.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('touch-overlay');
        
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.input = new InputController(this.overlay);
        this.physics = new PhysicsController(); // Kept for other entities if needed
        
        // Initialize Pathfinder with bound collision check
        this.pathfinder = new Pathfinder((x, y) => this.checkCollision(x, y));
        
        this.world = new World();
        this.initWorld();

        this.player = new Character(0, 0);

        this.camera = { x: 0, y: 0, zoom: 1.0, rotation: 0 };
        this.lastTime = performance.now();
        
        this.worldBounds = { minX: -500, maxX: 500, minY: -500, maxY: 500 };
        
        // Navigation Target (Tap to move)
        this.path = []; // Array of points {x, y}
        this.isPathSprinting = false;

        // Joystick Toggle
        this.isRunToggleOn = false;
        const btnToggle = document.getElementById('btn-toggle-speed');
        if (btnToggle) {
            const toggleHandler = (e) => {
                e.preventDefault(); // Prevent default touch behavior
                e.stopPropagation(); // prevent game click
                this.isRunToggleOn = !this.isRunToggleOn;
                btnToggle.innerText = this.isRunToggleOn ? '🏃' : '🚶';
            };
            // Listen to both click and touchstart for better responsiveness
            btnToggle.addEventListener('click', toggleHandler);
            btnToggle.addEventListener('touchstart', toggleHandler, { passive: false });
        }

        // Visual debug for events
        this.lastEvent = "";

        this.loop();
    }

    initWorld() {
        // Add requested objects
        this.world.add(new Stone(100, -100, 'small'));
        this.world.add(new Stone(150, -120, 'medium'));
        this.world.add(new Stone(200, -100, 'large'));

        this.world.add(new Tree(-100, -100));
        this.world.add(new Tree(-150, -150));

        this.world.add(new Bush(50, 50));
        this.world.add(new Bush(-50, 50));
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    checkCollision(x, y) {
        if (x < this.worldBounds.minX || x > this.worldBounds.maxX || 
            y < this.worldBounds.minY || y > this.worldBounds.maxY) {
            return true;
        }
        // Basic Static Obstacle
        if (x > 100 && x < 200 && y > 100 && y < 200) return true;

        return false;
    }

    screenToWorld(sx, sy) {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        
        let dx = (sx - cx) / this.camera.zoom;
        let dy = (sy - cy) / this.camera.zoom;
        
        const r = this.camera.rotation;
        const cos = Math.cos(r);
        const sin = Math.sin(r);
        
        const rdx = dx * cos - dy * sin;
        const rdy = dx * sin + dy * cos;
        
        return {
            x: rdx + this.camera.x,
            y: rdy + this.camera.y
        };
    }

    showContextMenu(screenX, screenY, object) {
        const menu = document.getElementById('context-menu');
        menu.style.display = 'block';
        menu.style.left = screenX + 'px';
        menu.style.top = screenY + 'px';

        menu.innerHTML = '';
        const actions = object.getActions(this.player);

        if (actions.length === 0) {
            menu.innerHTML = '<div style="color:#aaa; padding:5px;">Brak akcji</div>';
            return;
        }

        actions.forEach(act => {
            const btn = document.createElement('button');
            btn.className = 'ctx-action';
            btn.innerText = act.label;
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent canvas click
                const result = act.action();
                if (result === 'remove') {
                    this.world.remove(object);
                }
                // 'update' is handled automatically next frame
                this.hideContextMenu();
            });
            // Stop propagation on touchstart to prevent joystick/map interaction
            btn.addEventListener('touchstart', (e) => e.stopPropagation());
            menu.appendChild(btn);
        });
    }

    hideContextMenu() {
        const menu = document.getElementById('context-menu');
        if (menu.style.display !== 'none') {
            menu.style.display = 'none';
        }
    }

    update(dt) {
        const inputState = this.input.update();

        // Handle Zoom (Limit max zoom out to 3.0 as requested)
        if (inputState.zoomDelta !== 0) {
            this.camera.zoom = Math.max(0.1, Math.min(3.0, this.camera.zoom + inputState.zoomDelta));
            this.lastEvent = `Zoom: ${this.camera.zoom.toFixed(2)}`;
        }
        
        // Handle Rotation
        if (inputState.rotationDelta !== 0) {
            this.camera.rotation += inputState.rotationDelta;
            this.lastEvent = `Rot: ${this.camera.rotation.toFixed(2)}`;
        }

        // Handle Tap -> Calculate Path
        if (inputState.tap) {
            const worldPos = this.screenToWorld(inputState.tap.x, inputState.tap.y);
            const path = this.pathfinder.findPath(this.player, worldPos);
            
            if (path) {
                this.path = path;
                this.path.push(worldPos); 
                // Set sprint state based on Double Tap
                this.isPathSprinting = (inputState.tap.type === 'run');
                
                this.lastEvent = `Tap: Path (${this.path.length}) ${this.isPathSprinting ? 'Run' : 'Walk'}`;
            } else {
                this.lastEvent = "Tap: No path!";
                this.path = [];
            }

            this.hideContextMenu();
        }

        // Handle Long Press
        if (inputState.longPress) {
            this.lastEvent = "Long Press Detected!";
            this.path = []; // Stop moving

            // Interaction Check
            const pressWorldPos = this.screenToWorld(inputState.longPress.x, inputState.longPress.y);
            const obj = this.world.getNearestObject(pressWorldPos.x, pressWorldPos.y, 30);

            if (obj) {
                // Check distance from player to object (Interaction Range)
                const dist = Math.hypot(obj.x - this.player.x, obj.y - this.player.y);
                if (dist < 80) { // Interaction range
                    this.showContextMenu(inputState.longPress.x, inputState.longPress.y, obj);
                } else {
                    this.lastEvent = "Too far to interact!";
                }
            } else {
                this.hideContextMenu();
            }
        } else {
             if (inputState.active) {
                this.hideContextMenu();
            }
        }

        // Determine World Input Vector for Character
        let worldInput = { x: 0, y: 0 };
        let isSprinting = false;

        if (inputState.active) {
            // Joystick / Keyboard active
            // Input X/Y is screen space relative (NippleJS: Up=+Y).
            // We want to move relative to Camera Rotation.

            // Screen Vector: (x, -y) because Screen Y is Down, World Y is Down, but Nipple Y is Up.
            // Wait, Nipple Y=+1 (Up). Screen Y=0 (Top).
            // If I push Nipple Up, I want to move "Up" on screen.
            // "Up" on screen is World vector rotated by -CameraRotation.
            // "Up" on screen in World Space (unrotated) is (0, -1).
            // So we take input (x, -y) and rotate it by -CameraRotation.

            const ix = inputState.x;
            const iy = -inputState.y; // Invert Y for Screen Space

            // To move "Up" on screen regardless of Camera Rotation:
            // We need to rotate the Screen Vector by the Camera Rotation to get the World Vector.
            // (The inverse of the View Matrix rotation).
            const r = this.camera.rotation;
            const cos = Math.cos(r);
            const sin = Math.sin(r);

            worldInput.x = ix * cos - iy * sin;
            worldInput.y = ix * sin + iy * cos;

            isSprinting = this.isRunToggleOn || inputState.sprint;
            
            this.path = []; // Cancel path on manual input
        } else if (this.path.length > 0) {
            // Move towards next point in path
            const target = this.path[0];
            const dx = target.x - this.player.x;
            const dy = target.y - this.player.y;
            const dist = Math.hypot(dx, dy);

            if (dist > 15) { // Reach radius
                worldInput.x = dx / dist;
                worldInput.y = dy / dist;
                isSprinting = this.isPathSprinting;
            } else {
                // Reached point, go to next
                this.path.shift();
            }
        }

        // Apply Physics via Character Module
        this.player.update(
            dt, 
            worldInput,
            isSprinting,
            (x, y) => this.checkCollision(x, y)
        );

        // Camera locked to player (Direct assignment, no Lerp)
        this.camera.x = this.player.x;
        this.camera.y = this.player.y;
    }

    draw() {
        this.ctx.fillStyle = '#121212';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        
        // Camera Transform
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.rotate(-this.camera.rotation); 
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // World Bounds
        this.ctx.strokeStyle = '#444'; // Brighter grid border
        this.ctx.lineWidth = 5;
        this.ctx.strokeRect(this.worldBounds.minX, this.worldBounds.minY, 1000, 1000);

        // Obstacle
        this.ctx.fillStyle = '#444';
        this.ctx.fillRect(100, 100, 100, 100);

        // Render World Objects
        this.world.render(this.ctx);

        // Grid - Brighter for visibility
        this.ctx.strokeStyle = '#333'; // Brighter grid lines (was #222)
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for(let i = this.worldBounds.minX; i <= this.worldBounds.maxX; i+=100) {
            this.ctx.moveTo(i, this.worldBounds.minY); this.ctx.lineTo(i, this.worldBounds.maxY);
        }
        for(let i = this.worldBounds.minY; i <= this.worldBounds.maxY; i+=100) {
            this.ctx.moveTo(this.worldBounds.minX, i); this.ctx.lineTo(this.worldBounds.maxX, i);
        }
        this.ctx.stroke();

        // Path Debug
        if (this.path.length > 0) {
            this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(this.player.x, this.player.y);
            for(let p of this.path) {
                this.ctx.lineTo(p.x, p.y);
            }
            this.ctx.stroke();
            
            // Draw points
            this.ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            for(let p of this.path) {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
                this.ctx.fill();
            }
        }

        // Player
        this.player.render(this.ctx);

        this.ctx.restore();
        
        // Debug UI
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px monospace';
        this.ctx.fillText(`Pos: ${this.player.x.toFixed(1)}, ${this.player.y.toFixed(1)}`, 10, 20);
        this.ctx.fillText(`Event: ${this.lastEvent}`, 10, 40);
        this.ctx.fillText(`Toggle: ${this.isRunToggleOn ? 'Run' : 'Walk'}. Tap (Smart Move).`, 10, 60);

        // Stats Debug
        if (this.player.getDebugInfo) {
            const lines = this.player.getDebugInfo().trim().split('\n');
            lines.forEach((line, i) => {
                this.ctx.fillText(line, 10, 90 + (i * 15));
            });
        }
    }

    loop() {
        const now = performance.now();
        const dt = now - this.lastTime;
        this.lastTime = now;

        this.update(dt);
        this.draw();
        requestAnimationFrame(() => this.loop());
    }
}

window.addEventListener('load', () => {
    new Game();
});
