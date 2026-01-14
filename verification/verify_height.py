from playwright.sync_api import sync_playwright
import time

def run_verification(page):
    # Console listener
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

    print("Navigating to game...")
    page.goto("http://localhost:8000")

    # Wait for game object
    page.wait_for_function("() => window.game", timeout=5000)
    print("Game object found.")

    # Check WorldManager existence
    wm_exists = page.evaluate("() => !!window.game.world")
    print(f"WorldManager exists: {wm_exists}")

    # Wait for maps loaded
    print("Waiting for maps to load...")
    try:
        # Increased timeout
        page.wait_for_function("() => window.game.world && window.game.world.mapsLoaded", timeout=15000)
    except:
        print("Timeout waiting for maps.")
        # Check current state
        state = page.evaluate("() => window.game.world && window.game.world.mapsLoaded")
        print(f"Current mapsLoaded state: {state}")
        page.screenshot(path="/home/jules/verification/timeout_maps_debug.png")
        raise

    # Start Game
    print("Starting game...")
    # Click on the world map canvas in the start screen to select a location
    page.locator("#world-map-canvas").click(position={"x": 50, "y": 50})
    # Force click start game
    page.locator("#btn-start-game").click(force=True)
    page.wait_for_function("() => window.game.player && window.game.gameStarted")

    # Find High Point
    print("Scanning for high altitude...")
    high_point = page.evaluate("""() => {
        const ctx = window.game.world.heightCtx;
        if (!ctx) return null;
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const data = ctx.getImageData(0, 0, w, h).data;

        for (let y = 0; y < h; y+=10) {
            for (let x = 0; x < w; x+=10) {
                const val = data[(y * w + x) * 4];
                const normalized = val / 255.0;
                if (normalized > 0.85) {
                    return {x: x, y: y, height: normalized};
                }
            }
        }
        return null;
    }""")

    if not high_point:
        print("No high point found.")
        return

    print(f"Teleporting to {high_point}")
    world_x = high_point['x'] * 1000 + 500
    world_y = high_point['y'] * 1000 + 500

    page.evaluate(f"window.game.player.x = {world_x}; window.game.player.y = {world_y};")

    # Wait for chunks
    print("Waiting for chunks to generate...")
    time.sleep(3)

    # Verify Logic
    print("Verifying chunk logic...")
    result = page.evaluate("""() => {
        const p = window.game.player;
        const cx = Math.floor(p.x / 1000);
        const cy = Math.floor(p.y / 1000);
        const key = cx + "," + cy;
        const chunk = window.game.world.activeChunks.get(key);

        if (!chunk) return { error: "Chunk not loaded" };

        let maxH = 0;
        let treeViolation = false;

        for(let row of chunk.heightMap) {
            for(let h of row) {
                if(h > maxH) maxH = h;
            }
        }

        for(let obj of chunk.objects) {
            if(obj.type === 'tree') {
                const tx = Math.floor((obj.x - chunk.x) / 100);
                const ty = Math.floor((obj.y - chunk.y) / 100);
                if (tx >= 0 && tx < 10 && ty >= 0 && ty < 10) {
                     const h = chunk.heightMap[ty][tx];
                     if (h > 0.7001) {
                         treeViolation = true;
                     }
                }
            }
        }

        return { maxH, treeViolation };
    }""")

    print(f"Verification Result: {result}")

    page.screenshot(path="/home/jules/verification/height_verification.png")

    if result.get("error"):
        raise Exception(result["error"])

    assert result['maxH'] > 0.8, "Chunk height map does not reflect high altitude"
    assert not result['treeViolation'], "Found trees above tree line (>0.7)!"

    print("SUCCESS: Height map logic verified.")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
        run_verification(page)
    except Exception as e:
        print(f"FAILED: {e}")
    finally:
        browser.close()
