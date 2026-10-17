# Football shared-code audit (ticket #66, map #65, epic #25)

Question: which parts of the football implementation are sport-agnostic, or nearly so, and would a volleyball implementation otherwise copy?

Method: read the source at commit 3f3ab0e (master). All claims cite the file that owns them. Findings only: no extraction order, no extraction decisions.

Volleyball MVP assumed: score, serve possession, sets won; configurable rules (best-of-5, 25/15, win by 2); rally-scoring serve; operator-confirmed set end; no clock, rotation, subs or lineups. Boards: full, minimal, point + serve-change animation, set-win animation with score reset.

## Summary table

| Candidate | Already neutral? | Would volleyball copy it? | Extraction risk |
|---|---|---|---|
| Engine contract, `EngineRegistry` | Yes | No, uses as is | None |
| `MatchStore`, `useMatchState`, `storage.ts`, `MatchSession` | Yes | No, uses as is | None |
| `ConsoleHost`, `BoardHost`, `ConsoleLink`, `BoardLink`, sync types, `BroadcastChannel` | Yes | No, uses as is | None |
| Board/Console registries, `MatchPage`, `BoardPage` | Yes | No, uses as is | None (layout selection is a gap) |
| `useBanner`, `boards/banner.ts` | Yes (generic over `Notice`) | No; timing is not parameterised | Low |
| `useDebouncedCommit`, `useNow` | Yes | Probably not needed in the MVP | None |
| Undo (`engine/undo.ts`) | Mechanism generic, content football | Yes, a copy is likely | Medium |
| Team state, side type, team-name action | Types are football-local | Yes, a copy is likely | Low to medium |
| Config shape and validation (`config.ts`, `validate.ts`) | No (periods-and-clock model) | Only the pattern | Medium |
| Board stage / chrome (16:9 stage, disconnected, wordmark) | No, in a football CSS Module | Yes, a copy is likely | Low to medium |
| Console chrome (top bar, toast, hotkeys, sheets) | No, all inside football console | Partly | Low to medium |
| Update-banner component (`UpdateBanner.tsx` + CSS) | No, football content and layout | Shell only | Medium |
| Event log (`events`, `nextEventId`) | No | Not in MVP | Medium |

## 1. Already sport-neutral infrastructure (no copy needed)

These sit outside `src/games/football/` and have no football imports. A volleyball sport only needs to register an engine, a console and a board.

- Engine contract: `src/engines/types.ts` (`GameEngine<State, Action, Message, Config>`, optional `isState` guard, `ReduceResult`) and `src/engines/registry.ts` (type-erased `EngineRegistry`, runtime-injectable). Football registers in `src/engines/builtin.ts`, one line per sport.
- Store: `src/match/MatchStore.ts` wraps any engine; dispatch, a state subscription, a separate transient notice channel, and `replaceState` for takeover handover. `src/match/useMatchState.ts` is `useSyncExternalStore` over it.
- Persistence: `src/match/storage.ts`. Key `libero:match:<sportId>`, envelope `{version, state}`, one module constant `VERSION = 1`, all access guarded by try/catch, `loadBackup` takes an `isState` guard. `src/match/MatchSession.tsx` does the resume / discard-and-start-new prompt using `engine.isState` and `engine.initialState(config)`.
  - The version is global to all sports, not per sport; bumping it for one sport's shape change would invalidate every sport's backups. There is no migration hook. Football evolved its shape by making `history` optional (`validate.ts`, `state.ts`) rather than bumping the version.
  - `MatchSession`'s discard text says "The saved score, clock and events will be deleted"; "clock" is football-flavoured wording in a shared component.
