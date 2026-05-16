# AGENTS.md — create-sveltekitten

This is a CLI scaffolding tool. Read `CLAUDE.md` and `CONTRIBUTING.md` before making changes.

## Build

```bash
pnpm build    # always run after editing src/
```

The `dist/` directory is committed — always rebuild before committing.

## Key files

| File | Purpose |
|---|---|
| `src/index.ts` | CLI entry: command routing + scaffold |
| `src/patch.ts` | `patch` command |
| `src/codemods/index.ts` | Codemod registry and runner |
| `templates/ssr/` | SSR template |
| `templates/spa/` | SPA template |

## When editing a template file

You must always do all three steps — never skip any:

1. **Edit** the file under `templates/ssr/` or `templates/spa/`
2. **Add a codemod** in `src/codemods/index.ts` so existing projects can receive the fix
3. **Bump the version** in `package.json` (`npm version patch|minor|major`)

Then rebuild: `pnpm build`

### Codemod entry shape

```ts
{
  from: '<current published version>',
  to: '<new version>',
  transforms: [
    {
      file: 'relative/path/from/project/root.ts',
      transform: (content: string) => content.replaceAll('old', 'new'),
    },
  ],
}
```

The `codemods` array must remain in ascending version order.

## When editing CLI source only (not templates)

No version bump needed unless the change affects `patch` behavior.

## Testing

```bash
pnpm build
node dist/index.js patch   # run inside a project with .sveltekitten.json
```

To test a codemod without an actual project, create a temp directory with a `.sveltekitten.json` and relevant fixture files, then run `node dist/index.js patch` from that directory.

## Do not

- Edit `dist/` files by hand — always go through `src/` + `pnpm build`
- Add codemods out of version order
- Write transforms with side effects or I/O
- Skip the codemod step when fixing a template bug
