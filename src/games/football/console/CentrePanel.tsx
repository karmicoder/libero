import { useEffect, useRef, useState } from 'react'
import { useNow } from '../../../match/useNow'
import { clockControl, displayedSeconds, formatClock } from '../clock'
import { findPeriod, MAX_STOPPAGE_MINUTES } from '../config'
import type { FootballAction, FootballState } from '../state'
import styles from './CentrePanel.module.css'
import { ClockSheet } from './ClockSheet'
import { clockPresets } from './clockEntry'

const TOAST_MS = 3000

interface Props {
  state: FootballState
  dispatch: (action: FootballAction) => void
}

export function CentrePanel({ state, dispatch }: Props) {
  const running = state.clock.runningSince !== null
  const now = useNow(running)
  const period = findPeriod(state.config, state.periodId)
  const control = clockControl(state, now)
  const seconds = displayedSeconds(state.clock, now)
  const canAdjustStoppage =
    state.config.stoppageTime.enabled && period?.kind === 'play'

  const status =
    period?.kind === 'shootout'
      ? 'No clock in penalties'
      : running
        ? 'Running'
        : 'Paused'

  const primaryLabel = {
    start: 'Start',
    resume: 'Resume',
    pause: 'Pause',
    'start-next': 'Start',
    disabled: 'Start',
  }[control.kind]

  const [sheetOpen, setSheetOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  // When the sheet closes, focus goes back to the button that opened it.
  const setClockButton = useRef<HTMLButtonElement>(null)
  const sheetWasOpen = useRef(false)
  useEffect(() => {
    if (sheetWasOpen.current && !sheetOpen) setClockButton.current?.focus()
    sheetWasOpen.current = sheetOpen
  }, [sheetOpen])

  const applyClock = (time?: { minutes: number; seconds: number }) => {
    setSheetOpen(false)
    if (!time) return
    dispatch({ type: 'set-clock', ...time, at: Date.now() })
    setToast(`Clock set to ${formatClock(time.minutes * 60 + time.seconds)}`)
  }

  const setStoppage = (minutes: number) =>
    dispatch({ type: 'set-stoppage', minutes })

  return (
    <section className={styles.centre} aria-label="Match clock">
      {/* Inert while the sheet covers it, so Tab stays in the sheet. */}
      <div className={styles.content} inert={sheetOpen}>
        <h2 className={styles.period}>{period?.name ?? ''}</h2>
        <time className={styles.clock} dateTime={`PT${seconds}S`}>
          {formatClock(seconds)}
        </time>
        <p className={styles.status}>
          <span
            className={running ? styles.dotRunning : styles.dot}
            aria-hidden="true"
          />
          {status}
        </p>

        <button
          type="button"
          className="primary"
          disabled={control.kind === 'disabled'}
          onClick={() =>
            dispatch(
              control.kind === 'pause'
                ? { type: 'stop-clock', at: Date.now() }
                : { type: 'start-clock', at: Date.now() },
            )
          }
        >
          {control.kind === 'start-next'
            ? `Start ${control.period.name}`
            : primaryLabel}
        </button>

        <fieldset className={styles.periods}>
          <legend className="eyebrow">Period</legend>
          <div className={styles.chips}>
            {state.config.periods.map((p) => (
              <label key={p.id} className={styles.chip}>
                <input
                  type="radio"
                  name="period"
                  className="visually-hidden"
                  checked={p.id === state.periodId}
                  onChange={() =>
                    dispatch({
                      type: 'set-period',
                      periodId: p.id,
                      at: Date.now(),
                    })
                  }
                />
                <span>{p.abbreviation}</span>
                <span className="visually-hidden"> ({p.name})</span>
              </label>
            ))}
          </div>
        </fieldset>

        {state.config.stoppageTime.enabled && (
          <fieldset className={styles.stoppage}>
            <legend className="eyebrow">Stoppage time</legend>
            <div className={styles.stoppageRow}>
              <button
                type="button"
                className={styles.step}
                aria-label="Decrease stoppage time"
                disabled={!canAdjustStoppage || !state.stoppageMinutes}
                onClick={() => setStoppage((state.stoppageMinutes ?? 0) - 1)}
              >
                −
              </button>
              <output className={styles.stoppageValue} aria-live="off">
                {state.stoppageMinutes ? `+${state.stoppageMinutes}′` : 'off'}
              </output>
              <button
                type="button"
                className={styles.step}
                aria-label="Increase stoppage time"
                disabled={
                  !canAdjustStoppage ||
                  (state.stoppageMinutes ?? 0) >= MAX_STOPPAGE_MINUTES
                }
                onClick={() => setStoppage((state.stoppageMinutes ?? 0) + 1)}
              >
                +
              </button>
            </div>
          </fieldset>
        )}

        <button
          ref={setClockButton}
          type="button"
          className={styles.secondary}
          disabled={period?.kind === 'shootout'}
          onClick={() => setSheetOpen(true)}
        >
          Set clock
        </button>
      </div>

      {sheetOpen && (
        <ClockSheet
          currentSeconds={seconds}
          presets={clockPresets(state.config)}
          onApply={applyClock}
          onCancel={() => setSheetOpen(false)}
        />
      )}

      <p className={styles.toast} role="status">
        {toast}
      </p>
    </section>
  )
}
