
// TerrainGenerator.js

// 1. CONFIGURATION & TOOLS
export const TILE_SIZE_PX = 100;
const VIEWPORT_METERS = 10;

export function mulberry32(a) {
    return function() {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
}

export function noise(x, y, seed) {
    const floorX = Math.floor(x);
    const floorY = Math.floor(y);
    const s = Math.sin(floorX * 12.9898 + floorY * 78.233 + seed) * 43758.5453;
    return s - Math.floor(s);
}

export function smoothNoise(x, y, seed) {
    const fractX = x - Math.floor(x);
    const fractY = y - Math.floor(y);
    const x1 = Math.floor(x);
    const y1 = Math.floor(y);
    const x2 = x1 + 1;
    const y2 = y1 + 1;

    const bl = noise(x1, y1, seed);
    const br = noise(x2, y1, seed);
    const tl = noise(x1, y2, seed);
    const tr = noise(x2, y2, seed);

    const tx = fractX * fractX * (3 - 2 * fractX);
    const ty = fractY * fractY * (3 - 2 * fractY);

    const b = bl + (br - bl) * tx;
    const t = tl + (tr - tl) * tx;
    return b + (t - b) * ty;
}

// 2. BOTANICAL ATLAS
export const TREE_SPECIES = {
    // --- TEMPERATE ---
    oak: {
        name: "Dąb", trunkColor: "#4e342e", trunkSize: [45, 65],
        crownColors: ["#2e7d32", "#1b5e20", "#33691e"], crownSize: [350, 600],
        type: 'lobes', cluster: 0.3, aquatic: false
    },
    birch: {
        name: "Brzoza", trunkColor: "#eeeeee", trunkSize: [20, 35],
        crownColors: ["#81c784", "#66bb6a"], crownSize: [220, 380],
        type: 'sparse', cluster: 0.8, aquatic: false
    },
    maple: {
        name: "Klon", trunkColor: "#3e2723", trunkSize: [35, 55],
        crownColors: ["#d84315", "#ef6c00", "#c62828"], crownSize: [300, 500],
        type: 'lobes', cluster: 0.4, aquatic: false
    },
    beech: {
        name: "Buk", trunkColor: "#9e9e9e", trunkSize: [50, 80],
        crownColors: ["#f9a825", "#ff8f00"], crownSize: [400, 650],
        type: 'lobes', cluster: 0.5, aquatic: false
    },

    // --- CONIFEROUS ---
    spruce: {
        name: "Świerk", trunkColor: "#3e2723", trunkSize: [30, 50],
        crownColors: ["#1b5e20", "#004d40"], crownSize: [250, 400],
        type: 'star', cluster: 0.7, aquatic: false
    },
    pine: {
        name: "Sosna", trunkColor: "#5d4037", trunkSize: [30, 45],
        crownColors: ["#388e3c", "#2e7d32"], crownSize: [250, 450],
        type: 'rough', cluster: 0.5, aquatic: false
    },

    // --- EXOTIC / WARM ---
    baobab: {
        name: "Baobab", trunkColor: "#795548", trunkSize: [150, 250],
        crownColors: ["#558b2f"], crownSize: [400, 600],
        type: 'sparse', cluster: 0.1, aquatic: false
    },
    acacia: {
        name: "Akacja", trunkColor: "#5d4037", trunkSize: [35, 55],
        crownColors: ["#7cb342"], crownSize: [450, 700],
        type: 'flat', cluster: 0.2, aquatic: false
    },
    cactus: {
        name: "Saguaro", trunkColor: "#43a047", trunkSize: [40, 60],
        crownColors: ["#43a047"], crownSize: [40, 60],
        type: 'column', cluster: 0.3, aquatic: false
    },
    palm: {
        name: "Palma", trunkColor: "#8d6e63", trunkSize: [25, 40],
        crownColors: ["#43a047", "#2e7d32"], crownSize: [250, 400],
        type: 'palm', cluster: 0.4, aquatic: false
    },

    // --- AQUATIC ---
    mangrove: {
        name: "Namorzyny", trunkColor: "#4e342e", trunkSize: [40, 70],
        crownColors: ["#2e7d32"], crownSize: [300, 500],
        type: 'lobes', cluster: 0.9, aquatic: true
    },
    willow: {
        name: "Wierzba Pł.", trunkColor: "#424242", trunkSize: [40, 70],
        crownColors: ["#7cb342", "#558b2f"], crownSize: [300, 500],
        type: 'weeping', cluster: 0.2, aquatic: true
    }
};

export const SHRUB_SPECIES = {
    fern: { name: "Paproć", colors: ["#66bb6a"], size: [80, 140], type: 'fern', aquatic: false },
    berry: { name: "Jagody", colors: ["#2e7d32"], size: [60, 100], type: 'bush_dots', aquatic: false },
    dry_bush: { name: "Suche krzaki", colors: ["#a1887f"], size: [70, 110], type: 'tuft', aquatic: false },
    reeds: { name: "Trzcina", colors: ["#dce775", "#c0ca33"], size: [60, 100], type: 'reeds', aquatic: true },
    lilypad: { name: "Lilia wodna", colors: ["#81c784"], size: [40, 60], type: 'lily', aquatic: true },
    succulent: { name: "Sukulenty", colors: ["#80cbc4"], size: [30, 50], type: 'bush_dots', aquatic: false }
};

// 3. BIOME DEFINITIONS
export const BIOME_CONFIG = {
    marine: { name: "Ocean", terrain: {base:"#0277bd"}, waterThreshold: 0.0, trees: [], shrubs: [] },

    temperate_deciduous: {
        name: "Las Liściasty",
        terrain: { base: "#558b2f", patches: [{color: "#33691e", thresh: 0.4}] },
        waterThreshold: 0.75,
        trees: [{id: 'oak', chance: 0.4}, {id: 'birch', chance: 0.3}, {id: 'maple', chance: 0.1}],
        shrubs: [{id: 'fern', chance: 0.3}, {id: 'berry', chance: 0.2}],
        density: 0.05
    },

    taiga: {
        name: "Tajga",
        terrain: { base: "#5d4037", patches: [{color: "#4e342e", thresh: 0.3}] },
        waterThreshold: 0.7,
        trees: [{id: 'spruce', chance: 0.6}, {id: 'pine', chance: 0.3}],
        shrubs: [{id: 'fern', chance: 0.1}],
        density: 0.07
    },

    tropical_rainforest: {
        name: "Dżungla",
        terrain: { base: "#1b5e20", patches: [{color: "#004d40", thresh: 0.6}] },
        waterThreshold: 0.55,
        trees: [{id: 'mangrove', chance: 0.3}, {id: 'palm', chance: 0.4}],
        shrubs: [{id: 'fern', chance: 0.6}, {id: 'lilypad', chance: 0.3}],
        density: 0.09
    },

    hot_desert: {
        name: "Pustynia",
        terrain: { base: "#ffcc80", patches: [{color: "#ffe0b2", thresh: 0.6}] },
        waterThreshold: 0.98,
        trees: [{id: 'cactus', chance: 0.05}, {id: 'palm', chance: 0.01}],
        shrubs: [{id: 'succulent', chance: 0.1}, {id: 'dry_bush', chance: 0.2}],
        density: 0.005
    },

    savanna: {
        name: "Sawanna",
        terrain: { base: "#dcedc8", patches: [{color: "#fff9c4", thresh: 0.5}] },
        waterThreshold: 0.85,
        trees: [{id: 'acacia', chance: 0.8}, {id: 'baobab', chance: 0.2}],
        shrubs: [{id: 'dry_bush', chance: 0.4}],
        density: 0.015
    },

    wetlands: {
        name: "Mokradła",
        terrain: { base: "#3e2723", patches: [{color: "#2e7d32", thresh: 0.6}] },
        waterThreshold: 0.35,
        trees: [{id: 'willow', chance: 0.5}, {id: 'mangrove', chance: 0.5}],
        shrubs: [{id: 'reeds', chance: 0.8}, {id: 'lilypad', chance: 0.4}],
        density: 0.03
    }
};

const DEFAULT_BIOME = BIOME_CONFIG.temperate_deciduous;

// 4. GENERATOR LOGIC

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Pre-parse biome colors for distance checking
const biomeColors = [
    { config: BIOME_CONFIG.hot_desert, r: 255, g: 204, b: 128 }, // #ffcc80 (approx)
    { config: BIOME_CONFIG.tropical_rainforest, r: 27, g: 94, b: 32 }, // #1b5e20
    { config: BIOME_CONFIG.taiga, r: 93, g: 64, b: 55 }, // #5d4037
    { config: BIOME_CONFIG.wetlands, r: 62, g: 39, b: 35 }, // #3e2723
    { config: BIOME_CONFIG.savanna, r: 220, g: 237, b: 200 }, // #dcedc8
    { config: BIOME_CONFIG.temperate_deciduous, r: 85, g: 139, b: 47 } // #558b2f
];

// Heuristics from script.js, adapted
function detectBiomeByHeuristic(r, g, b) {
    // Pustynia (red > 200, green > 180, blue < 150)
    if(r > 200 && g > 180 && b < 150) return BIOME_CONFIG.hot_desert;

    // Las deszczowy (green > red, green < 100)
    if(g > r && g < 100) return BIOME_CONFIG.tropical_rainforest;

    // Tajga (red < 100, green < 120, blue < 100)
    if(r < 100 && g < 120 && b < 100) return BIOME_CONFIG.taiga;

    // Mokradła (all < 100 approx)
    if(r < 80 && g < 100 && b < 80) return BIOME_CONFIG.wetlands;

    // Sawanna (bright green/yellow)
    if(r > 150 && g > 180 && b < 150) return BIOME_CONFIG.savanna;

    return BIOME_CONFIG.temperate_deciduous;
}

export function getBiomeData(chunkX, chunkY, biomeCtx, heightCtx) {
    if (!biomeCtx) return DEFAULT_BIOME;

    // 1 Pixel = 1 Chunk.
    // Ensure coordinates are within bounds of the map.
    // We assume the map is large (e.g. 4000x4000).
    // If chunkX is negative or outside, we clamp or wrap?
    // Let's clamp for now to avoid errors, or return Marine if outside.
    const width = biomeCtx.canvas.width;
    const height = biomeCtx.canvas.height;

    if (chunkX < 0 || chunkX >= width || chunkY < 0 || chunkY >= height) {
        return BIOME_CONFIG.marine;
    }

    const p = biomeCtx.getImageData(chunkX, chunkY, 1, 1).data;
    const r=p[0], g=p[1], b=p[2];

    // Check Ocean via HeightMap if provided
    let isOcean = false;
    let elevation = 0;

    if (heightCtx) {
        const hData = heightCtx.getImageData(chunkX, chunkY, 1, 1).data;
        // Monochromatic, so R=G=B.
        // #2A2A2A = 42.
        const hVal = hData[0];
        if (hVal < 42) {
            isOcean = true;
        }
        elevation = hVal;
    } else {
        // Fallback: Blue channel dominance
        if (b > r && b > g) isOcean = true;
    }

    if (isOcean) return BIOME_CONFIG.marine;

    // Biome Detection
    return detectBiomeByHeuristic(r, g, b);
}
