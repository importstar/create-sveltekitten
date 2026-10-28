# AGENTS.md — create-sveltekitten

This is a CLI scaffolding tool (`pnpx create-sveltekitten`). It generates SvelteKit projects from templates and can patch existing projects via a codemod system. See `CONTRIBUTING.md` for the full narrative walkthrough of shipping a template fix.

## Commands

```bash
pnpm build    # compile src/ → dist/ (tsc) — always run after editing src/
pnpm dev      # run CLI directly via tsx (for local testing)
pnpm test     # tsc, then vitest over test/ (runs the built dist/)
```

Run the CLI locally:
```bash
node dist/index.js            # scaffold (interactive)
node dist/index.js --name demo --template ssr --mode fullstack --yes   # scaffold, no prompts
node dist/index.js patch      # patch an existing project
```

The `dist/` directory is committed — always rebuild before committing.

## Repository layout

```
src/
  index.ts          — entry point: routes commands, contains scaffold logic
  patch.ts          — patch command implementation
  codemods/
    index.ts        — codemod registry + types
    apply.ts        — applyCodemods(): the pure engine patch.ts and the tests share
    helpers.ts      — replaceFile / createFile / replaceText transform helpers
templates/
  ssr/              — SSR template
  ssr-fullstack/    — files that replace their ssr/ counterpart when ssrMode is fullstack
  spa/              — SPA template
dist/               — compiled output (committed, enables pnpx github: usage)
scripts/make-codemod-fixture.mjs — writes codemod fixture inputs from git history
test/               — vitest: CLI, codemod fixtures (test/fixtures/codemods/<to>/<variant>/)
```

## Template version system

Every scaffolded project receives a `.sveltekitten.json`:
```json
{ "version": "0.1.0", "template": "ssr" }
```

The version comes from `package.json` at scaffold time. The `patch` command uses it to select applicable codemods.

## Feature architecture convention (inside templates)

Template features under `src/lib/features/<name>/` follow a layered pattern — `src/lib/features/items/` in each template is the canonical example, see `templates/ssr/agent-role.md` / `templates/spa/agent-role.md` for the full breakdown:

- `schema.ts` (Zod) → `contract.ts` (interface: what any implementation of the feature's API must do) → `api.ts` (implements the contract) → `context.ts` (`createContext` for the contract; the root layout provides the real implementation) → `queries.ts` (TanStack Query hooks, depend on the contract via an optional parameter defaulting to the context value, not on `api.ts` directly)
- SSR full-stack features additionally split `server.ts` (Drizzle repository, no business rules) from `service.ts` (use-case layer with authorization — e.g. ownership checks). `service.ts` declares the repository interface it needs and exports a `create<Feature>Service(repo)` factory; `server.ts` implements the interface, and `src/lib/server/services.ts` (composition root) wires them. Route handlers (`src/routes/api/<feature>/+server.ts`) call the service from `$lib/server/services`, never `server.ts` directly. `service.test.ts` tests the rules against an in-memory repository under `testing/`.

When this pattern changes, update it in three places together: the template files themselves, `templates/ssr/agent-role.md` / `templates/spa/agent-role.md`, and this section.

## Fixing a bug in a template file

Never change a template file without a matching codemod entry — existing projects cannot receive the fix otherwise.

You must always do all these steps — never skip any:

1. **Edit** the file under `templates/ssr/` or `templates/spa/`. A file that exists in both `ssr/` and `ssr-fullstack/` must be fixed in the copy for the mode that has the bug; the codemod sets `ssrMode` to target only that mode.
2. **Add a codemod** — an entry in the `codemods` array in `src/codemods/index.ts`, **at the end**, so existing projects can receive the fix, plus its fixture test (see Testing)
3. **Bump the version** in `package.json` (`npm version patch` / `minor` / `major`)
4. `pnpm build && pnpm test && npm publish`

### Codemod entry shape

```ts
{
  from: '<current published version>',
  to: '<new version>',
  transforms: [
    {
      file: 'relative/path/from/project/root.ts',
      template: 'ssr',        // optional: 'ssr' | 'spa'
      ssrMode: 'fullstack',   // optional: 'fullstack' | 'fastapi'
      transform: (content: string) => content.replaceAll('old', 'new'),
    },
  ],
}
```

### Codemod rules

- Entries in the `codemods` array must be in ascending version order
- `from` = current published version, `to` = new version being released
- `transform` must be a pure function (no side effects, no I/O)
- Missing files are skipped automatically by the runner
- Add one entry per bug fix — do not batch multiple unrelated fixes into one `from`/`to` pair
- Use the helpers in `src/codemods/helpers.ts`: `replaceFile(from, to)` for a whole file, `createFile(to)` for a new one (`create: true`), `replaceText(from, to)` for a snippet. They leave an edited file alone **and return a warning**, which `patch` prints with the file and the codemod `from → to`. A hand-written transform returns `{ content, warnings }` when its pattern is missing instead of silently returning the content unchanged.

**If two codemods in the array touch the same file** (e.g. one adds a function, a later one changes how the route calls it), `patch.ts` chains them correctly within a single run — each transform sees the previous transform's output for that file, not stale on-disk content. This only works because transforms stay pure and guarded (check before replacing); don't rely on a transform re-reading the file from disk mid-run.

## When editing CLI source only (not templates)

No version bump needed unless the change affects `patch` behavior.

## Testing

```bash
pnpm test   # tsc && vitest run; CI runs the same after checking dist/
```

Tests run the built `dist/`, the code users run. CI (`.github/workflows/ci.yml`) runs `pnpm build`, fails when `git diff --exit-code dist` shows a change (src edited without rebuilding and committing `dist/`), then `pnpm test`.

**Fixture test for a new codemod** (required: the suite fails for any codemod from 0.3.0 on without a fixture):

1. After the version bump, `pnpm build && node scripts/make-codemod-fixture.mjs <to>`. For every template/mode the codemod targets it writes `test/fixtures/codemods/<to>/<variant>/`: `input/` (the files the codemod touches as the `from` release scaffolds them, read from git history, plus `.sveltekitten.json`) and `reference/` (the same files from the `to` template). Never edit these by hand.
2. `pnpm exec vitest run -u test/codemods.test.ts` writes `expected/`. Read every expected file: it is what `patch` writes into users' projects.
3. `test/codemod-template-parity.test.ts` checks `expected/` equals `reference/`. A difference is a bug in the codemod or the template, unless it is justified; list those in its `KNOWN_DIFFERENCES` with the reason.

`test/helpers/codemods.ts` has `runCodemodFixture(version, dir)` (returns `Map<file, content>`) and `runCodemodFixtureWithWarnings` for other cases, e.g. an edited file that must produce a warning.

To try `patch` by hand, create a temp directory with a `.sveltekitten.json` and the relevant files (or copy a fixture's `input/`), then run `node dist/index.js patch` from that directory.

## Do not

- Add new commands by modifying `main()` — add a new branch in the `command` switch at the bottom of `index.ts`
- Write codemods that assume file structure beyond what the template generates
- Bump the version without adding a codemod when a template file changes
- Edit `dist/` files by hand — always go through `src/` + `pnpm build`
- Add codemods out of version order
- Write transforms with side effects or I/O

---
`CLAUDE.md` in this repo is a symlink to this file, kept so tools that specifically look for that filename (e.g. Claude Code) still resolve to the same content. Edit this file, not that one.
