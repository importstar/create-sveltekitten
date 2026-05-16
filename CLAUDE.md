# CLAUDE.md — create-sveltekitten

This is a CLI scaffolding tool (`pnpx create-sveltekitten`). It generates SvelteKit projects from templates and can patch existing projects via a codemod system.

## Commands

```bash
pnpm build          # compile src/ → dist/  (tsc)
pnpm dev            # run CLI directly via tsx (for local testing)
```

Run the CLI locally:
```bash
node dist/index.js            # scaffold (interactive)
node dist/index.js patch      # patch an existing project
```

## Repository layout

```
src/
  index.ts          — entry point: routes commands, contains scaffold logic
  patch.ts          — patch command implementation
  codemods/
    index.ts        — codemod registry + runner
templates/
  ssr/              — SSR template
  spa/              — SPA template
dist/               — compiled output (committed, enables pnpx github: usage)
```

## Template version system

Every scaffolded project receives a `.sveltekitten.json`:
```json
{ "version": "0.1.0", "template": "ssr" }
```

The version comes from `package.json` at scaffold time. The `patch` command uses it to select applicable codemods.

## Fixing a bug in a template file

See `CONTRIBUTING.md` for the full process. In short:

1. Fix the file under `templates/`
2. Add a codemod to `src/codemods/index.ts`
3. `npm version patch` (or `minor` / `major`)
4. `pnpm build && npm publish`

Never change a template file without a matching codemod entry — existing projects cannot receive the fix otherwise.

## Codemod rules

- Entries in `codemods` array must be in ascending version order
- `from` = current published version, `to` = new version being released
- `transform` must be a pure function (no side effects, no I/O)
- Missing files are skipped automatically by the runner

## What NOT to do

- Do not add new commands by modifying `main()` — add a new branch in the `command` switch at the bottom of `index.ts`
- Do not write codemods that assume file structure beyond what the template generates
- Do not bump the version without adding a codemod when a template file changes
