import { Tree, Bush, Stone, World as BaseWorld } from './Objects.js';
import { getBiomeData, smoothNoise, mulberry32, TREE_SPECIES, SHRUB_SPECIES, STONE_SPECIES } from './TerrainGenerator.js';

const TILE_SIZE = 100;
const CHUNK_SIZE_TILES = 10;
const CHUNK_SIZE_PX = CHUNK_SIZE_TILES * TILE_SIZE; // 1000 px

class Chunk {
    constructor(cx, cy, biome, heightCtx, generateObjects = true) {
        this.cx = cx;
        this.cy = cy;
        this.x = cx * CHUNK_SIZE_PX;
        this.y = cy * CHUNK_SIZE_PX;
        this.biome = biome;
        this.objects = [];
        this.terrainCanvas = document.createElement('canvas');
        this.terrainCanvas.width = CHUNK_SIZE_PX;
        this.terrainCanvas.height = CHUNK_SIZE_PX;
        this.tileMap = []; // [y][x] = isWater
        this.isModified = false;

        this.generateTerrain(heightCtx);
        if (generateObjects) {
            this.generateObjectsLogic();
        }
        this.isGenerated = true;
    }

    generateTerrain(heightCtx) {
        const ctx = this.terrainCanvas.getContext('2d');

        for(let ty=0; ty<CHUNK_SIZE_TILES; ty++) {
            this.tileMap[ty] = [];
            for(let tx=0; tx<CHUNK_SIZE_TILES; tx++) {
                const gx = this.x + tx*TILE_SIZE;
                const gy = this.y + ty*TILE_SIZE;

                let isWater = false;
                let isDeep = false;

                // Check Ocean via HeightMap or Biome
                let isOceanChunk = (this.biome.name === "Ocean");
                const lakeNoise = smoothNoise(gx * 0.002, gy * 0.002, 777);
                isWater = isOceanChunk || (lakeNoise > this.biome.waterThreshold);

                this.tileMap[ty][tx] = isWater;

                if (isWater) {
                    const deepNoise = smoothNoise(gx * 0.005, gy * 0.005, 888);
                    isDeep = deepNoise > 0.7;

                    let color = isDeep ? "#01579b" : "#0288d1";
                    const wave = smoothNoise(gx*0.1, gy*0.1, 888);
                    if(wave > 0.6) color = isDeep ? "#0277bd" : "#039be5";

                    ctx.fillStyle = color;
                    ctx.fillRect(tx*TILE_SIZE, ty*TILE_SIZE, TILE_SIZE, TILE_SIZE);
                } else {
                    let tileColor = this.biome.terrain.base;
                    const patchNoise = smoothNoise(gx * 0.0005, gy * 0.0005, 999);
                    if(this.biome.terrain.patches) {
                        for(let patch of this.biome.terrain.patches) {
                            if(patchNoise > patch.thresh) tileColor = patch.color;
                        }
                    }
                    ctx.fillStyle = tileColor;
                    ctx.fillRect(tx*TILE_SIZE, ty*TILE_SIZE, TILE_SIZE, TILE_SIZE);
                }
            }
        }
    }

