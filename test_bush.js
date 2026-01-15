import { Bush } from './Objects.js';

// Mock dependencies
// We need to mock document/canvas for GameObject/Tree if we import them,
// but Bush extends GameObject.
// Objects.js imports Item and mulberry32.
// We can let it import them if they don't have side effects.
// TerrainGenerator.js seems pure-ish.
// Inventory.js might use DOM.

// Let's rely on the fact that I can just import Objects.js if I handle the environment.
// But wait, Objects.js imports Item from Inventory.js.
// Inventory.js likely interacts with DOM.
// Let's check Inventory.js first.
