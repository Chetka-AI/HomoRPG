# Game Elements and Interactions Summary

## Entities

### Player
- **Type:** Character (MobileEntity)
- **Features:**
  - Movement (WASD/Touch) with physics (acceleration, friction, collision).
  - Stats (Health, Energy, Hunger, Thirst, Toilet, Mass, Strength, Endurance).
  - Inventory system (Weight limit based on Strength).
  - Tools handling (Axe, Pickaxe).

### Animals
- **Type:** Animal (MobileEntity)
- **Species Implemented:**
  - **Deer:**
    - Behavior: Passive (Idle/Wander state machine).
    - Movement: Random wandering.
    - Rendering: Supports PNG sprites (fallback to placeholder).
- **Structure:**
  - Inherits from `MobileEntity` (shared physics with Player).
  - Configurable via `species` object (speed, color, size, behavior).

### Vegetation
- **Trees:**
  - **Species:** Oak, Birch, Pine.
  - **Rendering:** Two-layer rendering (Trunk at base, Canopy at top).
  - **Interaction:** Chop (requires Axe) -> Drops Wood.
  - **Animation:** Wind sway effect.
- **Bushes:**
  - **Species:** Berry Bush.
  - **Rendering:** Procedural or Sprite.
  - **Interaction:** Gather -> Drops Berries.

### Environment
- **Stones:**
  - **Types:** Small, Medium, Large.
  - **Interaction:** Mine (requires Pickaxe) -> Drops Stone.
- **Terrain:**
  - **Biomes:** Forest, Savanna, Desert, Ocean, Snow.
  - **Features:** Height map (Mountains), Water (Ocean/Lakes).

## Interactions

### Movement & Physics
- **Collision:** Circle-based collision against Tiles (Water) and Objects (Tree trunks).
- **Physics:** Velocity-based movement with friction.

### Actions
- **Chop:** Attacks tree entities, reducing health, drops wood on destruction.
- **Mine:** Attacks stone entities, drops stone resources.
- **Gather:** Collects resources from bushes.
- **Eat/Drink:** Consumes items from inventory to restore stats.

### Systems
- **World Generation:** Infinite procedural generation using noise (Simplex/Perlin).
- **Chunk System:** efficient loading/unloading of world areas (1000px chunks).
- **Inventory UI:** Drag-and-drop management, weight calculation.
