// PROTOTYPE (#69): three variants of the volleyball scorer console on one
// throwaway route, /prototype/volleyball-console?variant=A|B|C. In-memory stub
// state only (see model.ts); wipe me.
import { useEffect, useReducer } from 'react'
import { useSearchParams } from 'react-router'
import { initial, reduce } from './model'
import { VariantA, VariantB, VariantC } from './Variants'
import s from './Variants.module.css'

const VARIANTS = [
  ['A', 'Tap halves', VariantA],
  ['B', 'Board mirror + bar', VariantB],
  ['C', 'Rally buttons', VariantC],
] as const

export function PrototypePage() {
  const [params, setParams] = useSearchParams()
  const [state, dispatch] = useReducer(reduce, undefined, initial)
  const key = params.get('variant') ?? 'A'
  const index = Math.max(
    0,
    VARIANTS.findIndex(([k]) => k === key),
  )
  const [, name, Variant] = VARIANTS[index]

  const go = (delta: number) =>
    setParams(
      {
        variant:
          VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length][0],
      },
      { replace: true },
    )

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest('input, textarea, [contenteditable]')
      )
        return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  return (
    <>
      <h1 className="visually-hidden">Volleyball console prototype</h1>
      <Variant state={state} dispatch={dispatch} />
      <div className={s.switcher}>
        <button
          type="button"
          aria-label="Previous variant"
          onClick={() => go(-1)}
        >
          ←
        </button>
        <span>
          {VARIANTS[index][0]} ({name})
        </span>
        <button type="button" aria-label="Next variant" onClick={() => go(1)}>
          →
        </button>
      </div>
    </>
  )
}
