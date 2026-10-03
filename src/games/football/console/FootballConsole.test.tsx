import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import { registerBuiltinEngines } from '../../../engines/builtin'
import { EngineRegistry } from '../../../engines/registry'
import { MatchStore } from '../../../match/MatchStore'
import { defaultMatchConfig } from '../config'
import type {
  FootballAction,
  FootballMessage,
  FootballState,
  MatchConfig,
} from '../state'
import { FootballConsole } from './FootballConsole'

type Store = MatchStore<FootballState, FootballAction, FootballMessage>

const registry = new EngineRegistry()
registerBuiltinEngines(registry)
const engine = registry.get<
  FootballState,
  FootballAction,
  FootballMessage,
  MatchConfig
>('football')!

function setup(
  config: MatchConfig = defaultMatchConfig(),
  boardConnected = false,
) {
  const store: Store = new MatchStore(engine, engine.initialState(config))
  render(
    <MemoryRouter>
      <FootballConsole
        store={store}
        boardConnected={boardConnected}
        boardPath="/match/football/board"
      />
    </MemoryRouter>,
  )
  return { store, user: userEvent.setup() }
}

const score = (side: 'Visitor' | 'Home') =>
  screen.getByLabelText(`${side} score`)
const primary = () =>
  screen.getByRole('button', { name: /^(start|resume|pause)/i })

