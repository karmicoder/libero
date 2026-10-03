import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

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
  await page.getByRole('button', { name: 'Skip details' }).click()
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

test.describe('goal sheet', () => {
  const plus = (page: Page) =>
    page.getByRole('button', { name: 'Goal for Home', exact: true })

  test('scorer and assist can be entered with the physical keyboard alone', async ({
    page,
  }) => {
    await page.goto('/match/football')
    await plus(page).focus()
    await page.keyboard.press('Enter')

    // The sheet takes focus, so typing goes straight into the scorer field.
    const dialog = page.getByRole('dialog', { name: 'Step 1 of 2 · Scorer' })
    await expect(dialog).toBeFocused()
    await page.keyboard.type('9')
    await page.keyboard.press('Enter')
    await expect(
      page.getByRole('dialog', { name: 'Step 2 of 2 · Assist' }),
    ).toBeVisible()
    await page.keyboard.type('10')
    await page.keyboard.press('Enter')

    await expect(page.getByRole('dialog')).toHaveCount(0)
    // Focus is back on the button that opened the sheet.
    await expect(plus(page)).toBeFocused()
    await expect(page.getByLabel('Home score')).toHaveText('1')
    await expect(page.getByText('0′ Goal #9 (A #10)')).toBeVisible()
  })

  test('Tab moves between Scorer and Assist and typing follows the focus', async ({
    page,
  }) => {
    await page.goto('/match/football')
    await plus(page).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('dialog')).toBeFocused()

    await page.keyboard.type('9')
    await page.keyboard.press('Tab') // Scorer field
    await page.keyboard.press('Tab') // Assist field
    const assist = page.getByRole('button', { name: /^Assist/ })
    await expect(assist).toBeFocused()
    await expect(assist).toHaveAttribute('aria-current', 'step')
    await page.keyboard.type('10')
    await expect(assist).toContainText('10')
    await expect(page.getByRole('button', { name: /^Scorer/ })).toContainText(
      '9',
    )

    // Through the keypad (1-9, backspace, 0) to Done, keyboard only.
    for (let i = 0; i < 12; i++) await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: 'Done' })).toBeFocused()
    await page.keyboard.press('Enter')

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByText('0′ Goal #9 (A #10)')).toBeVisible()
  })

  test('Tab stays inside the sheet while it is open', async ({ page }) => {
    await page.goto('/match/football')
    await plus(page).click()
    const dialog = page.getByRole('dialog')
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab')
      // Focus never lands on the covered column behind the sheet.
      await expect(
        page.getByRole('textbox', { name: 'Home team name' }),
      ).not.toBeFocused()
      await expect(dialog).toBeVisible()
    }
  })

  for (const colorScheme of ['dark', 'light'] as const) {
    test.describe(`${colorScheme} scheme`, () => {
      test.use({ colorScheme })

      test('has no detectable accessibility violations with the sheet open', async ({
        page,
      }) => {
        await page.goto('/match/football')
        await plus(page).click()
        await expect(page.getByRole('dialog')).toBeVisible()
        const results = await new AxeBuilder({ page }).analyze()
        expect(results.violations).toEqual([])
      })
    })
  }
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
