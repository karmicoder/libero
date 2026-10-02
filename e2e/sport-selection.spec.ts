import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`${colorScheme} scheme`, () => {
    test.use({ colorScheme })

    test('has no detectable accessibility violations', async ({ page }) => {
      await page.goto('/')
      await expect(
        page.getByRole('heading', { name: 'Choose a sport' }),
      ).toBeVisible()
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })
  })
}

test('a coming-soon sport cannot be opened by URL', async ({ page }) => {
  await page.goto('/match/basketball')
  await expect(
    page.getByRole('heading', { name: 'Sport not available' }),
  ).toBeVisible()
})

test('choose a sport and start a match', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('radio', { name: /football/i })).toBeChecked()
  await expect(page.getByRole('radio', { name: /basketball/i })).toBeDisabled()

  await page.getByRole('radio', { name: /volleyball/i }).check()
  await page.getByRole('button', { name: /start match/i }).click()

  await expect(page).toHaveURL(/\/match\/volleyball$/)
  await expect(
    page.getByRole('heading', { name: /volleyball match/i }),
  ).toBeVisible()
})
