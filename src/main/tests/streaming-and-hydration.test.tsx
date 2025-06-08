// import { test, expect } from '@playwright/test'
// import type { Server } from 'bun'
// import { start } from './mock/server.js'
// import { FIXTURE_ELEMENT_TAG, EMPTY_SLOT, DEFINE as DEFINE_EVENT } from './mock/page.js'
// import {
//   HydratingElement,
//   RED,
//   GREEN,
//   BEFORE_HYDRATION,
//   AFTER_HYDRATION,
//   HYDRATING_ELEMENT_TAG,
// } from './mock/hydrating-element.js'
// import { ssr } from 'plaited'

// // Define a helper type for elements that have the custom 'trigger' method
// type TriggerableElement = HTMLElement & {
//   trigger: (eventName: string, detail?: unknown) => void
// }

// let server: Server

// test.beforeAll(async () => {
//   server = start()
//   // Wait for server to be ready, if necessary.
//   // Adjust time as needed or use a more robust check if server startup time varies.
//   await new Promise((resolve) => setTimeout(resolve, 1000))
// })

// test.afterAll(() => {
//   server.stop(true) // Pass true to forcefully close connections if needed
// })

// test('Fixture and Hydrating Element Interaction', async ({ page }) => {
//   await page.goto('http://localhost:3001/')

//   // 3. Initial Fixture Element Checks
//   const fixtureHandle = page.locator(FIXTURE_ELEMENT_TAG).first()
//   await expect(fixtureHandle).toBeVisible()

//   // Check initial slot content. Playwright's toHaveText should work with shadow DOM slots.
//   await expect(fixtureHandle.locator('slot')).toHaveText(EMPTY_SLOT)

//   // 4. Test onReplaceChildren on Fixture
//   const replaceChildrenHtml = '<span>replaceChildren </span>'
//   await fixtureHandle.evaluate(
//     (el, detail) => (el as TriggerableElement).trigger('onReplaceChildren', detail),
//     replaceChildrenHtml,
//   )
//   await expect(fixtureHandle.locator('slot div')).toHaveText('replaceChildren')

//   // 5. Test onAppend on Fixture
//   const appendHtml = '<span>append</span>'
//   await fixtureHandle.evaluate((el, detail) => (el as TriggerableElement).trigger('onAppend', detail), appendHtml)
//   // Note: <br/> does not contribute to textContent in the same way as visible text.
//   // The assertion checks the combined text of the elements within the slot.
//   await expect(fixtureHandle.locator('slot')).toHaveText('replaceChildren append')

//   // 6. Test onPrepend on Fixture
//   const prependHtml = '<span>prepend </span>'
//   await fixtureHandle.evaluate((el, detail) => (el as TriggerableElement).trigger('onPrepend', detail), prependHtml)
//   await expect(fixtureHandle.locator('slot')).toHaveText('prepend replaceChildren append')

//   // 7. Replace Fixture Slot with HydratingElement (SSR)
//   const hydratingElementHTML = ssr(<HydratingElement />)
//   await fixtureHandle.evaluate(
//     (el, detail) => (el as TriggerableElement).trigger('onReplaceChildren', detail),
//     hydratingElementHTML,
//   )

//   // The slot of Fixture should now contain the static HTML of HydratingElement.
//   // Locate the HydratingElement within the Fixture element.
//   const hydratingElementHandle = fixtureHandle.locator(HYDRATING_ELEMENT_TAG).first()
//   await expect(hydratingElementHandle).toBeVisible()

//   // Allow time for the script to load and the element to hydrate.
//   // Consider using page.waitForFunction or a more specific locator if exact timing is critical.
//   await page.waitForTimeout(100)

//   // 8. Verify Initial State of Hydrated HydratingElement
//   // Locate the inner element within the HydratingElement's shadow DOM (implicitly handled by Playwright).
//   const innerElement = hydratingElementHandle.locator('[p-target="inner"]').first()
//   await expect(innerElement).toHaveCSS('color', RED)
//   await expect(innerElement).toHaveText(BEFORE_HYDRATION)

//   // 9. Define HydratingElement
//   // Trigger the event that causes the Fixture to add the script tag for HydratingElement
//   await fixtureHandle.evaluate((el, eventName) => (el as TriggerableElement).trigger(eventName as string), DEFINE_EVENT)

//   // Allow time for the script to load and the element to hydrate.
//   // Consider using page.waitForFunction or a more specific locator if exact timing is critical.
//   await page.waitForTimeout(250)

//   // 10. Trigger update on HydratingElement
//   await hydratingElementHandle.evaluate((el) => (el as TriggerableElement).trigger('update'))

//   // Allow time for the update to apply.
//   await page.waitForTimeout(100)

//   // 11. Verify Updated State of HydratingElement
//   await expect(innerElement).toHaveCSS('color', GREEN)
//   await expect(innerElement).toHaveText(AFTER_HYDRATION)
// })
