import { expect, test, type Page } from '@playwright/test'

/** The header bar is one row of `--size-control-lg` plus padding; two rows
 *  would be well over this. */
const ONE_ROW = 70

async function expectOneRow(page: Page) {
  const box = await page.getByRole('banner').boundingBox()
  expect(box!.height).toBeLessThan(ONE_ROW)
}

// Portrait tablet is the narrowest width the console is laid out for.
test.use({ viewport: { width: 768, height: 1024 } })

test('football header fits one row with the longest undo label', async ({
  page,
}) => {
  await page.goto('/match/football')
  const home = page.getByRole('region', { name: 'Home team' })
  await home
    .getByRole('button', { name: 'Decrease subs left for Home' })
    .click()
  await expect(
    page.getByRole('button', { name: 'Undo · Substitutions left' }),
  ).toBeVisible()
  await expectOneRow(page)

  // Undo and Redo both showing a step is the fullest the row gets.
  await page.getByRole('button', { name: 'Goal for Home', exact: true }).click()
  await page.getByRole('button', { name: 'Skip details' }).click()
  await page.getByRole('button', { name: 'Undo · Goal' }).click()
  await expect(page.getByRole('button', { name: 'Redo · Goal' })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Undo · Substitutions left' }),
  ).toBeVisible()
  await expectOneRow(page)
})

test('volleyball header fits one row with the longest undo label', async ({
  page,
}) => {
  await page.goto('/match/volleyball')
  await page
    .getByRole('button', { name: 'Point for Home', exact: true })
    .click()
  await page.getByRole('button', { name: '−1 point from Home' }).click()
  await expect(
    page.getByRole('button', { name: 'Undo · Score correction for Home' }),
  ).toBeVisible()
  await expectOneRow(page)
})
