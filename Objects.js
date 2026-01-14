import { Item } from './Inventory.js';

export class World {
    constructor() {
        this.objects = [];
    }

    add(obj) {
        this.objects.push(obj);
    }

    remove(obj) {
        this.objects = this.objects.filter(o => o !== obj);
    }

    update(dt) {
        // Future: animations etc.
    }

    render(ctx) {
        // Sort by Y for depth (simple painter's algorithm)
        this.objects.sort((a, b) => a.y - b.y);
        for (let obj of this.objects) {
            obj.render(ctx);
        }
    }

    getNearestObject(x, y, maxDist = 40) {
        let nearest = null;
        let minDist = maxDist;

        for (let obj of this.objects) {
            const dist = Math.hypot(obj.x - x, obj.y - y);
            if (dist < minDist) {
                minDist = dist;
                nearest = obj;
            }
        }
        return nearest;
    }
}

export class GameObject {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.rotation = 0;
    }

    render(ctx) {
        // Placeholder
    }

    getActions(character) {
        return [];
    }
}

export class Stone extends GameObject {
    constructor(x, y, size) { // size: 'small', 'medium', 'large'
        super(x, y, 'stone');
        this.size = size;
        this.radius = size === 'small' ? 10 : (size === 'medium' ? 15 : 25);
        this.mass = size === 'small' ? 1.0 : (size === 'medium' ? 5.0 : 20.0);
        this.color = size === 'small' ? '#a8a8a8' : (size === 'medium' ? '#808080' : '#505050');

        // Random shape variation
        this.points = [];
        const segments = 6;
        for(let i=0; i<segments; i++) {
            const angle = (Math.PI * 2 * i) / segments;
            const r = this.radius * (0.8 + Math.random() * 0.4);
            this.points.push({x: Math.cos(angle)*r, y: Math.sin(angle)*r});
        }
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#333';

        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for(let i=1; i<this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    getActions(character) {
        const actions = [];
        // Can take if fits in weight limit
        if (character.inventory.currentWeight + this.mass <= character.inventory.maxWeight) {
            actions.push({
                label: 'Weź (🫳)',
                action: () => {
                    const item = new Item(`stone_${Date.now()}`, `${this.size} Kamień`, 'resource', this.mass, '🪨');
                    if (character.inventory.addItem(item)) {
                        return 'remove'; // Signal to remove from world
                    }
                }
            });
        }
        return actions;
    }
}

export class Tree extends GameObject {
    constructor(x, y) {
        super(x, y, 'tree');
        this.state = 'standing'; // 'standing', 'fallen', 'logs'
        this.radius = 20;
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.state === 'standing') {
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.ellipse(0, 5, 20, 10, 0, 0, Math.PI*2); ctx.fill();

            // Trunk
            ctx.fillStyle = '#5d4037';
            ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();

            // Leaves (Top down view)
            ctx.fillStyle = '#2e7d32';
            ctx.beginPath(); ctx.arc(0, -10, 25, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#388e3c';
            ctx.beginPath(); ctx.arc(-10, -5, 20, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(10, -5, 20, 0, Math.PI*2); ctx.fill();

        } else if (this.state === 'fallen') {
            // Fallen trunk
            ctx.rotate(Math.PI / 2); // Sideways
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(-40, -6, 80, 12);

            // Withered leaves
            ctx.fillStyle = '#558b2f';
            ctx.beginPath(); ctx.arc(-50, 0, 20, 0, Math.PI*2); ctx.fill();
        } else if (this.state === 'logs') {
            // Logs scattered
            ctx.fillStyle = '#5d4037';
            ctx.strokeStyle = '#3e2723';

            // Log 1
            ctx.beginPath(); ctx.rect(-20, -10, 15, 8); ctx.fill(); ctx.stroke();
            // Log 2
            ctx.beginPath(); ctx.rect(5, 5, 15, 8); ctx.fill(); ctx.stroke();
            // Log 3
            ctx.beginPath(); ctx.rect(-10, 10, 15, 8); ctx.fill(); ctx.stroke();
        }

        ctx.restore();
    }

    getActions(character) {
        const actions = [];

        // Check for Axe in hands
        const hasAxe = (character.inventory.hands.left && character.inventory.hands.left.id.includes('axe')) ||
                       (character.inventory.hands.right && character.inventory.hands.right.id.includes('axe'));

        if (this.state === 'standing') {
            if (hasAxe) {
                actions.push({
                    label: 'Zetnij (🪓)',
                    action: () => {
                        this.state = 'fallen';
                        return 'update';
                    }
                });
            } else {
                actions.push({
                    label: 'Potrząśnij (👋)',
                    action: () => { console.log("Nothing fell."); }
                });
            }
        } else if (this.state === 'fallen') {
            if (hasAxe) {
                actions.push({
                    label: 'Porąb (🪓)',
                    action: () => {
                        this.state = 'logs';
                        return 'update';
                    }
                });
            }
        } else if (this.state === 'logs') {
             actions.push({
                label: 'Zbierz Drewno (🫳)',
                action: () => {
                    const item = new Item(`wood_${Date.now()}`, `Drewno`, 'resource', 2.0, '🪵');
                    if (character.inventory.addItem(item)) {
                        // In a real game, maybe multiple logs. Here, we consume the pile.
                        return 'remove';
                    }
                }
            });
        }

        return actions;
    }
}

export class Bush extends GameObject {
    constructor(x, y) {
        super(x, y, 'bush');
        this.fruits = 3; // Number of berries
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Bush body
        ctx.fillStyle = '#1b5e20';
        ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(-8, -5, 12, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(8, 5, 12, 0, Math.PI*2); ctx.fill();

        // Fruits
        if (this.fruits > 0) {
            ctx.fillStyle = '#9c27b0'; // Berries
            for(let i=0; i<this.fruits; i++) {
                const angle = (Math.PI * 2 * i) / 3;
                ctx.beginPath(); ctx.arc(Math.cos(angle)*8, Math.sin(angle)*8, 3, 0, Math.PI*2); ctx.fill();
            }
        }

        ctx.restore();
    }

    getActions(character) {
        const actions = [];
        if (this.fruits > 0) {
            actions.push({
                label: 'Zbierz (🫳)',
                action: () => {
                    this.fruits--;
                    const item = new Item(`berry_${Date.now()}`, `Jagody`, 'food', 0.1, '🫐');
                    character.inventory.addItem(item);
                    return 'update';
                }
            });
            actions.push({
                label: 'Zjedz (🫐)',
                action: () => {
                    this.fruits--;
                    // Update stats directly
                    character.stats.hunger = Math.max(0, character.stats.hunger - 10);
                    character.stats.energy = Math.min(100, character.stats.energy + 5);
                    return 'update';
                }
            });
        }
        return actions;
    }
}
