import styles from './Icon.module.css'

type IconProps = {
  /** A glyph from `./paths`. */
  path: string
  className?: string
} & (
  | {
      /** The icon's name for assistive tech; makes it `role="img"`. */
      label: string
      decorative?: never
    }
  | {
      /** The icon adds nothing a sibling's text or name doesn't already say. */
      decorative: true
      label?: never
    }
)

/**
 * A single-path icon drawn in the current text colour. Every icon is either
 * named (`label`) or explicitly `decorative`, never silently unnamed. It is
 * 1em square by default so it scales with the text around it; a control sizes
 * it with `--size-icon`.
 */
export function Icon({ path, label, decorative, className }: IconProps) {
  // Branch on `decorative`, not on `label`: an empty label stays a (badly)
  // named image instead of silently disappearing from the accessibility tree.
  const a11y = decorative
    ? ({ 'aria-hidden': true } as const)
    : ({ role: 'img', 'aria-label': label } as const)
  return (
    <svg
      className={[styles.icon, className].filter(Boolean).join(' ')}
      viewBox="0 -960 960 960"
      fill="currentColor"
      focusable="false"
      {...a11y}
    >
      <path d={path} />
    </svg>
  )
}
