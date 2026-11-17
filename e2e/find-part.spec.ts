import { expect, test } from "@playwright/test"

/**
 * Main demo path: search for a part on the plant plan, enter a scanned room,
 * and land with the object / parts card open.
 *
 * Relies on the default Still room view (not Live 3D), so headless Chromium
 * without WebGL still covers the path. Assets are local under /public.
 */
test("search for a part, enter a room, and open the part card", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByRole("heading", { name: "Parts" })).toBeVisible()

  // Plan view owns the plant-wide search with "in world" results.
  await page.getByRole("radio", { name: "Plan" }).click()
  await expect(page.getByRole("heading", { name: /plant overview/i })).toBeVisible()

  const search = page.getByRole("combobox", { name: "Find a part or equipment" })
  await search.click()
  await search.fill("spindle")

  const results = page.getByRole("listbox", { name: "Search results" })
  // Wait until the world has hydrated — before that the list shows a loading state.
  await expect(results.getByRole("option").first()).toBeVisible({ timeout: 20_000 })

  const spindleHit = results.getByRole("option").filter({ hasText: /Spindle belt/i }).first()
  await expect(spindleHit).toBeVisible()
  await spindleHit.click()

  // Room entry frames the equipment and opens its card on the Parts/Bins tab.
  const card = page.getByRole("region", { name: /card$/ })
  await expect(card).toBeVisible({ timeout: 20_000 })
  await expect(card.getByRole("button", { name: "Close card" })).toBeVisible()
  await expect(
    card.getByRole("tab", { name: /^(Bins|Parts in this unit)$/ }),
  ).toBeVisible()
})
