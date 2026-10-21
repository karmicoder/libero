import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/** Opens the console in one window and the board in another, same browser. */
async function openConsoleAndBoard(context: BrowserContext) {
  const console_ = await context.newPage()
  await console_.goto('/match/volleyball')
  await expect(console_.getByLabel('Home score')).toBeVisible()
  const board = await context.newPage()
  await board.goto('/match/volleyball/board')
  await expect(board.getByLabel('Home score')).toBeVisible()
  return { console_, board }
}

const point = (console_: Page, team: 'Visitor' | 'Home') =>
  console_.getByRole('button', { name: `Point for ${team}`, exact: true })

/** Applies short match rules so a whole match takes a handful of clicks. */
async function shortMatch(console_: Page) {
  await console_.getByRole('button', { name: 'Settings' }).click()
  await console_.getByLabel('Sets to win').fill('2')
  await console_.getByLabel('Points per set').fill('2')
  await console_.getByLabel('Decider points').fill('2')
  await console_.getByLabel('Win by').fill('1')
  await console_.getByRole('button', { name: 'Save' }).click()
  await expect(
    console_.getByRole('heading', { name: 'Match settings' }),
  ).toHaveCount(0)
}

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`volleyball, ${colorScheme} scheme`, () => {
    test.use({ colorScheme })

    test('console has no detectable accessibility violations', async ({
      page,
    }) => {
      await page.goto('/match/volleyball')
      await expect(page.getByLabel('Home score')).toBeVisible()
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })

    test('settings has no detectable accessibility violations', async ({
      page,
    }) => {
      await page.goto('/match/volleyball')
      await page.getByRole('button', { name: 'Settings' }).click()
      await expect(
        page.getByRole('heading', { name: 'Match settings' }),
      ).toBeVisible()
      const results = await new AxeBuilder({ page }).analyze()
      expect(results.violations).toEqual([])
    })

    test('board has no detectable accessibility violations', async ({
      context,
    }) => {
      const { board } = await openConsoleAndBoard(context)
      const results = await new AxeBuilder({ page: board }).analyze()
      expect(results.violations).toEqual([])
    })
  })
}

test('points, serve, set end and match win reach the board', async ({
  context,
}) => {
  const { console_, board } = await openConsoleAndBoard(context)
  await shortMatch(console_)

  await point(console_, 'Home').click()
  await expect(board.getByLabel('Home score')).toHaveText('1')
  await expect(board.getByLabel('Visitor score')).toHaveText('0')

  await console_.getByRole('button', { name: 'Serve' }).first().click()
  const visitorColumn = board.getByRole('region', { name: 'Visitor team' })
  await expect(visitorColumn.getByText('Serving')).toBeAttached()
  await expect(
    board.getByRole('region', { name: 'Home team' }).getByText('Serving'),
  ).toHaveCount(0)

  // Reaching the target only offers to end the set; nothing closes by itself.
  await point(console_, 'Home').click()
  await expect(board.getByLabel('Home score')).toHaveText('2')
  await expect(console_.getByRole('region', { name: 'End set' })).toBeVisible()
  await console_.getByRole('button', { name: 'End set', exact: true }).click()

  await expect(board.getByLabel('Home score')).toHaveText(/^0/)
  await expect(
    board.getByRole('list', { name: 'Completed sets' }),
  ).toContainText('0 – 2')

  await point(console_, 'Home').click()
  await point(console_, 'Home').click()
  await console_.getByRole('button', { name: 'End set', exact: true }).click()

  await expect(board.getByRole('heading', { name: 'Match over' })).toBeVisible()
  await expect(board.getByLabel('Home sets won')).toHaveText(/^2/)
  await expect(board.getByText('Home wins')).toBeVisible()
  await expect(console_.getByText('Home wins the match')).toBeVisible()
})
