import { AxeBuilder } from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`console, ${colorScheme} scheme`, () => {
    test.use({ colorScheme })

    test('has no detectable accessibility violations', async ({ page }) => {
      await page.goto('/match/football')
      await expect(page.getByLabel('Home score')).toBeVisible()
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })
  })
}

test('score a goal, run the clock, and resume after a reload', async ({
  page,
}) => {
  await page.goto('/match/football')
  await page.getByRole('button', { name: 'Goal for Home', exact: true }).click()
  await expect(page.getByLabel('Home score')).toHaveText('1')

  await page.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(page.getByText('Running')).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Resume match?' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Resume match' }).click()
  await expect(page.getByLabel('Home score')).toHaveText('1')
  // The clock kept running from its stored start time.
  await expect(page.getByText('Running')).toBeVisible()
})

test('a second console window is blocked until it takes over', async ({
  context,
  page,
}) => {
  await page.goto('/match/football')
  await expect(page.getByLabel('Home score')).toBeVisible()

  const second = await context.newPage()
  await second.goto('/match/football')
  await expect(
    second.getByRole('heading', {
      name: 'Match already open in another window',
    }),
  ).toBeVisible()

  await second.getByRole('button', { name: 'Take over' }).click()
  await expect(second.getByLabel('Home score')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Another window took over this match' }),
  ).toBeVisible()
})