    generateObjectsLogic() {
        const buffer = 1;
        const seedBase = this.cx * 1111 + this.cy * 9999;

        for(let cy = -buffer; cy < CHUNK_SIZE_TILES + buffer; cy++) {
            for(let cx = -buffer; cx < CHUNK_SIZE_TILES + buffer; cx++) {
                const gx = this.x + cx*TILE_SIZE;
                const gy = this.y + cy*TILE_SIZE;

                const cellSeed = Math.floor(gx/TILE_SIZE) * 1111 + Math.floor(gy/TILE_SIZE) * 9999;
                const cellRng = mulberry32(cellSeed);

                // Re-check water (Logic duplicated from generateTerrain to avoid storing massive grid for neighbors)
                let isOceanChunk = (this.biome.name === "Ocean");
                const lakeNoise = smoothNoise(gx * 0.002, gy * 0.002, 777);
                const isWater = isOceanChunk || (lakeNoise > this.biome.waterThreshold);

                // Trees
                let treeChance = this.biome.density;
                const forestNoise = smoothNoise(gx*0.05, gy*0.05, 555);
                if(forestNoise > 0.6) treeChance *= 3;

                if(cellRng() < treeChance && this.biome.trees.length > 0) {
                    const tDef = this.biome.trees[Math.floor(cellRng()*this.biome.trees.length)];
                    const species = TREE_SPECIES[tDef.id];

                    if (species && species.aquatic === isWater) {
                        const ox = (cx*TILE_SIZE) + cellRng()*80;
                        const oy = (cy*TILE_SIZE) + cellRng()*80;

                        if (cx >= 0 && cx < CHUNK_SIZE_TILES && cy >= 0 && cy < CHUNK_SIZE_TILES) {
                            const wx = this.x + ox;
                            const wy = this.y + oy;
                            this.objects.push(new Tree(wx, wy, species, cellSeed));
                        }
                    }
                }

                // Bushes (Shrubs)
                let shrubChance = 0.15;
                if(cellRng() < shrubChance && this.biome.shrubs && this.biome.shrubs.length > 0) {
                    const sDef = this.biome.shrubs[Math.floor(cellRng()*this.biome.shrubs.length)];
                    const species = SHRUB_SPECIES[sDef.id];

                    if (species && species.aquatic === isWater) {
                         if (cx >= 0 && cx < CHUNK_SIZE_TILES && cy >= 0 && cy < CHUNK_SIZE_TILES) {
                            const ox = (cx*TILE_SIZE) + cellRng()*100;
                            const oy = (cy*TILE_SIZE) + cellRng()*100;
                            const wx = this.x + ox;
                            const wy = this.y + oy;
                            const size = species.size[0] + cellRng()*(species.size[1]-species.size[0]);
                            this.objects.push(new Bush(wx, wy, species, cellSeed + 1, size));
                        }
                    }
                }

                // Stones
                // Small chance for stones per tile, higher in some biomes (configured in config)
                let stoneChance = 0.03;
                // Using a different RNG stream or offset to decouple from trees/bushes
                const stoneRng = mulberry32(cellSeed + 999);

                if (stoneRng() < stoneChance && this.biome.stones && this.biome.stones.length > 0 && !isWater) {
                    const stDef = this.biome.stones[Math.floor(stoneRng() * this.biome.stones.length)];
                    // If stone definition has a chance, check it
                    if (!stDef.chance || stoneRng() < stDef.chance * 5.0) { // Multiplier to normalize low config chances
                        const species = STONE_SPECIES[stDef.id];
                        if (species) {
                             if (cx >= 0 && cx < CHUNK_SIZE_TILES && cy >= 0 && cy < CHUNK_SIZE_TILES) {
                                const ox = (cx*TILE_SIZE) + stoneRng()*90;
                                const oy = (cy*TILE_SIZE) + stoneRng()*90;
                                const wx = this.x + ox;
                                const wy = this.y + oy;
                                this.objects.push(new Stone(wx, wy, species.size));
                            }
                        }
                    }
                }
            }
        }
    }

    renderTerrain(ctx) {
        ctx.drawImage(this.terrainCanvas, this.x, this.y);
    }
}

export class WorldManager {
    constructor() {
        this.activeChunks = new Map(); // "x,y" -> Chunk
        this.savedChunks = new Map(); // "x,y" -> Array<GameObject>
        this.renderList = [];
        this.renderListDirty = true;
        this.biomeCanvas = document.createElement('canvas');
        this.biomeCtx = null;
        this.biomeData = null;
        this.heightCanvas = document.createElement('canvas');
        this.heightCtx = null;
        this.heightData = null;
        this.mapsLoaded = false;
        this.renderedObjects = [];

        this.loadingPromise = this.loadGlobalMaps();
    }

    async loadGlobalMaps() {
        try {
            const bImg = new Image();
            bImg.src = 'assets/biome_map.png';
            await new Promise((r, e) => { bImg.onload = r; bImg.onerror = e; });
            this.biomeCanvas.width = bImg.width;
            this.biomeCanvas.height = bImg.height;
            this.biomeCtx = this.biomeCanvas.getContext('2d');
            this.biomeCtx.drawImage(bImg, 0, 0);
            this.biomeData = this.biomeCtx.getImageData(0, 0, bImg.width, bImg.height);

            const hImg = new Image();
            hImg.src = 'assets/height_map.png';
            await new Promise((r, e) => { hImg.onload = r; hImg.onerror = e; });
            this.heightCanvas.width = hImg.width;
            this.heightCanvas.height = hImg.height;
            this.heightCtx = this.heightCanvas.getContext('2d');
            this.heightCtx.drawImage(hImg, 0, 0);
            this.heightData = this.heightCtx.getImageData(0, 0, hImg.width, hImg.height);

            this.mapsLoaded = true;
            console.log("Maps loaded successfully.");
        } catch (e) {
            console.error("Failed to load maps", e);
        }
    }

    update(dt, player) {
        if (!this.mapsLoaded) return;

        const cx = Math.floor(player.x / CHUNK_SIZE_PX);
        const cy = Math.floor(player.y / CHUNK_SIZE_PX);

        const loadedKeys = new Set();
        let chunksChanged = false;

        // Load 3x3 area
        for(let y = cy - 1; y <= cy + 1; y++) {
            for(let x = cx - 1; x <= cx + 1; x++) {
                const key = `${x},${y}`;
                loadedKeys.add(key);

                if (!this.activeChunks.has(key)) {
                    // Check Persistence
                    let chunk;
                    const biome = getBiomeData(x, y, this.biomeData, this.heightData);

                    if (this.savedChunks.has(key)) {
                         // Restore
                         chunk = new Chunk(x, y, biome, this.heightCtx, false); // Don't generate objects
                         chunk.objects = this.savedChunks.get(key); // Use saved objects
                         chunk.isModified = true;
                    } else {
                         // Generate Fresh
                         chunk = new Chunk(x, y, biome, this.heightCtx, true);
                    }
                    this.activeChunks.set(key, chunk);
                    chunksChanged = true;
                }
            }
        }

        // Unload far chunks
        for (const [key, chunk] of this.activeChunks) {
            if (!loadedKeys.has(key)) {
                // Save if modified
                if (chunk.isModified) {
                    this.savedChunks.set(key, chunk.objects);
                }
                this.activeChunks.delete(key);
                chunksChanged = true;
            }
        }

        if (chunksChanged) {
            this.renderListDirty = true;
        }
    }

