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
    it('adds and removes goals per team', async () => {
      const { store, user } = setup()
      await user.click(screen.getByRole('button', { name: 'Goal for Home' }))
      await user.click(screen.getByRole('button', { name: 'Goal for Home' }))
      await user.click(screen.getByRole('button', { name: 'Goal for Visitor' }))
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
      await user.click(screen.getByRole('button', { name: 'Goal for Home' }))
      const home = screen.getByRole('region', { name: 'Home team' })
      expect(within(home).getByText('0′ Goal')).toBeInTheDocument()
      const visitor = screen.getByRole('region', { name: 'Visitor team' })
      expect(within(visitor).getByText('None yet')).toBeInTheDocument()
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
