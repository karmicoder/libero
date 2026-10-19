import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/** Opens the console in one window and the board in another, same browser. */
async function openConsoleAndBoard(context: BrowserContext) {
  const console_ = await context.newPage()
  await console_.goto('/match/football')
  await expect(console_.getByLabel('Home score')).toBeVisible()
  const board = await context.newPage()
  await board.goto('/match/football/board')
  await expect(board.getByLabel('Home score')).toBeVisible()
  return { console_, board }
}

async function scoreHome(console_: Page, goals = 1) {
  for (let i = 0; i < goals; i++) {
    await console_
      .getByRole('button', { name: 'Goal for Home', exact: true })
      .click()
    await console_.getByRole('button', { name: 'Skip details' }).click()
  }
}

const homeScore = (board: Page) => board.getByLabel('Home score')
const rolling = (board: Page) => homeScore(board).locator('[data-prev]')
const incoming = (board: Page) => rolling(board).locator('span').first()

test.describe('score digit roll', () => {
  test.describe('with motion allowed', () => {
    test.use({ reducedMotion: 'no-preference' })

    test('the changed digit rolls with the board-scale tokens', async ({
      context,
    }) => {
      const { console_, board } = await openConsoleAndBoard(context)
      await scoreHome(console_)
      await expect(homeScore(board)).toHaveText('1')
      await expect(incoming(board)).toHaveCSS('animation-name', /roll-in/)
      await expect(incoming(board)).toHaveCSS('animation-duration', '0.52s')
    })

    test('rapid goals retarget to the latest score', async ({ context }) => {
      const { console_, board } = await openConsoleAndBoard(context)
      await scoreHome(console_, 4)
      await expect(homeScore(board)).toHaveText('4')
      // One roll to the newest value, not a queue of four.
      await expect(rolling(board)).toHaveCount(1)
    })
  })

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' })

    test('the roll is swapped for a short fade, not removed', async ({
      context,
    }) => {
      const { console_, board } = await openConsoleAndBoard(context)
      await scoreHome(console_)
      await expect(homeScore(board)).toHaveText('1')
      await expect(incoming(board)).toHaveCSS('animation-name', /roll-in/)
      await expect(incoming(board)).toHaveCSS('animation-duration', '0.2s')
      await expect(board.locator('html')).toHaveCSS(
        '--motion-distance-roll',
        /^\s*0em$/,
      )
    })
  })

  test('a board attaching mid-match shows the score with nothing rolling', async ({
    context,
  }) => {
    const { console_ } = await openConsoleAndBoard(context)
    await scoreHome(console_, 2)
    const late = await context.newPage()
    await late.goto('/match/football/board')
    await expect(homeScore(late)).toHaveText('2')
    await expect(rolling(late)).toHaveCount(0)
  })
})
