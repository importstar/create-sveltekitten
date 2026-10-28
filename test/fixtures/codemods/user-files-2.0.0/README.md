# codemod 1.1.4 → 2.0.0 with files the user wrote

`<variant>/overlay/` holds files a user added to a 1.1.4 project (a feature under
`src/lib/features/`, a route using `$app/stores`, a hook typed from `@sveltejs/kit`). The test
copies `../2.0.0/<variant>/input/` and this overlay into a temp project. The codemod must leave
these files untouched (it only owns template files) and `patch` must list each of them as still
needing `npx sv migrate sveltekit-3`, so none is left broken silently.