describe('FootballConsole', () => {
  beforeEach(() => window.getSelection()?.removeAllRanges())

  describe('score', () => {
    /** Scores for a team and dismisses the goal sheet that opens. */
    const scoreGoal = async (
      user: ReturnType<typeof userEvent.setup>,
      team: 'Home' | 'Visitor',
    ) => {
      await user.click(screen.getByRole('button', { name: `Goal for ${team}` }))
      await user.click(screen.getByRole('button', { name: 'Skip details' }))
    }

    it('adds and removes goals per team', async () => {
      const { store, user } = setup()
      await scoreGoal(user, 'Home')
      await scoreGoal(user, 'Home')
      await scoreGoal(user, 'Visitor')
      expect(score('Home')).toHaveTextContent('2')
      expect(score('Visitor')).toHaveTextContent('1')

      await user.click(
        screen.getByRole('button', { name: 'Remove goal for Home' }),
      )
      expect(score('Home')).toHaveTextContent('1')
      expect(store.getState().events).toHaveLength(2)
    })

    it('disables remove at 0', () => {
      setup()
      expect(
        screen.getByRole('button', { name: 'Remove goal for Home' }),
      ).toBeDisabled()
    })

    it('logs goals in the team’s recent events', async () => {
      const { user } = setup()
      await scoreGoal(user, 'Home')
      const home = screen.getByRole('region', { name: 'Home team' })
      expect(within(home).getByText('0′ Goal')).toBeInTheDocument()
      const visitor = screen.getByRole('region', { name: 'Visitor team' })
      expect(within(visitor).getByText('None yet')).toBeInTheDocument()
    })
  })

  describe('goal sheet', () => {
    const plus = (team: 'Home' | 'Visitor') =>
      screen.getByRole('button', { name: `Goal for ${team}` })
    const sheet = () => screen.queryByRole('dialog')
    const key = (name: string) => screen.getByRole('button', { name })

    function withNotices() {
      const ctx = setup()
      const notices: FootballMessage[] = []
      ctx.store.subscribeNotices((m) => notices.push(m))
      return { ...ctx, notices }
    }

    it('scores at once, then opens the sheet in that team’s column', async () => {
      const { user } = setup()
      await user.click(plus('Home'))
      expect(score('Home')).toHaveTextContent('1')
      const home = screen.getByRole('region', { name: 'Home team' })
      expect(within(home).getByRole('dialog')).toHaveAccessibleName(
        'Step 1 of 2 · Scorer',
      )
      const visitor = screen.getByRole('region', { name: 'Visitor team' })
      expect(within(visitor).queryByRole('dialog')).toBeNull()
    })

    it('does not announce the goal until details are committed', async () => {
      const { user, notices } = withNotices()
      await user.click(plus('Home'))
      expect(notices).toEqual([])
    })

    it('Done announces the goal with scorer and assist', async () => {
      const { user, store, notices } = withNotices()
      await user.click(plus('Visitor'))
      await user.click(key('9'))
      await user.click(key('Next ›'))
      await user.click(key('1'))
      await user.click(key('0'))
      await user.click(key('Done'))

      expect(sheet()).toBeNull()
      expect(notices).toMatchObject([
        { type: 'goal-scored', team: 'visitor', scorer: 9, assist: 10 },
      ])
      expect(store.getState().events[0]).toMatchObject({
        scorer: 9,
        assist: 10,
      })
    })

    it('No assist announces the goal with the scorer only', async () => {
      const { user, notices } = withNotices()
      await user.click(plus('Home'))
      await user.click(key('7'))
      await user.click(key('Next ›'))
      await user.click(key('No assist'))
      expect(notices).toHaveLength(1)
      expect(notices[0]).toMatchObject({ scorer: 7 })
      expect(notices[0]).not.toHaveProperty('assist')
    })

    it('Skip details keeps the goal but fires no banner', async () => {
      const { user, store, notices } = withNotices()
      await user.click(plus('Home'))
      await user.click(key('Skip details'))
      expect(sheet()).toBeNull()
      expect(notices).toEqual([])
      expect(store.getState().teams.home.score).toBe(1)
      expect(store.getState().events[0]).not.toHaveProperty('scorer')
    })

    it('Escape skips the same way', async () => {
      const { user, notices } = withNotices()
      await user.click(plus('Home'))
      await user.keyboard('{Escape}')
      expect(sheet()).toBeNull()
      expect(notices).toEqual([])
    })

    it('lets the scorer jump back from the assist step', async () => {
      const { user, store } = setup()
      await user.click(plus('Home'))
      await user.click(key('Next ›'))
      await user.click(key('4'))
      await user.click(screen.getByRole('button', { name: /^Scorer/ }))
      await user.click(key('9'))
      await user.click(screen.getByRole('button', { name: /^Assist/ }))
      await user.click(key('Done'))
      expect(store.getState().events[0]).toMatchObject({ scorer: 9, assist: 4 })
    })

    it('finishes from the keyboard without reopening', async () => {
      const { user, store, notices } = withNotices()
      await user.click(plus('Home'))
      await user.keyboard('9{Enter}10{Enter}')
      // Closing hands focus to "+"; that Enter must not press it again.
      expect(sheet()).toBeNull()
      expect(store.getState().teams.home.score).toBe(1)
      expect(notices).toMatchObject([
        { type: 'goal-scored', scorer: 9, assist: 10 },
      ])
    })

    it('takes focus when it opens and returns it to the + button', async () => {
      const { user } = setup()
      await user.click(plus('Home'))
      expect(screen.getByRole('button', { name: /^Scorer/ })).toHaveFocus()
      await user.click(key('Skip details'))
      expect(plus('Home')).toHaveFocus()
    })

    it('makes the covered column inert while it is open', async () => {
      const { user } = setup()
      await user.click(plus('Home'))
      const home = screen.getByRole('region', { name: 'Home team' })
      const covered = home.querySelector('[inert]')
      expect(covered).not.toBeNull()
      expect(covered).toContainElement(plus('Home'))
      // The other team's column stays usable.
      const visitor = screen.getByRole('region', { name: 'Visitor team' })
      expect(visitor.querySelector('[inert]')).toBeNull()
    })

    it('closes if its goal is removed meanwhile', async () => {
      const { user, store } = setup()
      await user.click(plus('Home'))
      store.dispatch({ type: 'remove-goal', team: 'home' })
      // Re-render happens via the store subscription.
      await screen.findByRole('button', { name: 'Goal for Home' })
      expect(sheet()).toBeNull()
    })

    it('a second goal for the other team replaces the first sheet', async () => {
      const { user, notices } = withNotices()
      await user.click(plus('Home'))
      await user.click(plus('Visitor'))
      const dialogs = screen.getAllByRole('dialog')
      expect(dialogs).toHaveLength(1)
      expect(
        within(screen.getByRole('region', { name: 'Visitor team' })).getByRole(
          'dialog',
        ),
      ).toBeInTheDocument()
      // The first goal was left without details: counted, never announced.
      expect(notices).toEqual([])
      expect(score('Home')).toHaveTextContent('1')
    })
  })

  describe('team names', () => {
    it('edits a team name into state', async () => {
      const { store, user } = setup()
      const input = screen.getByRole('textbox', { name: 'Home team name' })
      await user.clear(input)
      await user.type(input, 'Reds')
      expect(store.getState().teams.home.name).toBe('Reds')
      expect(
        screen.getByRole('button', { name: 'Goal for Reds' }),
      ).toBeInTheDocument()
    })
  })

  describe('clock', () => {
    it('starts, pauses and resumes with matching labels and status', async () => {
      const { store, user } = setup()
      expect(primary()).toHaveTextContent('Start')
      expect(screen.getByText('Paused')).toBeInTheDocument()

      await user.click(primary())
      expect(primary()).toHaveTextContent('Pause')
      expect(screen.getByText('Running')).toBeInTheDocument()
      expect(store.getState().clock.runningSince).not.toBeNull()

      await user.click(primary())
      expect(primary()).toHaveTextContent('Resume')
      expect(screen.getByText('Paused')).toBeInTheDocument()
    })

    it('shows the match time, past 99 minutes too', () => {
      const store: Store = new MatchStore(
        engine,
        engine.reduce(engine.initialState(defaultMatchConfig()), {
          type: 'set-clock',
          minutes: 105,
          seconds: 37,
          at: 0,
        }).state,
      )
      render(
        <MemoryRouter>
          <FootballConsole
            store={store}
            boardConnected={false}
            boardPath="/b"
          />
        </MemoryRouter>,
      )
      expect(screen.getByText('105:37')).toBeInTheDocument()
    })

    it('offers to start the next period from a break', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('radio', { name: /HT/ }))
      expect(primary()).toHaveTextContent('Start 2nd half')
      await user.click(primary())
      expect(screen.getByRole('radio', { name: /2H/ })).toBeChecked()
      expect(screen.getByText('Running')).toBeInTheDocument()
    })

    it('disables the clock in a shootout', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('radio', { name: /PEN/ }))
      expect(primary()).toBeDisabled()
      expect(screen.getByText('No clock in penalties')).toBeInTheDocument()
    })
  })

  describe('period selector', () => {
    it('shows a chip per configured period and moves to the clicked one', async () => {
      const { store, user } = setup()
      expect(screen.getAllByRole('radio')).toHaveLength(
        defaultMatchConfig().periods.length,
      )
      await user.click(screen.getByRole('radio', { name: /2H/ }))
      expect(store.getState().periodId).toBe('h2')
      expect(screen.getByText('45:00')).toBeInTheDocument()
    })
  })

  describe('set clock', () => {
    const open = (user: ReturnType<typeof userEvent.setup>) =>
      user.click(screen.getByRole('button', { name: 'Set clock' }))

    it('sets the clock, closes the sheet and toasts', async () => {
      const { store, user } = setup()
      await open(user)
      await user.keyboard('4500')
      await user.click(screen.getByRole('button', { name: 'Apply' }))
      expect(store.getState().clock).toEqual({
        baseSeconds: 45 * 60,
        runningSince: null,
      })
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByText('Clock set to 45:00')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Set clock' })).toHaveFocus()
    })

    it('does not start the clock when Space is pressed in the sheet', async () => {
      const { store, user } = setup()
      await open(user)
      await user.keyboard(' ')
      expect(store.getState().clock.runningSince).toBeNull()
    })

    it('leaves the clock alone on cancel or an empty entry', async () => {
      const { store, user } = setup()
      await open(user)
      await user.keyboard('1234')
      await user.click(screen.getByRole('button', { name: 'Cancel' }))
      await open(user)
      await user.click(screen.getByRole('button', { name: 'Apply' }))
      expect(store.getState().clock.baseSeconds).toBe(0)
      expect(screen.queryByText(/Clock set to/)).toBeNull()
    })

    it('offers presets from the configured periods', async () => {
      const config = defaultMatchConfig()
      config.periods = config.periods.slice(0, 3)
      const { user } = setup(config)
      await open(user)
      const presets = screen.getByRole('group', { name: 'Presets' })
      expect(within(presets).getAllByRole('button')).toHaveLength(2)
      expect(within(presets).getByText('45:00')).toBeInTheDocument()
    })

    it('is unavailable in a shootout', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('radio', { name: /PEN/ }))
      expect(screen.getByRole('button', { name: 'Set clock' })).toBeDisabled()
    })
  })

  describe('stoppage time', () => {
    it('increments and decrements, never below 0', async () => {
      const { store, user } = setup()
      const less = screen.getByRole('button', {
        name: 'Decrease stoppage time',
      })
      const more = screen.getByRole('button', {
        name: 'Increase stoppage time',
      })
      expect(less).toBeDisabled()
      await user.click(more)
      await user.click(more)
      expect(store.getState().stoppageMinutes).toBe(2)
      expect(screen.getByText('+2′')).toBeInTheDocument()
      await user.click(less)
      expect(store.getState().stoppageMinutes).toBe(1)
    })

    it('reads off at 0 and stops at 15', async () => {
      const { store, user } = setup()
      const more = screen.getByRole('button', {
        name: 'Increase stoppage time',
      })
      expect(screen.getByText('off')).toBeInTheDocument()
      for (let i = 0; i < 15; i++) await user.click(more)
      expect(store.getState().stoppageMinutes).toBe(15)
      expect(screen.getByText('+15′')).toBeInTheDocument()
      expect(more).toBeDisabled()
    })

    it('is disabled outside play periods', async () => {
      const { user } = setup()
      await user.click(screen.getByRole('radio', { name: /HT/ }))
      expect(
        screen.getByRole('button', { name: 'Increase stoppage time' }),
      ).toBeDisabled()
    })

    it('is hidden when disabled in the config', () => {
      setup({ ...defaultMatchConfig(), stoppageTime: { enabled: false } })
      expect(screen.queryByText('Stoppage time')).toBeNull()
    })
  })

  describe('substitutions', () => {
    it('shows pips for the per-period limit', () => {
      setup()
      expect(screen.getAllByText('3 of 3 left this period')).toHaveLength(2)
    })

    it('hides substitution controls when disabled', () => {
      setup({
        ...defaultMatchConfig(),
        substitutions: { enabled: false },
      })
      expect(screen.queryByRole('button', { name: 'Substitution' })).toBeNull()
      expect(screen.queryByText(/left this period/)).toBeNull()
    })
  })

  describe('hotkeys', () => {
    it('Space toggles the clock', async () => {
      const { user } = setup()
      await user.keyboard(' ')
      expect(screen.getByText('Running')).toBeInTheDocument()
      await user.keyboard(' ')
      expect(screen.getByText('Paused')).toBeInTheDocument()
    })

    it('is ignored while typing in an input', async () => {
      const { store, user } = setup()
      await user.click(screen.getByRole('textbox', { name: 'Home team name' }))
      await user.keyboard(' ')
      expect(store.getState().clock.runningSince).toBeNull()
    })

    it('does not double-fire when a button has focus', async () => {
      const { store, user } = setup()
      primary().focus()
      await user.keyboard(' ')
      // The focused button handled the key itself: one start, not start+stop.
      expect(store.getState().clock.runningSince).not.toBeNull()
    })
  })

  describe('top bar', () => {
    it('reflects whether a board is connected', () => {
      setup(defaultMatchConfig(), true)
      expect(screen.getByText('Board connected')).toBeInTheDocument()
    })

    it('says so when no board is connected', () => {
      setup()
      expect(screen.getByText('No board connected')).toBeInTheDocument()
    })

    it('links to the scoreboard in a new window', () => {
      setup()
      const link = screen.getByRole('link', { name: 'Open scoreboard' })
      expect(link).toHaveAttribute('href', '/match/football/board')
      expect(link).toHaveAttribute('target', '_blank')
    })
  })
})
