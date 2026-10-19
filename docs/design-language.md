# Design language

Libero's visual and interaction rules. Tokens live in `src/styles/tokens.css`; this document says what they are for.

## Motion

Seeded from the Libero Scoreboard design canvas (Volleyball page): <https://claude.ai/artifact/FkDq4wb6biKzZRSYZP3ceU>. Access to the canvas is restricted to contributors, so the values that matter are restated here and this document stands alone. The numbers are a **starting scale to tune**, not a final spec: each is one token, so retuning is a one-line edit in `tokens.css`.

### Purpose

Motion exists to:

- **Draw attention to a change.** On a board read from 10 feet away, motion is the main way a change is noticed. A change you did not see happen is a change you did not register.
- **Show cause and effect.** The old value leaves, the new one arrives; the viewer understands what changed.
- **Preserve spatial continuity.** Things move between states instead of teleporting.

Motion must never:

- delay the operator or block input;
- hide or delay the true value (see Truth over animation);
- be the only carrier of information.

### Intensity: board vs console

|                | Scoreboard                           | Console                                                |
| -------------- | ------------------------------------ | ------------------------------------------------------ |
| Read from      | Across a room                        | Arm's length, at pace                                  |
| Character      | Large, legible, may be choreographed | Quick, subtle, never in the way                        |
| Durations      | `--motion-board-*` (320-520 ms)      | `--duration-fast` (120 ms), `--duration-slow` (320 ms) |
| Reduced motion | Swapped for a 200 ms fade            | Dropped (0 ms)                                         |

### Token scale

All in `src/styles/tokens.css`. Components consume these and never write a literal duration or easing.

| Token                          | Default                          | Use                                                    |
| ------------------------------ | -------------------------------- | ------------------------------------------------------ |
| `--duration-fast`              | 120 ms                           | Console colour fades, press feedback                   |
| `--duration-slow`              | 320 ms                           | Console enter/exit                                     |
| `--motion-board-roll-out`      | 420 ms                           | Outgoing digit rolls up and fades                      |
| `--motion-board-roll-in`       | 520 ms                           | Incoming digit rolls up from below                     |
| `--motion-board-indicator-out` | 320 ms                           | Indicator (serve dot) scales out                       |
| `--motion-board-indicator-in`  | 480 ms                           | New indicator pops in                                  |
| `--motion-board-highlight`     | 500 ms                           | State highlight (set win)                              |
| `--motion-board-pop`           | 480 ms                           | New pip pops in                                        |
| `--motion-reduced-fade`        | 200 ms                           | What board motion becomes under reduced motion         |
| `--ease-enter`                 | `cubic-bezier(0.2,0,0,1)`        | Things arriving (decelerate). `--ease-out` is an alias |
| `--ease-exit`                  | `ease-in`                        | Things leaving (accelerate)                            |
| `--ease-emphasis`              | `cubic-bezier(0.34,1.56,0.64,1)` | Overshoot for pops                                     |
| `--motion-distance-roll`       | 0.6 em                           | Digit travel; em so it scales with the numeral         |
| `--motion-distance-nudge`      | 0.04 em                          | Settle back into alignment after a roll                |
| `--motion-scale-pulse`         | 1.05                             | Pulse on a changed value                               |
| `--motion-scale-pop-indicator` | 1.18                             | Serve dot overshoot                                    |
| `--motion-scale-pop-pip`       | 1.25                             | Set pip overshoot                                      |

Stagger for sequences uses 30 ms steps (see the tile entrance in `components.css`).

### Patterns

Each pattern lists timing, easing and its reduced-motion alternative.

| Pattern                                        | Motion                                                                                                                                                                                                        | Reduced motion                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Value change** (digit roll)                  | Outgoing digit rolls up and fades: 420 ms, ease-in. Incoming digit rolls up from below: 520 ms, `--ease-enter`, with a 1.05 scale pulse and a small nudge back into alignment. Only digits that changed move. | 200 ms cross-fade, no travel or scale |
| **Emphasis** (pulse)                           | Scale to 1.05 and back, as part of the value change.                                                                                                                                                          | No scale                              |
| **Indicator move** (serve dot, possession)     | Old indicator scales out 320 ms; new one pops in 480 ms with overshoot to 1.18 then 1.                                                                                                                        | 200 ms cross-fade                     |
| **State highlight** (set win)                  | Highlight the winning score for 500 ms; pop the new set pip 480 ms to 1.25 then 1; then roll both scores to zero as a multi-second sequence.                                                                  | 200 ms fades                          |
| **Enter and exit** (banners, sheets, toasts)   | Enter with `--ease-enter`, exit with `--ease-exit`, durations from the scale above. Board: transform and opacity only.                                                                                        | 200 ms fade (board), none (console)   |
| **Sequence and stagger**                       | Steps offset by 30 ms; a sequence never blocks a newer change.                                                                                                                                                | Steps collapse to one fade            |
| **Pending or confirming** (debounced controls) | Console shows the pending value at once and marks it pending; no travel.                                                                                                                                      | Unchanged (it is state, not motion)   |

The digit roll is implemented once, in `src/motion/` (`RollingNumber`), and is reusable by any board. The football board uses it for both scores; the volleyball board will use it for points, and the indicator and highlight patterns follow the same shape.

### Truth over animation

Animation is progressive enhancement over the correct state.

- The true value is always what is in the DOM. A board that attaches mid-match, reconnects, or misses a notice shows the right value from the snapshot alone, with no animation and no dependency on one having run.
- A new value is never shown wrong while an animation catches up.
- Overlapping changes **retarget, they never queue**. If a new value arrives mid-roll, the running roll is interrupted and a new one starts from the digit currently shown to the newest value. Rapid scoring therefore never lags behind a long animation, and the final value is always the true one.
- Assistive technology reads the real text. The outgoing digit is drawn by CSS only, so it is not in the accessibility tree or the text content, and no announcement depends on an animation finishing.

### Reduced motion

`prefers-reduced-motion: reduce` is handled in one place: the media block in `tokens.css`. Console durations go to 0. Board durations become `--motion-reduced-fade` (200 ms) and distances and scales neutralise (0 and 1), so a roll or pop becomes a plain cross-fade. We swap rather than zero on the board because an instant snap would lose cause and effect: the viewer would not notice that anything changed.

Component CSS should not carry its own `prefers-reduced-motion` rules for token-driven motion. The one exception is choosing a different keyframe set (the update banner swaps its slide and flip for a fade), because that is not a duration, distance or scale a token can neutralise.

The few timers that must outlast an animation (the update banner's exit) read the duration token at runtime with `motionMs` (`src/motion/motionMs.ts`), so they stay in step with the CSS, including the reduced-motion fade. Dwell times (how long a banner holds) are content timing, not motion, and stay as constants.

### Accessibility and performance

- Board motion animates `transform` and `opacity` only. No layout properties, so it stays on the compositor.
- A rolling digit travels inside its own box (clipped, like an odometer), so it never crosses the label above it.
- No flashing: nothing flashes more than three times a second, and no large area alternates between high-contrast states.
- Motion stays inside the 16:9 scaled stage; distances are in `em` of the animated text, so layout remains defined by aspect ratio.
- Announcements for assistive technology never depend on an animation.
- Legibility from 10 feet is a human review item: check a tuned change on a real screen at distance, not only in tests.
