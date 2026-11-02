"""Capture hi-res app screens for store listings (run: python scripts/store_capture.py <base_url> <out_dir>)."""
import asyncio
import sys

from playwright.async_api import async_playwright

BASE, OUT = sys.argv[1], sys.argv[2]


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        ctx = await browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True)
        page = await ctx.new_page()

        async def shot(name):
            await page.screenshot(path=f"{OUT}/{name}.png")
            print("saved", name)

        await page.goto(BASE)
        await page.get_by_test_id("app-splash").wait_for(timeout=90000)
        await page.wait_for_timeout(900)
        await shot("splash")
        await page.get_by_test_id("app-splash").wait_for(state="detached", timeout=20000)
        await page.wait_for_timeout(3500)
        await shot("radar")
        await page.get_by_test_id("radar-search-input").click()
        await page.get_by_test_id("search-suggestions").wait_for()
        await page.wait_for_timeout(600)
        await shot("search")
        await page.get_by_test_id("search-popular-Lieferando").click()
        await page.get_by_test_id("radar-search-summary").wait_for()
        await page.wait_for_timeout(3000)
        await shot("delivery")
        await page.locator("[data-testid^='glitch-card-']").first.click()
        await page.get_by_test_id("detail-verify-source").wait_for(timeout=30000)
        await page.wait_for_timeout(4000)
        await shot("detail")
        await page.goto(BASE + "/pro")
        await page.get_by_test_id("pro-buy-button").wait_for(timeout=60000)
        await page.get_by_test_id("app-splash").wait_for(state="detached", timeout=20000)
        await page.wait_for_timeout(1500)
        await shot("pro")
        await browser.close()


asyncio.run(main())