    checkCollision(x, y) {
        if (!this.mapsLoaded) return true;
        const cx = Math.floor(x / CHUNK_SIZE_PX);
        const cy = Math.floor(y / CHUNK_SIZE_PX);
        const key = `${cx},${cy}`;
        const chunk = this.activeChunks.get(key);

        if (!chunk) return true; // Unloaded chunk is blocked

        // Check Water
        let lx = x - chunk.x;
        let ly = y - chunk.y;
        const tx = Math.floor(lx / TILE_SIZE);
        const ty = Math.floor(ly / TILE_SIZE);

        if (tx >= 0 && tx < CHUNK_SIZE_TILES && ty >= 0 && ty < CHUNK_SIZE_TILES) {
            if (chunk.tileMap[ty] && chunk.tileMap[ty][tx]) {
                return true; // Water
            }
        }

        // Check Objects
        const playerRadius = 15;
        for (const obj of chunk.objects) {
            if (obj.type === 'tree' && obj.state === 'standing') {
                 // Tree trunk collision
                 // Trunk is at obj.x, obj.y.
                 const dx = x - obj.x;
                 const dy = y - obj.y;
                 // Trunk radius ~10.
                 if (Math.hypot(dx, dy) < (playerRadius + 10)) return true;
            }
        }

        return false;
    }

    rebuildRenderList() {
        this.renderList.length = 0;
        for (const chunk of this.activeChunks.values()) {
            for (let i = 0; i < chunk.objects.length; i++) {
                this.renderList.push(chunk.objects[i]);
            }
        }
        this.renderList.sort((a, b) => a.y - b.y);
        this.renderListDirty = false;
    }

    // Split Rendering
    renderBottom(ctx) {
        if (!this.mapsLoaded) return;

        // Render Terrain
        for (const chunk of this.activeChunks.values()) {
            chunk.renderTerrain(ctx);
        }

        // Collect and Render Base Objects (Shadows, Trunks, Bushes, Stones)
        // Cache sorted objects for renderTop to reuse
        this._cachedSortedObjects = [];
        for (const chunk of this.activeChunks.values()) {
            this._cachedSortedObjects = this._cachedSortedObjects.concat(chunk.objects);
        }
        this._cachedSortedObjects.sort((a, b) => a.y - b.y);

        const allObjects = this.renderList;

        // Add Player
        if (player) {
            objectsToRender.push(player);
        }

        // Sort by Y for Depth
        objectsToRender.sort((a, b) => a.y - b.y);

        // Render Crowns (Upper Layer)
        // Reuse sorted objects from renderBottom if available
        let allObjects = this._cachedSortedObjects;

        // Fallback if renderBottom wasn't called (though it should be)
        if (!allObjects) {
            allObjects = [];
            for (const chunk of this.activeChunks.values()) {
                allObjects = allObjects.concat(chunk.objects);
            }
            allObjects.sort((a, b) => a.y - b.y);
        }

        const allObjects = this.renderList;

        // Render Top Layer (Tree Crowns)
        for (const obj of objectsToRender) {
            if (obj.renderCrown) {
                obj.renderCrown(ctx);
            }
        }
    }

    // Adapt Interface for Game
    add(obj) {
        const cx = Math.floor(obj.x / CHUNK_SIZE_PX);
        const cy = Math.floor(obj.y / CHUNK_SIZE_PX);
        const key = `${cx},${cy}`;
        if (this.activeChunks.has(key)) {
            const chunk = this.activeChunks.get(key);
            chunk.objects.push(obj);
            chunk.isModified = true;
            this.renderListDirty = true;
        }
    }

    remove(obj) {
        for (const chunk of this.activeChunks.values()) {
            const idx = chunk.objects.indexOf(obj);
            if (idx !== -1) {
                chunk.objects.splice(idx, 1);
                chunk.isModified = true;
                this.renderListDirty = true;
                return;
            }
        }
    }

    getNearestObject(x, y, maxDist = 40) {
        let nearest = null;
        let minDist = maxDist;

        const cx = Math.floor(x / CHUNK_SIZE_PX);
        const cy = Math.floor(y / CHUNK_SIZE_PX);

        for (let ny = cy - 1; ny <= cy + 1; ny++) {
            for (let nx = cx - 1; nx <= cx + 1; nx++) {
                const key = `${nx},${ny}`;
                const chunk = this.activeChunks.get(key);
                if (chunk) {
                    for (let obj of chunk.objects) {
                        const dist = Math.hypot(obj.x - x, obj.y - y);
                        if (dist < minDist) {
                            minDist = dist;
                            nearest = obj;
                        }
                    }
                }
            }
        }
        return nearest;
    }
}
