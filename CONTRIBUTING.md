# Contributing

## Tickets

[GitHub Issues](https://github.com/karmicoder/libero/issues) are the single source of truth for work on Libero: features, bugs, and chores. Please don't track work in other places (TODO comments, docs, external boards) without a linked issue.

- **Before starting:** find or open an issue describing the change. For anything non-trivial, agree on the approach in the issue first.
- **Branches and PRs:** reference the issue in the PR description. Use `Closes #123` so merging closes it.
- **Scope:** one issue per focused change. Split follow-ups into new issues rather than growing a PR.
- **Design:** the design reference is linked from the relevant issue. Note any deviation from it in the PR.

## Before opening a PR

```sh
npm run format
npm run check
```

`check` runs the same steps as CI: format check, lint, typecheck, tests, build.
