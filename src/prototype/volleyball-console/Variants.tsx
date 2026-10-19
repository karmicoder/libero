// PROTOTYPE (#69): three structurally different volleyball scorer consoles.
import type { Dispatch } from 'react'
import {
  isDecider,
  leader,
  other,
  setReady,
  setsWon,
  target,
  type Action,
  type Side,
  type VState,
} from './model'
import s from './Variants.module.css'

export interface VariantProps {
  state: VState
  dispatch: Dispatch<Action>
}

const NAME: Record<Side, string> = { visitor: 'Visitor', home: 'Home' }
const SIDES: Side[] = ['visitor', 'home']

function Status({ state }: { state: VState }) {
  const w = setsWon(state)
  return (
    <p className={s.status}>
      Set {state.completed.length + 1}
      {isDecider(state) ? ' · decider' : ''} · first to {target(state)} · sets{' '}
      {w.visitor}–{w.home}
      {state.finished && ' · MATCH OVER'}
    </p>
  )
}

function EndSetPrompt({ state, dispatch }: VariantProps) {
  const l = leader(state)
  if (state.finished) {
    return (
      <p className={s.prompt} role="status">
        {
          NAME[
            setsWon(state).home > setsWon(state).visitor ? 'home' : 'visitor'
          ]
        }{' '}
        wins the match.
      </p>
    )
  }
  if (!setReady(state) || !l) return null
  return (
    <div className={s.prompt} role="status">
      <span>
        {NAME[l]} has won set {state.completed.length + 1}?
      </span>
      <button
        type="button"
        className={s.primary}
        onClick={() => dispatch({ type: 'end-set' })}
      >
        End set
      </button>
    </div>
  )
}

function TopBar({ state, dispatch }: VariantProps) {
  const last = state.history.at(-1)
  return (
    <div className={s.top}>
      <Status state={state} />
      <span className={s.topActions}>
        <button
          type="button"
          className={s.btn}
          disabled={!last}
          onClick={() => dispatch({ type: 'undo' })}
        >
          {last ? `Undo · ${last.label}` : 'Nothing to undo'}
        </button>
        <button
          type="button"
          className={s.btn}
          onClick={() => dispatch({ type: 'new-match' })}
        >
          New match
        </button>
      </span>
    </div>
  )
}

/** A: two big tap halves, like the football columns. Serve picked on the team. */
export function VariantA({ state, dispatch }: VariantProps) {
  const zero = state.current.home === 0 && state.current.visitor === 0
  return (
    <div className={s.stack}>
      <TopBar state={state} dispatch={dispatch} />
      <EndSetPrompt state={state} dispatch={dispatch} />
      <div className={s.halves}>
        {SIDES.map((side) => (
          <section key={side} className={s.half} aria-label={NAME[side]}>
            <h2>{NAME[side]}</h2>
            <button
              type="button"
              className={s.tapScore}
              disabled={state.finished}
              onClick={() => dispatch({ type: 'point', team: side })}
            >
              <span className={s.bigNum}>{state.current[side]}</span>
              <span>Tap for point</span>
            </button>
            <button
              type="button"
              className={state.serving === side ? s.serveOn : s.btn}
              aria-pressed={state.serving === side}
              onClick={() => dispatch({ type: 'set-server', team: side })}
            >
              {state.serving === side
                ? zero
                  ? 'Serves first'
                  : 'Serving'
                : zero
                  ? 'Serve first'
                  : 'Serve here'}
            </button>
            <span className={s.row}>
              <button
                type="button"
                className={s.btn}
                aria-label={`${NAME[side]} minus one`}
                onClick={() =>
                  dispatch({ type: 'adjust', team: side, delta: -1 })
                }
              >
                −1
              </button>
              <button
                type="button"
                className={s.btn}
                aria-label={`${NAME[side]} plus one`}
                onClick={() =>
                  dispatch({ type: 'adjust', team: side, delta: 1 })
                }
              >
                +1
              </button>
            </span>
          </section>
        ))}
      </div>
      <button
        type="button"
        className={s.btn}
        disabled={state.finished || !leader(state)}
        onClick={() => dispatch({ type: 'end-set' })}
      >
        End set early
      </button>
    </div>
  )
}

