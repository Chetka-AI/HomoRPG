from playwright.sync_api import Page, expect, sync_playwright
import time

def test_tree_rendering(page: Page):
    page.goto("http://localhost:8080")
    start_btn = page.locator("#btn-start-game")
    expect(start_btn).to_be_visible()
    map_canvas = page.locator("#world-map-canvas")

    found_land = False

    # Try a few points. Map is likely 1:1 aspect ratio inside container.
    # We will try diagonal points.
    points = [(200, 200), (300, 300), (400, 400), (100, 100), (150, 350)]

    for (x, y) in points:
        print(f"Trying click at {x}, {y}")

        # Click map
        map_canvas.click(position={"x": x, "y": y})

        # Click start
        start_btn.click()

        # Wait for UI
        page.wait_for_selector("#ui-layer", state="visible")

        # Wait for world load
        page.wait_for_timeout(1000)

        biome = page.evaluate("""() => {
            if (!window.game || !window.game.player) return "Unknown";
            const cx = Math.floor(window.game.player.x / 1000);
            const cy = Math.floor(window.game.player.y / 1000);
            const chunk = window.game.world.activeChunks.get(`${cx},${cy}`);
            return chunk ? chunk.biome.name : "Unknown";
        }""")

        print(f"Biome: {biome}")

        if biome != "Ocean" and biome != "Unknown":
            print("Found Land!")
            found_land = True
            # Wait for trees to render
            page.wait_for_timeout(2000)
            page.screenshot(path="verification/verification.png")
            break
        else:
            page.reload()
            start_btn = page.locator("#btn-start-game")
            expect(start_btn).to_be_visible()
            map_canvas = page.locator("#world-map-canvas")

    if not found_land:
        print("Could not find land to verify trees.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_tree_rendering(page)
        finally:
            browser.close()
