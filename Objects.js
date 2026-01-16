import { Item } from './Inventory.js';
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

export class World {
    constructor() {
        this.objects = [];
    }

    add(obj) {
        this.objects.push(obj);
    }

    remove(obj) {
        const index = this.objects.indexOf(obj);
        if (index > -1) {
            this.objects.splice(index, 1);
        }
    }

    update(dt) {
        for (const obj of this.objects) {
            if (obj.update) obj.update(dt);
        }
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
        this.time = Math.random() * 1000;
    }

    update(dt) {
        this.time += dt * 0.001; // Convert ms to seconds
    }

    render(ctx, player = null) {
        throw new Error(`Render method not implemented for ${this.constructor.name}`);
    }

    getActions(character) {
        return [];
    }
}

export class Stone extends GameObject {
    constructor(x, y, size) { // size: number | string
        super(x, y, 'stone');
        this.size = size;

        if (typeof size === 'number') {
            this.radius = size;
        } else {
            this.radius = size === 'small' ? 10 : (size === 'medium' ? 15 : 25);
        }

        // Mass based on size approx (volume)
        // r=10 -> mass=1, r=25 -> mass=15
        this.mass = Math.pow(this.radius / 10, 3);

        this.color = this.radius <= 10 ? '#a8a8a8' : (this.radius <= 15 ? '#808080' : '#505050');

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
                    const item = new Item(`stone_${Date.now()}`, `Kamień (${Math.round(this.mass)}kg)`, 'resource', this.mass, '🪨');
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
    constructor(x, y, species, seed, sizeInfo) {
        super(x, y, 'tree');
        this.species = species || {
            name: "Dąb", trunkColor: "#4e342e", trunkSize: [45, 65],
            crownColors: ["#2e7d32"], crownSize: [350, 600],
            type: 'lobes'
        };
        this.seed = seed || Date.now();
        this.state = 'standing'; // 'standing', 'fallen', 'logs'

        // Load Image
        if (this.species.imagePath) {
            this.image = getImage(this.species.imagePath);
        }

        // Default size for display
        this.displayHeight = 300; // Approx 3 tiles high
    }

    render(ctx, player) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.state === 'standing') {
             // Draw Trunk Base (Collision visual)
            ctx.fillStyle = this.species.trunkColor || '#4e342e';
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.state === 'fallen') {
            // Simplified fallen state
            ctx.rotate(Math.PI / 2);
            ctx.fillStyle = this.species.trunkColor || '#4e342e';
            ctx.fillRect(-20, -10, 100, 20);
        } else if (this.state === 'logs') {
            ctx.fillStyle = this.species.trunkColor || '#4e342e';
            ctx.strokeStyle = '#3e2723';
            ctx.beginPath(); ctx.rect(-10, -5, 8, 4); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.rect(5, 5, 8, 4); ctx.fill(); ctx.stroke();
        }

        ctx.restore();
    }

    renderCrown(ctx) {
        if (this.state !== 'standing') return;

        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.image && this.image.complete && this.image.naturalWidth > 0) {
            const aspect = this.image.naturalWidth / this.image.naturalHeight;
            const h = this.displayHeight;
            const w = h * aspect;

            // Sway Animation
            const sway = Math.sin(this.time * 2 + this.x * 0.1) * 3;

            // Draw anchored at bottom center (image represents crown above head)
            ctx.translate(sway, 0);
            ctx.drawImage(this.image, -w / 2, -h, w, h);
        } else {
            // Fallback placeholder
            ctx.fillStyle = this.species.crownColors ? this.species.crownColors[0] : 'green';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(-20, -100);
            ctx.lineTo(20, -100);
            ctx.fill();
        }

        ctx.restore();
    }

    getActions(character) {
        const actions = [];
        const hasAxe = (character.inventory.hands.left && character.inventory.hands.left.id.includes('axe')) ||
                       (character.inventory.hands.right && character.inventory.hands.right.id.includes('axe'));

        if (this.state === 'standing') {
            if (hasAxe) {
                actions.push({
                    label: 'Zetnij (🪓)',
                    action: () => { this.state = 'fallen'; this.cache = null; return 'update'; }
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
                    action: () => { this.state = 'logs'; this.cache = null; return 'update'; }
                });
            }
        } else if (this.state === 'logs') {
             actions.push({
                label: 'Zbierz Drewno (🫳)',
                action: () => {
                    const item = new Item(`wood_${Date.now()}`, `Drewno (${this.species.name})`, 'resource', 2.0, '🪵');
                    if (character.inventory.addItem(item)) { return 'remove'; }
                }
            });
        }
        return actions;
    }
}

export class Bush extends GameObject {
    constructor(x, y, species, seed, size) {
        super(x, y, 'bush');
        this.species = species || {
            name: "Jagody",
            colors: ["#2e7d32"],
            size: [60, 100],
            type: 'bush_dots',
            aquatic: false,
            fruit: {
                id: 'berry',
                name: "Jagody",
                stats: { nutrition: 10, hydration: 5 },
                color: '#9c27b0',
                countRange: [2, 5],
                icon: '🫐'
            }
        };
        this.seed = seed || Date.now();
        this.size = size || 60; // Default or passed

        this.fruits = 0;
        // Generalized fruit logic: determines count based on species definition
        if (this.species.fruit) {
             const rng = mulberry32(this.seed + 100);
             const min = this.species.fruit.countRange ? this.species.fruit.countRange[0] : 0;
             const max = this.species.fruit.countRange ? this.species.fruit.countRange[1] : 0;
             this.fruits = Math.floor(min + rng() * (max - min + 1));
        }
    }