- Sync: `src/sync/types.ts` (`SyncMessage<State, Notice>`: hello/ping/snapshot/notice/probe/present/takeover/handover; `SyncChannel`; timing constants), `src/sync/ConsoleLink.ts` (master, probe/takeover/handover, board liveness), `src/sync/BoardLink.ts` (view-only; snapshot, notices, connected flag), `src/sync/broadcastChannel.ts` (channel `libero:sync:<sportId>`), `src/sync/memoryChannel.ts` (tests). Generic in `State` and `Notice`.
- Hosts: `src/match/ConsoleHost.tsx` (publishes snapshots and notices, blocked/inactive takeover screen) and `src/match/BoardHost.tsx` (waiting screen; passes `state`, `connected`, `subscribeNotices`).
- Registries and routing: `src/boards/registry.ts` (`BoardProps`), `src/consoles/registry.ts` (`ConsoleProps`: `store`, `boardConnected`, `boardPath`), `src/pages/MatchPage.tsx`, `src/pages/BoardPage.tsx` (includes the `?theme=` override), `src/sports/*`. Volleyball is already `ready` in `src/sports/builtin.ts`; `MatchPage` shows a "Scoreboard coming soon" placeholder until an engine and console are registered.
- Gap, not a copy candidate: `BoardRegistry` maps one `sportId` to one component, and the route is `/match/:sportId/board`. Volleyball's four boards (full, minimal, two animation variants) would need either variants inside one registered component or a layout-selection concept. Nothing in the registry, `BoardHost` or `BoardPage` has a layout id today.
- Verified generic by `src/engines/registry.test.ts`, which uses a non-football counter engine.
- Extraction risk: none.

## 2. Undo

- Lives in: `src/games/football/engine/undo.ts` (245 lines, `undo.test.ts`); `UndoEntry` and `history?: UndoEntry[]` in `src/games/football/state.ts`; wired in `reduce` in `engine/football.ts` (an `undo` action is intercepted, then `undoEntryFor` and `withEntry` run after every other reduce); hotkey `useUndoHotkey` and the Undo button in `console/FootballConsole.tsx`, which also shows the "Undid <label>" toast.
- Generic mechanism: entries are inverses rather than snapshots (so undoing never erases what other actions changed, and they stay small in every snapshot); `MAX_HISTORY = 30`; each entry has a `label` the button shows; an action that changed nothing produces no entry; an unknown `kind` is dropped so loosely validated saved state cannot break undo; `history` is optional so matches saved before undo still load.
- Football-specific: every `kind` (goal, goal-removed, cards, substitution, subs-remaining, stoppage, clock, period); the rule that clock start/stop and team rename are not undoable and only set-clock and period changes restore time; the post-undo clamping in `undoLast` (sub limit, stoppage versus config); the `at` timestamp argument that exists for clock maths.
- Sport-neutral version: a small helper set rather than a framework, for example `pushEntry(history, entry, cap)` and a generic `Undoable<Entry>` state field, plus an engine-level convention where the sport supplies `entryFor(prev, next, action)` and `apply(state, entry)`. The entry union stays in each sport's neutral `state.ts` (per AGENTS.md). The `undo` action routing, the cap and the optional-history handling would be shared.
- Volleyball use: yes. Undo of a point, a manual serve change and a set win is a near-certain need. The set-win inverse is the awkward one: it must restore the pre-reset set score, sets won and server, so that entry kind needs a "before" capture. Volleyball has no clock, so a shared version must not force `at` onto the action.
- Future sports: any score-and-event sport.
- Risk of extracting: medium. The mechanism is small, but it is entangled with `UndoEntry` living inside `FootballState` and with the football-shaped `undoLast` clamping. A shared helper typed on a generic entry is straightforward; a shared engine wrapper would widen the `GameEngine` contract surface.

## 3. `useDebouncedCommit` (and `useNow`)

