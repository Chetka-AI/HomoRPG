import { Item } from './Inventory.js';
import { mulberry32 } from './TerrainGenerator.js';

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

    render(ctx) {
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
        const rng = mulberry32(this.seed);

        if (sizeInfo) {
            this.trunkSize = sizeInfo.trunkSize;
            this.crownSize = sizeInfo.crownSize;
        } else {
            const tMin = this.species.trunkSize[0], tMax = this.species.trunkSize[1];
            const cMin = this.species.crownSize[0], cMax = this.species.crownSize[1];
            this.trunkSize = tMin + rng()*(tMax - tMin);
            this.crownSize = cMin + rng()*(cMax - cMin);
        }

        this.state = 'standing'; // 'standing', 'fallen', 'logs'
        this.cache = null;
    }

    updateCache() {
        if (typeof document === 'undefined') return;

        const trunkW = this.trunkSize;
        const size = Math.ceil(trunkW * 3);
        this.cache = document.createElement('canvas');
        this.cache.width = size;
        this.cache.height = size;
        const ctx = this.cache.getContext('2d');

        ctx.translate(size / 2, size / 2);

        const rng = mulberry32(this.seed);
        this.drawStandingTrunk(ctx, rng);
    }

    drawStandingTrunk(ctx, rng) {
        const species = this.species;
        const trunkW = this.trunkSize;

        // --- TRUNK ---
        ctx.fillStyle = "rgba(0,0,0,0.5)"; // Shadow base
        ctx.beginPath(); ctx.ellipse(5, 5, trunkW/2, trunkW/2, 0, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = species.trunkColor;

        if (species.type === 'column') { // Cactus
            ctx.beginPath(); ctx.arc(0, 0, trunkW*0.4, 0, Math.PI*2); ctx.fill();
            if(rng()>0.5) { // Arm
                ctx.beginPath(); ctx.arc(trunkW*0.4, -trunkW*0.2, trunkW*0.2, 0, Math.PI*2); ctx.fill();
            }
        } else if (species.type === 'roots_visible') { // Mangrove
            ctx.beginPath();
            for(let i=0; i<5; i++) {
                const ang = (i/5)*Math.PI*2;
                const r = trunkW*0.8;
                ctx.moveTo(Math.cos(ang)*r, Math.sin(ang)*r);
                ctx.lineTo(0,0);
            }
            ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, trunkW*0.3, 0, Math.PI*2); ctx.fill();
        } else if (species.type === 'fat_trunk') { // Baobab
            ctx.beginPath(); ctx.arc(0, 0, trunkW*0.6, 0, Math.PI*2); ctx.fill();
        } else {
            ctx.beginPath();
            const points = 7;
            for(let i=0; i<=points; i++) {
                const ang = i*(Math.PI*2/points);
                const r = (trunkW/2) * (0.85 + rng()*0.3);
                const px = Math.cos(ang)*r;
                const py = Math.sin(ang)*r;
                if(i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
            }
            ctx.fill();
        }

        // Details on trunk (e.g. birch dots)
        if (species.type === 'sparse_dots') {
            ctx.fillStyle = "#333";
            for(let i=0; i<5; i++) {
                const tx = (rng()-0.5)*trunkW*0.6;
                const ty = (rng()-0.5)*trunkW*0.6;
                ctx.fillRect(tx, ty, 3, 2);
            }
        }
    }

    render(ctx) {
        const rng = mulberry32(this.seed);
        const species = this.species;
        const trunkW = this.trunkSize;

        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.state === 'standing') {
            if (!this.cache && typeof document !== 'undefined') {
                this.updateCache();
            }
            if (this.cache) {
                ctx.drawImage(this.cache, -this.cache.width / 2, -this.cache.height / 2);
            } else {
                this.drawStandingTrunk(ctx, rng);
            }
        } else if (this.state === 'fallen') {
            // Simplified fallen state
            ctx.rotate(Math.PI / 2);
            ctx.fillStyle = species.trunkColor;
            ctx.fillRect(-trunkW, -trunkW/4, trunkW*2, trunkW/2);
        } else if (this.state === 'logs') {
            ctx.fillStyle = species.trunkColor;
            ctx.strokeStyle = '#3e2723';
            ctx.beginPath(); ctx.rect(-10, -5, 8, 4); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.rect(5, 5, 8, 4); ctx.fill(); ctx.stroke();
        }

        ctx.restore();
    }

    renderCrown(ctx, player) {
        if (this.state !== 'standing') return;

        const rng = mulberry32(this.seed);
        const species = this.species;
        const size = this.crownSize;

        if (species.type === 'column') return; // Cactus has no separate crown

        // Transparency Logic
        const dist = Math.hypot(this.x - player.x, this.y - player.y);
        const isTransparent = dist < 500; // 5 tiles approx

        ctx.save();

        // Sway Animation
        const sway = Math.sin(this.time * 2 + this.x * 0.1) * 5;
        ctx.translate(this.x + sway, this.y);

        if (isTransparent) ctx.globalAlpha = 0.4;

        const crownColor = species.crownColors[Math.floor(rng() * species.crownColors.length)];
        ctx.fillStyle = crownColor;
        ctx.strokeStyle = crownColor;

        // Shadow under crown
        ctx.fillStyle = "rgba(0,0,0,0.1)";
        ctx.beginPath(); ctx.arc(0, 0, size*0.4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = crownColor; // Reset

        switch(species.type) {
            case 'palm': {
                const leaves = 6;
                for(let i=0; i<leaves; i++) {
                    const angle = (i/leaves)*Math.PI*2 + rng();
                    const len = size*0.6;
                    ctx.beginPath();
                    ctx.moveTo(0,0);
                    const cpx = Math.cos(angle)*len*0.5;
                    const cpy = Math.sin(angle)*len*0.5 - 20;
                    const ex = Math.cos(angle)*len;
                    const ey = Math.sin(angle)*len;

                    ctx.quadraticCurveTo(cpx, cpy, ex, ey);
                    ctx.lineWidth = size*0.05;
                    ctx.stroke();
                }
                break;
            }
            case 'flat': { // Acacia
                const blobs = 5;
                for(let i=0; i<blobs; i++) {
                    const angle = (i/blobs)*Math.PI*2;
                    const dist = size*0.3;
                    ctx.beginPath();
                    ctx.ellipse(Math.cos(angle)*dist, Math.sin(angle)*dist, size*0.2, size*0.15, 0, 0, Math.PI*2);
                    ctx.fill();
                }
                break;
            }
            case 'layered_triangles': // Spruce, Fir
            case 'smooth_cone': {
                const layers = 4 + Math.floor(rng()*3);
                const step = size / layers;
                for(let i=0; i<layers; i++) {
                    const layerW = size * (0.6 - (i/layers)*0.5); // Tapering
                    const yPos = -i * (step * 0.7); // Going up
                    ctx.beginPath();
                    ctx.moveTo(0, yPos - step);
                    ctx.lineTo(layerW, yPos);
                    ctx.lineTo(-layerW, yPos);
                    ctx.fill();
                }
                break;
            }
            case 'high_canopy': // Pine
                ctx.beginPath();
                ctx.arc(0, -size*0.2, size*0.35, 0, Math.PI*2);
                ctx.fill();
                // Add some irregularities
                for(let i=0; i<5; i++) {
                    const a = rng()*Math.PI*2;
                    const r = size*0.35;
                    ctx.beginPath(); ctx.arc(Math.cos(a)*r, -size*0.2 + Math.sin(a)*r, size*0.15, 0, Math.PI*2); ctx.fill();
                }
                break;
            case 'drooping_lines': // Willow
                ctx.lineWidth = 2;
                const branches = 40;
                for(let i=0; i<branches; i++) {
                    const angle = rng() * Math.PI * 2;
                    const dist = rng() * size * 0.3;
                    const len = size * (0.6 + rng()*0.6);
                    ctx.beginPath();
                    const sx = Math.cos(angle)*dist;
                    const sy = Math.sin(angle)*dist;
                    ctx.moveTo(sx, sy);
                    ctx.quadraticCurveTo(sx*1.2, sy + len*0.3, sx, sy + len);
                    ctx.stroke();
                }
                break;
            case 'huge_leaves': // Banana
                const leaves = 6 + Math.floor(rng()*3);
                for(let i=0; i<leaves; i++) {
                    const angle = (i/leaves) * Math.PI * 2;
                    ctx.save();
                    ctx.rotate(angle);
                    ctx.beginPath();
                    ctx.ellipse(size*0.3, 0, size*0.3, size*0.1, 0, 0, Math.PI*2);
                    ctx.fill();
                    ctx.beginPath(); // Leaf vein
                    ctx.strokeStyle = "rgba(0,0,0,0.1)";
                    ctx.lineWidth = 1;
                    ctx.moveTo(0,0); ctx.lineTo(size*0.6, 0);
                    ctx.stroke();
                    ctx.restore();
                }
                break;
            case 'tall_column': // Poplar
                ctx.beginPath();
                ctx.ellipse(0, -size*0.2, size*0.15, size*0.6, 0, 0, Math.PI*2);
                ctx.fill();
                break;
            case 'sparse_dots': // Birch
            case 'sparse':
            case 'sparse_needles': // Larch
                ctx.globalAlpha = isTransparent ? 0.4 : 0.8;
                for(let i=0; i<20; i++) {
                    const a = rng()*Math.PI*2;
                    const r = rng()*size*0.4;
                    ctx.beginPath();
                    ctx.arc(Math.cos(a)*r, Math.sin(a)*r, size*0.1, 0, Math.PI*2);
                    ctx.fill();
                }
                break;
            case 'complex_lobes': // Oak
            case 'fat_trunk': // Baobab
            case 'roots_visible': // Mangrove
            case 'lobes':
            default:
                // Standard lobes
                const lobeCount = 10 + Math.floor(rng()*5);
                for(let i=0; i<lobeCount; i++) {
                    const ang = rng()*Math.PI*2;
                    const dist = rng()*size*0.35;
                    const rad = size*(0.15+rng()*0.1);
                    ctx.beginPath();
                    ctx.arc(Math.cos(ang)*dist, Math.sin(ang)*dist, rad, 0, Math.PI*2);
                    ctx.fill();
                }
                ctx.beginPath(); ctx.arc(0,0,size*0.25, 0, Math.PI*2); ctx.fill();
                break;
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
        if (this.hasFruits) {
            const fruitDef = this.species.fruit || {};
            ctx.fillStyle = fruitDef.color || '#9c27b0';
            const count = this.fruits;
            const radius = 10;
            for(let i=0; i<count; i++) {
                const angle = (Math.PI * 2 * i) / count;
                ctx.beginPath(); ctx.arc(Math.cos(angle)*radius, Math.sin(angle)*radius, 3, 0, Math.PI*2); ctx.fill();
            }
        }

        ctx.restore();
    }

    getActions(character) {
        const actions = [];
        if (this.hasFruits) {
            actions.push({
                label: 'Zbierz (🫳)',
                action: () => {
                    this.fruits--;
                    const fruitDef = this.species.fruit;
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
