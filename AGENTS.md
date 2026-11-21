# world-parts — instructions for coding agents

Read [docs/PROJECT.md](docs/PROJECT.md) first. It is the project passport: what this prototype is, what is already shipped, and what is still open. The README is the long version of the same product. Do not contradict either one.

## Rules

- The license is MIT (`LICENSE`). Keep it. The SpAItial world files and still frames are not covered by that licence.
- No real brands and no real part numbers. Suppliers stay Supplier A, B and C. Rooms, equipment and parts live in `lib/data.ts`.
- One change per pull request, into `main`. The owner merges. Do not merge, rebase, force-push, or amend.
- Commit as Denys Sergushkin <sergushkincom@users.noreply.github.com>. Short plain sentences. No agent trailers or boilerplate.
- Where only he knows the wording, leave a `[DENYS: ...]` marker.

## Checks

pnpm. Node 22. CI is `.github/workflows/ci.yml`: frozen install, typecheck, lint, unit tests, production build, Playwright Chromium.

```bash
pnpm install
pnpm run typecheck
pnpm run lint
pnpm test
pnpm run test:e2e
```

`pnpm test` is the node:test suite in `lib/*.test.ts`. `pnpm run test:e2e` is Playwright. The find-a-part spec stays on the still frame, because headless Chromium has no WebGL.

## When behaviour changes

Update **Status** and **Known gaps** in `docs/PROJECT.md` in the same change. If the README describes that behaviour, update the README too.