- Lives in: `src/match/useDebouncedCommit.ts` (with a test); used in `console/CentrePanel.tsx` for stoppage minutes. The rule is in AGENTS.md ("Debounce repeated-press adjustments, never discrete events"). `src/match/useNow.ts` is the clock repaint hook used by the football board and centre panel.
- Football-specific: nothing. `useDebouncedCommit` is generic over `T`; it flushes on unmount, `pagehide` and `visibilitychange`, drops a pending value when the committed value changes underneath, and the timer only paces the UI. `useNow` is generic but only meaningful for a clock.
- Volleyball use: not obviously. Points and set ends are discrete and must dispatch immediately. The MVP has no stoppage time or subs count. Only a numeric nudge control (none in the MVP) would use it.
- Future sports: manual subs remaining (#15, named in AGENTS.md), added-time concepts. `useNow` for any clocked sport.
- Risk of extracting: none; already in `src/match/`.

## 4. Team and settings handling

- Lives in: `TeamSide = 'visitor' | 'home'`, `TeamState {name, score}` and `teams: Record<TeamSide, TeamState>` in `src/games/football/state.ts`; `set-team-name` in `engine/football.ts` (no-op if unchanged; initial names 'Visitor' and 'Home'); the name input in `console/TeamColumn.tsx` (dispatches on every change, not debounced); `SIDE_LABEL` maps duplicated in `TeamColumn.tsx`, `CardSheet.tsx` and `board/FootballBoard.tsx`; the board falls back to the side label for an empty name.
- Football-specific: `TeamState` has one integer `score`; volleyball needs a current-set score plus sets won, so the state shape is not reusable verbatim. The visitor-left/home-right layout is a presentation choice.
- Sport-neutral version: a types-only module exporting `TeamSide`, the side labels and a base team shape (name plus whatever the sport adds), and a shared rename reducer helper. It has to be importable from engine, board and console without breaking the `no-restricted-imports` rule.
- Volleyball use: yes (two teams, editable names, same sides).
- Future sports: all two-team sports.
- Risk of extracting: low to medium. Little code, but it forces a decision about where cross-sport neutral modules live relative to the lint boundaries, and the visitor/home naming is user-visible.

## 5. Config shape and validation

- Lives in: `state.ts` (`MatchConfig`, `PeriodConfig`, `PeriodKind`); `config.ts` (`defaultMatchConfig`, `findPeriod`, `periodOffsetSeconds`, `nextPlayPeriod`, `configProblems`, `CONFIG_PROBLEM_MESSAGES`); `validate.ts` (`isFootballState`); the `update-config` case in `engine/football.ts` (re-derives subs and stoppage); `console/SettingsScreen.tsx` (388 lines), `LengthSheet.tsx`, `lengthEntry.ts`.
- Football-specific: all the fields and helpers (periods, lengths, breaks, shootout, subs, stoppage).
- Neutral pieces are patterns, not code:
  - Config is embedded in state (`state.config`) and edited through one `update-config` action. The reducer rejects an invalid config ("the reducer holds the line anyway") while the UI shows the same `configProblems` as messages. `configProblems` follows the "UX guidance over hard validation" rule: it only blocks what would make state invalid.
  - `isFootballState` is a hand-written structural guard. Its tiny helpers (`isObject`, the team shape check) are the only copyable part.
  - `SettingsScreen.tsx` mechanics: a working copy via `structuredClone`, save and cancel, a `role="alert"` problems list, `role="switch"` toggles, a "Settings saved" toast. These are interleaved with period-list editing in one component.
- Sport-neutral version: not a shared config type. A reusable shell would be a settings screen frame (draft copy, problems list, save and cancel) plus a validator convention returning a problem list. Volleyball config would be roughly best-of, set target, deciding-set target, win-by, with its own validity rules (for example an odd best-of, win-by of at least 1), and hazards such as lowering best-of below sets already won.
- Volleyball use: the pattern and the settings shell, not the types.
- Future sports: every sport with configurable rules (epic #25).
- Risk of extracting: medium. Splitting a shell out of the 388-line `SettingsScreen.tsx` touches accessibility and e2e behaviour.
- Data point: `MatchSession` accepts `config?` for a new match but `MatchPage` passes none, so the engine's `initialState` default applies (football defaults to `defaultMatchConfig()`); football edits config in-match via `update-config`. Volleyball would need the same default-config path in `initialState`.

## 6. Match store and storage versioning

Covered in section 1. Points for the next ticket:

- `MatchStore<State, Action, Message>` calls `engine.reduce`; messages go to notice listeners and are never stored.
- Storage has one global `VERSION` and no migration hook. A new sport brings its own `isState` guard.
- Wording in `MatchSession` mentions the clock.
- Risk: none for reuse.

## 7. Sync and notice plumbing

- Lives in: `src/sync/*`, `src/match/ConsoleHost.tsx`, `BoardHost.tsx`, `src/boards/registry.ts` (`subscribeNotices`).
- Football-specific: none in the plumbing. The football notices (`FootballMessage` in `state.ts`: `goal-scored`, `card-issued`, `substitution-made`; each with `id` of the form `<event id>@<action time>`, `at`, `team`, `minute`) are built by `noticesFor` in `engine/football.ts`. `NoticeBase.minute` is a match-clock notion that volleyball lacks.
- Volleyball use: reuses it as is. Its notices would be along the lines of a point (team, whether serve changed) and a set win (team, set number, final set score). The set-win animation with score reset needs care: the reset is state (a reconnecting board gets only a snapshot), while the animation is a transient notice ("a missed one only costs a banner", `src/engines/types.ts`), so the board must render correctly from state alone and treat the notice as decoration.
- Risk: none.

## 8. Update-banner machinery

- Shared already: `src/boards/useBanner.ts` (generic over `Notice`; sequences enter, hold, exit; a newer notice replaces the current one at once; optional `followUp` flips to a second card) and `src/boards/banner.ts` (timing constants, passed to CSS as custom properties). Tested in `useBanner.test.tsx`.
- Football-specific, not shared: `board/UpdateBanner.tsx` and `UpdateBanner.module.css` (content switch on football notices, minute readout, placement in the scoring team's bottom corner via grid columns, `role="status"`), `board/followUp.ts` (substitution pair overflow), `board/icons.tsx`. The CSS relies on variables defined by `FootballBoard.module.css` (`--u`, `--stroke`, `--centre-width`, `--banner-*`), so it is coupled to the football board grid.
- Sport-neutral version of the component: a banner shell taking `phase`, `flip`, a side and children, with the timing properties and keyframes, and sport content passed in. It would still need the board to provide the unit variables.
- Volleyball use: the hook, yes. The component, only partly: the point + serve-change and set-win animations sound like board-level effects rather than a corner card. Timing is not configurable: `BANNER_HOLD_MS = 9000` is football-tuned and `useBanner` takes no per-sport override, which matters for volleyball where points arrive every few seconds.
- Risk of extracting: low for the hook (parameterising timing); medium for the component (CSS coupled to the board grid; changing the DOM touches the e2e and axe expectations).

## 9. Shared board chrome

- Lives in (football-local): `board/FootballBoard.module.css` and `FootballBoard.tsx`. The 16:9 letterboxed stage (`.viewport`, `.stage` with `container-type: inline-size`, `--u: calc(100cqw / 1280)`), the "Disconnected from console" `role="status"` text, the "Libero" wordmark, the visually hidden `h1`, the `data-testid="board-stage"` hook, and the team section with `h2` name, score `p` and `aria-label`.
- Football-specific: the three-column grid with a 380-unit centre, the clock/period/stoppage readout, sub pips, the reserved banner slot.
- Sport-neutral version: a `BoardStage` wrapper (stage scaling, viewport, disconnected indicator, wordmark, accessible title) exposing the `--u` unit system, with the sport supplying the inside. It has state-free but real behaviour (scaling, connected indicator), so it would meet the AGENTS.md "reason to exist" test. The unit system is the genuinely shared piece.
- Volleyball use: yes, for all four boards; full and minimal differ only in content.
- Future sports: all.
- Risk of extracting: low to medium. Pure presentation, but CSS moves between CSS Modules (component selectors may not go to `src/styles/`) and the e2e and axe tests depend on structure.
- Theming: `BoardPage` already handles `?theme=`; colours come from `tokens.css`.

## 10. Shared console chrome

All inside `src/games/football/console/`; none is shared today.

- Top bar (`FootballConsole.tsx`): board-connected indicator (`role="status"`), "Open scoreboard" link (`target="_blank"`), Settings and Undo buttons. Content is driven by `ConsoleProps`; only the page `h1` is sport-named.
- Toast: state plus `TOAST_MS = 3000` timer in `FootballConsole.tsx`, rendered as `<p role="status">` in `CentrePanel.tsx` with its CSS in `CentrePanel.module.css`. Generic behaviour, football placement. `cardToast.ts` is football-only.
- Hotkeys: `useSpaceToggle` (clock; football meaning) and `useUndoHotkey` (generic: ignores text fields, open `[role="dialog"]` and key repeat). Volleyball would copy the undo hotkey.
- Sheets (`GoalSheet`, `CardSheet`, `SubSheet`, `ClockSheet`, `LengthSheet`): each repeats a pattern of an inline `role="dialog"` with `aria-modal="false"`, `aria-labelledby`, `useId`, focus on open, Escape and digit handling through `addEventListener` (to satisfy jsx-a11y), and cancelling the default action of Enter so a refocused button does not reactivate. Volleyball has no player-number entry, so these sheets are not needed, but its operator-confirmed set end needs a confirm step. Nearest precedents are this sheet pattern and the two-step discard confirmation in `MatchSession.tsx`.
- Keypad: `keypad.ts` (`typeDigit`, `backspace`, `parseNumber`, tested) for two-digit shirt numbers; the digit-pad markup is duplicated in `GoalSheet.tsx` and `CardSheet.tsx`. No volleyball use in the MVP (no shirt numbers); a future jersey-number sport would use it. `clockEntry.ts` and `lengthEntry.ts` are clock-specific.
- Event feed: `events.ts` and the `TeamColumn.tsx` history use football event types.
- Risk of extracting: low to medium for the top bar, toast and undo hotkey (small, covered by `FootballConsole.test.tsx`); medium for a shared sheet shell (focus and accessibility subtleties documented in comments in `GoalSheet.tsx`).

## 11. Event log

- Lives in: `state.ts` (`MatchEvent`, `events`, `nextEventId` with `e<n>` ids never reused), `engine/football.ts`, `console/events.ts`.
- Football-specific: the event types and the `periodId` and `clockSeconds` stamp on `MatchEventBase`.
- Volleyball use: the MVP lists score, serve and sets won, with no event log. Undo does not need one (inverses over score fields suffice). A point-by-point log is a possible later need.
- Risk of extracting: medium. A shared event base would impose a clock-shaped `MatchEventBase` on a clockless sport.

## Things volleyball needs that football does not provide

Recorded for the next ticket; not extraction candidates.

- Selectable board layouts (full, minimal, animation variants) over one registry entry.
- Serve possession, set-end transitions with a score reset, and an operator confirmation step.
- Board animations driven by notices that must tolerate being missed.
- Win-condition config; the `update-config` plus `configProblems` pattern is the template.
- Per-sport storage migration (only a global `VERSION` exists).

## Cross-cutting constraints on any extraction

- AGENTS.md placement rules: engine and board never import each other; board never imports `src/engines`; console gets the engine from `EngineRegistry`; the neutral state module is types-only. The ESLint `no-restricted-imports` patterns match relative import strings, so a new shared directory needs its own patterns.
- Component tests are co-located per football component and would move with extracted code. The e2e specs (`e2e/football-board.spec.ts`, `e2e/football-console.spec.ts`) assert structure and run an axe scan.
- Styling rule: shared components need their own CSS Module; selectors cannot move to `src/styles/`.
