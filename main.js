import { InputController, PhysicsController, Pathfinder } from './Mechanics.js';
import { Character } from './Character.js';
import { WorldManager } from './WorldManager.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('touch-overlay');
        
        this.resize();
        window.addEventListener('resize', () => this.resize());

        this.input = new InputController(this.overlay);
        this.physics = new PhysicsController(); // Kept for other entities if needed
        
        // Initialize Pathfinder with bound collision check (Open world for now)
        this.pathfinder = new Pathfinder((x, y) => this.checkCollision(x, y));
        
        this.world = new WorldManager();
        // No static initWorld() call.

        this.player = new Character(0, 0);

        this.camera = { x: 0, y: 0, zoom: 1.0, rotation: 0 };
        this.lastTime = performance.now();
        
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
            btnToggle.addEventListener('click', toggleHandler);
            btnToggle.addEventListener('touchstart', toggleHandler, { passive: false });
        }

        // Visual debug for events
        this.lastEvent = "";

        // Game State
        this.gameStarted = false;
        this.initStartScreen();

        this.loop();
    }

    async initStartScreen() {
        const startScreen = document.getElementById('start-screen');
        const mapCanvas = document.getElementById('world-map-canvas');
        if (!startScreen || !mapCanvas) return;

        // Wait for world maps to load
        await this.world.loadingPromise;

        // Draw Map to Start Screen Canvas
        mapCanvas.width = this.world.biomeCanvas.width;
        mapCanvas.height = this.world.biomeCanvas.height;
        const ctx = mapCanvas.getContext('2d');
        ctx.drawImage(this.world.biomeCanvas, 0, 0);

        // Add Click Listener
        const selectLocationHandler = (e) => {
            const rect = mapCanvas.getBoundingClientRect();
            const scaleX = mapCanvas.width / rect.width;
            const scaleY = mapCanvas.height / rect.height;

            const clickX = (e.clientX - rect.left) * scaleX;
            const clickY = (e.clientY - rect.top) * scaleY;

            const chunkX = Math.floor(clickX);
            const chunkY = Math.floor(clickY);

            // Set Player Position (Center of selected chunk)
            // 1 Chunk = 1000px.
            this.player.x = chunkX * 1000 + 500;
            this.player.y = chunkY * 1000 + 500;

            console.log(`Selected Chunk ${chunkX}, ${chunkY} (Pos: ${this.player.x}, ${this.player.y})`);
        };

        mapCanvas.addEventListener('click', selectLocationHandler);
        mapCanvas.addEventListener('touchstart', (e) => {
            if(e.touches.length > 0) {
                 e.preventDefault();
                 selectLocationHandler(e.touches[0]);
            }
        });

        const btnStart = document.getElementById('btn-start-game');
        if (btnStart) {
            btnStart.addEventListener('click', () => {
                startScreen.style.display = 'none';
                document.getElementById('ui-layer').style.display = 'block';

                this.gameStarted = true;
                this.camera.x = this.player.x;
                this.camera.y = this.player.y;
            });
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    checkCollision(x, y) {
        return this.world.checkCollision(x, y);
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

    showContextMenu(screenX, screenY, object, customActions = null) {
        const menu = document.getElementById('context-menu');
        menu.style.display = 'block';
        menu.style.left = screenX + 'px';
        menu.style.top = screenY + 'px';

        menu.innerHTML = '';
        const actions = customActions || object.getActions(this.player);

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
        if (!this.gameStarted) return;

        // Update World Chunks
        this.world.update(dt, this.player);

        const inputState = this.input.update();

        if (inputState.zoomDelta !== 0) {
            this.camera.zoom = Math.max(0.1, Math.min(3.0, this.camera.zoom + inputState.zoomDelta));
            this.lastEvent = `Zoom: ${this.camera.zoom.toFixed(2)}`;
        }
        
        if (inputState.rotationDelta !== 0) {
            this.camera.rotation += inputState.rotationDelta;
            this.lastEvent = `Rot: ${this.camera.rotation.toFixed(2)}`;
        }

        if (inputState.tap) {
            const worldPos = this.screenToWorld(inputState.tap.x, inputState.tap.y);
            const path = this.pathfinder.findPath(this.player, worldPos);
            
            if (path) {
                this.path = path;
                this.path.push(worldPos); 
                this.isPathSprinting = (inputState.tap.type === 'run');
                this.lastEvent = `Tap: Path (${this.path.length}) ${this.isPathSprinting ? 'Run' : 'Walk'}`;
            } else {
                this.lastEvent = "Tap: No path!";
                this.path = [];
            }
            this.hideContextMenu();
        }

        if (inputState.longPress) {
            this.lastEvent = "Long Press Detected!";
            this.path = [];

            const pressWorldPos = this.screenToWorld(inputState.longPress.x, inputState.longPress.y);
            const obj = this.world.getNearestObject(pressWorldPos.x, pressWorldPos.y, 30);

            if (obj) {
                const dist = Math.hypot(obj.x - this.player.x, obj.y - this.player.y);
                if (dist < 80) {
                    this.showContextMenu(inputState.longPress.x, inputState.longPress.y, obj);
                } else {
                    this.lastEvent = "Too far to interact!";
                }
            } else {
                // Check if clicking on Water
                if (this.world.checkCollision(pressWorldPos.x, pressWorldPos.y)) {
                    // checkCollision returns true for water (or unloaded chunks, but usually water).
                    // This is a bit simplistic as collision could be a wall, but for now map only has Water as blocked tiles.
                    // Ideally we should check if it's actually water.
                    // But checkCollision logic is: isWater = true.
                    // And we checked Objects first. So if collision is true and no object, it's Water (or off-map).

                    const dist = Math.hypot(pressWorldPos.x - this.player.x, pressWorldPos.y - this.player.y);
                    if (dist < 80) {
                        this.showContextMenu(inputState.longPress.x, inputState.longPress.y, null, [
                            {
                                label: 'Pij (💧)',
                                action: () => {
                                    this.player.stats.drink(20);
                                    console.log("Drinking water...");
                                    return 'update';
                                }
                            }
                        ]);
                    } else {
                         this.lastEvent = "Too far to drink!";
                         this.hideContextMenu();
                    }
                } else {
                    this.hideContextMenu();
                }
            }
        } else {
             if (inputState.active) {
                this.hideContextMenu();
            }
        }

        let worldInput = { x: 0, y: 0 };
        let isSprinting = false;

        if (inputState.active) {
            const ix = inputState.x;
            const iy = -inputState.y;
            const r = this.camera.rotation;
            const cos = Math.cos(r);
            const sin = Math.sin(r);

            worldInput.x = ix * cos - iy * sin;
            worldInput.y = ix * sin + iy * cos;

            isSprinting = this.isRunToggleOn || inputState.sprint;
            this.path = [];
        } else if (this.path.length > 0) {
            const target = this.path[0];
            const dx = target.x - this.player.x;
            const dy = target.y - this.player.y;
            const dist = Math.hypot(dx, dy);

            if (dist > 15) {
                worldInput.x = dx / dist;
                worldInput.y = dy / dist;
                isSprinting = this.isPathSprinting;
            } else {
                this.path.shift();
            }
        }

        this.player.update(
            dt, 
            worldInput,
            isSprinting,
            (x, y) => this.checkCollision(x, y)
        );

        this.camera.x = this.player.x;
        this.camera.y = this.player.y;
    }

    draw() {
        this.ctx.fillStyle = '#121212';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.gameStarted) return;

        this.ctx.save();
        
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.rotate(-this.camera.rotation); 
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.translate(-this.camera.x, -this.camera.y);

        // No bounds rect anymore (infinite)

        this.world.renderBottom(this.ctx);

        // Debug Grid (Local to player)
        this.ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        this.ctx.lineWidth = 1;
        const gx = Math.floor(this.player.x / 100) * 100;
        const gy = Math.floor(this.player.y / 100) * 100;
        this.ctx.beginPath();
        for(let i = -1000; i <= 1000; i+=100) {
            this.ctx.moveTo(gx + i, gy - 1000); this.ctx.lineTo(gx + i, gy + 1000);
            this.ctx.moveTo(gx - 1000, gy + i); this.ctx.lineTo(gx + 1000, gy + i);
        }
        this.ctx.stroke();

        if (this.path.length > 0) {
            this.ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(this.player.x, this.player.y);
            for(let p of this.path) {
                this.ctx.lineTo(p.x, p.y);
            }
            this.ctx.stroke();
            
            this.ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
            for(let p of this.path) {
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
                this.ctx.fill();
            }
        }

        this.player.render(this.ctx);
        this.world.renderTop(this.ctx, this.player);

        this.ctx.restore();
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px monospace';
        const cx = Math.floor(this.player.x / 1000);
        const cy = Math.floor(this.player.y / 1000);
        this.ctx.fillText(`Pos: ${this.player.x.toFixed(1)}, ${this.player.y.toFixed(1)} (Chunk ${cx},${cy})`, 10, 20);
        this.ctx.fillText(`Biome: ${this.world.activeChunks.get(`${cx},${cy}`)?.biome.name || 'Unknown'}`, 10, 40);
        this.ctx.fillText(`Event: ${this.lastEvent}`, 10, 60);

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
    window.game = new Game();
});