    get hasFruits() {
        return this.fruits > 0;
    }

    render(ctx) {
        const rng = mulberry32(this.seed);
        const species = this.species;
        const size = this.size;

        ctx.save();

        // Sway Animation
        const sway = Math.sin(this.time * 3 + this.y * 0.1) * 2;
        ctx.translate(this.x + sway, this.y);

        ctx.fillStyle = species.colors[0];

        if(species.type === 'reeds') {
            // Draw multiple stalks
            const c = species.colors[Math.floor(rng()*species.colors.length)];
            ctx.fillStyle = c;
            for(let i=0; i<8; i++) {
                const h = size * (0.6 + rng()*0.5);
                const ox = (rng()-0.5)*size*0.5;
                const oy = 0; // Base at center
                // In script.js: ctx.fillRect(x + (rng()-0.5)*size*0.5, y, 3, -h);
                // Here: relative to 0,0
                ctx.fillRect(ox, oy, 3, -h);
                // Reed head
                if(rng()>0.5) {
                    ctx.fillStyle = "#5d4037";
                    ctx.fillRect(ox - 1, oy - h, 5, 10);
                    ctx.fillStyle = c;
                }
            }
        }
        else if(species.type === 'lily') {
            ctx.beginPath();
            ctx.arc(0, 0, size*0.4, 0.2 * Math.PI, 1.8 * Math.PI);
            ctx.lineTo(0, 0);
            ctx.fill();
            if(rng()>0.6) {
                ctx.fillStyle = "#f8bbd0";
                ctx.beginPath(); ctx.arc(0, 0, size*0.15, 0, Math.PI*2); ctx.fill();
            }
        }
        else if(species.type === 'fern') {
            const leaves = 7;
            ctx.beginPath();
            for(let i=0; i<leaves; i++) {
                const angle = (i/leaves) * Math.PI*2;
                const lLen = size*0.5;
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle)*lLen, Math.sin(angle)*lLen);
                // Simplify curve for canvas
                // ctx.lineTo(Math.cos(angle+0.2)*lLen*0.8, Math.sin(angle+0.2)*lLen*0.8);
            }
            // Use stroke for fern lines or fill polygon?
            // script.js uses fill() on a path that goes move->line->line. It creates triangles.
            ctx.fill();
        }
        else if(species.type === 'flower') {
            // Pansies/Flowers
            const petals = 5;
            for(let i=0; i<petals; i++) {
                ctx.fillStyle = species.colors[i % species.colors.length];
                ctx.beginPath();
                const ang = (i/petals)*Math.PI*2;
                const r = size*0.4;
                ctx.arc(Math.cos(ang)*r*0.6, Math.sin(ang)*r*0.6, r*0.5, 0, Math.PI*2);
                ctx.fill();
            }
            // Center
            ctx.fillStyle = "#ffeb3b";
            ctx.beginPath(); ctx.arc(0,0,size*0.15,0,Math.PI*2); ctx.fill();
        }
        else {
            // Standard bush
            ctx.beginPath(); ctx.arc(0, 0, size*0.35, 0, Math.PI*2); ctx.fill();
        }

            // Fruits
            if (this.hasFruits && this.species.fruit) {
                ctx.fillStyle = this.species.fruit.color || '#9c27b0';
                const count = Math.max(1, this.fruits);
                for(let i=0; i<this.fruits; i++) {
                    const angle = (Math.PI * 2 * i) / count;
                    ctx.beginPath(); ctx.arc(Math.cos(angle)*8, Math.sin(angle)*8, 3, 0, Math.PI*2); ctx.fill();
                }
            }
        }

        ctx.restore();
    }

    getActions(character) {
        const actions = [];
        if (this.hasFruits) {
            const fruitDef = this.species.fruit;
            actions.push({
                label: `Zbierz ${fruitDef.name} (🫳)`,
                action: () => {
                    this.fruits--;
                    const item = new Item(
                        `${fruitDef.id}_${Date.now()}`,
                        fruitDef.name,
                        'food',
                        0.1,
                        fruitDef.icon || '🫐'
                    );
                    item.stats = fruitDef.stats || {};
                    character.inventory.addItem(item);
                    return 'update';
                }
            });
        }
        // General action for others?
        actions.push({
            label: 'Zbadaj (👀)',
            action: () => { console.log(`To jest ${this.species.name}.`); }
        });

        if (this.species.type === 'reeds') {
             actions.push({
                label: 'Zbierz Trzcinę (🌾)',
                action: () => {
                    const item = new Item(`reeds_${Date.now()}`, `Trzcina`, 'resource', 0.2, '🌾');
                    if (character.inventory.addItem(item)) {
                        return 'remove';
                    }
                }
            });
        } else if (this.species.type === 'tuft' || this.species.id === 'dry_bush') {
             actions.push({
                label: 'Zbierz Patyki (🪵)',
                action: () => {
                    const item = new Item(`stick_${Date.now()}`, `Patyk`, 'resource', 0.1, '🪵');
                    if (character.inventory.addItem(item)) {
                        return 'remove';
                    }
                }
            });
        }
        return actions;
    }
}