/** B: mini-board mirror on top, thin action bar; tapping the board scores. */
export function VariantB({ state, dispatch }: VariantProps) {
  const w = setsWon(state)
  return (
    <div className={s.stack}>
      <TopBar state={state} dispatch={dispatch} />
      <div className={s.mirror} role="group" aria-label="Scoreboard mirror">
        {SIDES.map((side) => (
          <div key={side} className={s.mirrorCol}>
            <span className={s.mirrorName}>
              {state.serving === side && (
                <span className={s.serveDot} aria-label="Serving" />
              )}
              {NAME[side]}
            </span>
            <span className={s.bigNum}>{state.current[side]}</span>
            <span className={s.pips} aria-label={`${w[side]} sets`}>
              {Array.from({ length: 3 }, (_, i) => (
                <span key={i} className={i < w[side] ? s.pipOn : s.pip} />
              ))}
            </span>
          </div>
        ))}
      </div>
      <EndSetPrompt state={state} dispatch={dispatch} />
      <div className={s.bar}>
        {SIDES.map((side) => (
          <button
            key={side}
            type="button"
            className={s.barScore}
            disabled={state.finished}
            onClick={() => dispatch({ type: 'point', team: side })}
          >
            + {NAME[side]}
          </button>
        ))}
      </div>
      <div className={s.row}>
        {SIDES.map((side) => (
          <button
            key={side}
            type="button"
            className={s.btn}
            onClick={() => dispatch({ type: 'adjust', team: side, delta: -1 })}
          >
            −1 {NAME[side]}
          </button>
        ))}
        <button
          type="button"
          className={s.btn}
          onClick={() =>
            dispatch({ type: 'set-server', team: other(state.serving) })
          }
        >
          Swap serve
        </button>
        <button
          type="button"
          className={s.btn}
          disabled={state.finished || !leader(state)}
          onClick={() => dispatch({ type: 'end-set' })}
        >
          End set early
        </button>
      </div>
    </div>
  )
}

/** C: rally-based. Two buttons, "serving side won" / "receiving side won". */
export function VariantC({ state, dispatch }: VariantProps) {
  const server = state.serving
  const receiver = other(server)
  return (
    <div className={s.stack}>
      <TopBar state={state} dispatch={dispatch} />
      <p className={s.scoreLine}>
        {NAME.visitor} <b>{state.current.visitor}</b> –{' '}
        <b>{state.current.home}</b> {NAME.home}
      </p>
      <p className={s.status}>{NAME[server]} to serve</p>
      <EndSetPrompt state={state} dispatch={dispatch} />
      <div className={s.rally}>
        <button
          type="button"
          className={s.rallyHold}
          disabled={state.finished}
          onClick={() => dispatch({ type: 'point', team: server })}
        >
          {NAME[server]} wins rally
          <small>Serve stays</small>
        </button>
        <button
          type="button"
          className={s.rallySwitch}
          disabled={state.finished}
          onClick={() => dispatch({ type: 'point', team: receiver })}
        >
          {NAME[receiver]} wins rally
          <small>Serve changes</small>
        </button>
      </div>
      <div className={s.row}>
        {SIDES.map((side) => (
          <button
            key={side}
            type="button"
            className={s.btn}
            onClick={() => dispatch({ type: 'adjust', team: side, delta: -1 })}
          >
            −1 {NAME[side]}
          </button>
        ))}
        <button
          type="button"
          className={s.btn}
          disabled={state.finished || !leader(state)}
          onClick={() => dispatch({ type: 'end-set' })}
        >
          End set early
        </button>
      </div>
    </div>
  )
}
