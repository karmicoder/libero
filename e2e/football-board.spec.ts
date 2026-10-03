import { AxeBuilder } from '@axe-core/playwright'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/** Opens the console in one window and the board in another, same browser. */
async function openConsoleAndBoard(context: BrowserContext, query = '') {
  const console_ = await context.newPage()
  await console_.goto('/match/football')
  await expect(console_.getByLabel('Home score')).toBeVisible()
  const board = await context.newPage()
  await board.goto(`/match/football/board${query}`)
  // The board has state only once it has joined the console, so from here on
  // it receives every notice (notices are never replayed to a late board).
  await expect(board.getByLabel('Home score')).toBeVisible()
  return { console_, board }
}

const boardScore = (board: Page, side: 'Visitor' | 'Home') =>
  board.getByLabel(`${side} score`)

test('the board shows the console state and follows changes', async ({
  context,
}) => {
  const { console_, board } = await openConsoleAndBoard(context)
  await expect(boardScore(board, 'Home')).toHaveText('0')
  // Banner areas are reserved but not shown to the audience yet.
  await expect(board.getByText('Updates').first()).toBeHidden()

  await console_
    .getByRole('button', { name: 'Goal for Home', exact: true })
    .click()
  // The goal counts at once; the board shows it before any details are given.
  await expect(boardScore(board, 'Home')).toHaveText('1')
  await console_.getByRole('button', { name: 'Skip details' }).click()

  await console_.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(console_.getByText('Board connected')).toBeVisible()
  await expect(board.locator('time')).not.toHaveText('00:00')

  const name = console_.getByRole('textbox', { name: 'Visitor team name' })
  await name.fill('Rovers')
  await expect(board.getByRole('heading', { name: 'Rovers' })).toBeVisible()
})

test.describe('update banners', () => {
  const banner = (board: Page) => board.locator('[data-phase]')

  test('a goal shows a banner in the scoring team’s corner', async ({
    context,
  }) => {
    const { console_, board } = await openConsoleAndBoard(context)
    await expect(banner(board)).toHaveCount(0)

    await console_
      .getByRole('button', { name: 'Goal for Home', exact: true })
      .click()
    await expect(banner(board)).toHaveAttribute('data-team', 'home')
    await expect(banner(board).getByRole('img', { name: 'Goal' })).toBeVisible()

    // A newer notice replaces it, in the other team's corner.
    await console_
      .getByRole('button', { name: 'Goal for Visitor', exact: true })
      .click()
    await expect(banner(board)).toHaveCount(1)
    await expect(banner(board)).toHaveAttribute('data-team', 'visitor')
  })

  test('a banner is not replayed when the board is reloaded', async ({
    context,
  }) => {
    const { console_, board } = await openConsoleAndBoard(context)
    await console_
      .getByRole('button', { name: 'Goal for Home', exact: true })
      .click()
    await expect(banner(board)).toHaveCount(1)

    await board.reload()
    await expect(boardScore(board, 'Home')).toHaveText('1')
    await expect(banner(board)).toHaveCount(0)
  })

  test('slides with motion allowed and fades with reduced motion', async ({
    browser,
  }) => {
    for (const [reducedMotion, expected] of [
      ['no-preference', /slide-in/],
      ['reduce', /fade-in/],
    ] as const) {
      const context = await browser.newContext({ reducedMotion })
      const { console_, board } = await openConsoleAndBoard(context)
      await console_
        .getByRole('button', { name: 'Goal for Home', exact: true })
        .click()
      await expect(banner(board)).toHaveCSS('animation-name', expected)
      await context.close()
    }
  })

  for (const colorScheme of ['dark', 'light'] as const) {
    test.describe(`${colorScheme} scheme`, () => {
      test.use({ colorScheme })

      test('banners have no detectable accessibility violations', async ({
        context,
      }) => {
        const { console_, board } = await openConsoleAndBoard(context)
        const goal = { name: 'Goal for Home', exact: true }
        await console_.getByRole('button', goal).click()
        // Wait for the entry animation to finish so axe never samples mid-fade.
        await expect(banner(board)).toHaveCSS('opacity', '1')
        const results = await new AxeBuilder({ page: board }).analyze()
        expect(results.violations).toEqual([])
      })
    })
  }
})

test('the board waits when no console is open, and connects when one opens', async ({
  context,
}) => {
  const board = await context.newPage()
  await board.goto('/match/football/board')
  await expect(board.getByText('Waiting for the scorer console')).toBeVisible()

  const console_ = await context.newPage()
  await console_.goto('/match/football')
  await expect(boardScore(board, 'Home')).toHaveText('0')
})

test('the board freezes and flags a closed console', async ({ context }) => {
  const { console_, board } = await openConsoleAndBoard(context)
  await console_
    .getByRole('button', { name: 'Goal for Visitor', exact: true })
    .click()
  await expect(boardScore(board, 'Visitor')).toHaveText('1')
  await console_.getByRole('button', { name: 'Skip details' }).click()

  await console_.close()
  await expect(board.getByText('Disconnected from console')).toBeVisible({
    timeout: 15_000,
  })
  await expect(boardScore(board, 'Visitor')).toHaveText('1')
})

for (const colorScheme of ['dark', 'light'] as const) {
  test.describe(`board, ${colorScheme} scheme`, () => {
    test.use({ colorScheme })

    test('has no detectable accessibility violations', async ({ context }) => {
      const { board } = await openConsoleAndBoard(context)
      await expect(boardScore(board, 'Home')).toBeVisible()
      const results = await new AxeBuilder({ page: board }).analyze()
      expect(results.violations).toEqual([])
    })
  })
}

test('?theme overrides the OS colour scheme', async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: 'dark' })
  const { board } = await openConsoleAndBoard(context, '?theme=light')
  await expect(boardScore(board, 'Home')).toBeVisible()
  await expect(board.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(board.locator('body')).toHaveCSS(
    'background-color',
    'rgb(244, 242, 236)',
  )
  await context.close()
})

test.describe('16:9 stage', () => {
  const viewports = [
    { width: 1280, height: 720 },
    { width: 1920, height: 1080 },
    { width: 800, height: 800 },
    { width: 1000, height: 400 },
    { width: 390, height: 844 },
  ]
  for (const viewport of viewports) {
    test(`fits and keeps 16:9 at ${viewport.width}x${viewport.height}`, async ({
      context,
    }) => {
      const { board } = await openConsoleAndBoard(context)
      await board.setViewportSize(viewport)
      const stage = board.getByTestId('board-stage')
      await expect(stage).toBeVisible()
      const box = (await stage.boundingBox())!

      expect(box.width / box.height).toBeCloseTo(16 / 9, 1)
      expect(box.width).toBeLessThanOrEqual(viewport.width + 1)
      expect(box.height).toBeLessThanOrEqual(viewport.height + 1)
      // Letterboxed: the stage fills the limiting dimension.
      const fillsWidth = Math.abs(box.width - viewport.width) <= 1
      const fillsHeight = Math.abs(box.height - viewport.height) <= 1
      expect(fillsWidth || fillsHeight).toBe(true)
      // No page scrollbars.
      const page = board.locator('html')
      await expect(page).toHaveJSProperty('scrollWidth', viewport.width)
      await expect(page).toHaveJSProperty('scrollHeight', viewport.height)
    })
  }
})
