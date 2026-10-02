const OLD_VITE_CONFIG = `import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()]
});
`;
const NEW_VITE_CONFIG = `import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson()],
	test: {
		// Unit tests live next to the code; Playwright owns e2e/*.test.ts.
		include: ['src/**/*.{test,spec}.ts'],
		passWithNoTests: true
	}
});
`;
/** Insert `key` right after `afterKey`, keeping the rest of the object's order. */
function insertAfter(obj, afterKey, key, value) {
    if (key in obj)
        return obj;
    const out = {};
    let inserted = false;
    for (const [k, v] of Object.entries(obj)) {
        out[k] = v;
        if (k === afterKey) {
            out[key] = value;
            inserted = true;
        }
    }
    if (!inserted)
        out[key] = value;
    return out;
}
function addVitest(content) {
    const pkg = JSON.parse(content);
    pkg.scripts = insertAfter(pkg.scripts ?? {}, 'lint', 'test:unit', 'vitest run');
    pkg.devDependencies = insertAfter(pkg.devDependencies ?? {}, 'vite-plugin-devtools-json', 'vitest', '^5.0.3');
    return JSON.stringify(pkg, null, '\t') + '\n';
}
const AGENT_ROLE_REPLACEMENTS = [
    [
        '- **Type-check before finishing**: `pnpm check`\n',
        '- **Type-check and unit-test before finishing**: `pnpm check && pnpm test:unit`\n'
    ],
    [
        'and verify with `pnpm check`.\n',
        'and verify with `pnpm check` and `pnpm test:unit`.\n'
    ]
];
const codemod = {
    from: '0.3.11',
    to: '0.3.12',
    transforms: [
        {
            // Neither template had a unit test runner (only Playwright e2e), so the
            // service rules and the ItemsApi contract could not be tested in isolation.
            // Run `pnpm install` after patching to pick up vitest.
            file: 'package.json',
            transform: addVitest
        },
        {
            // Vitest's default include would also pick up Playwright's e2e/*.test.ts;
            // restrict it to src/. Customised configs are left alone.
            file: 'vite.config.ts',
            transform: (content) => (content === OLD_VITE_CONFIG ? NEW_VITE_CONFIG : content)
        },
        {
            file: 'agent-role.md',
            transform: (content) => AGENT_ROLE_REPLACEMENTS.reduce((next, [from, to]) => (next.includes(from) ? next.replace(from, to) : next), content)
        }
    ]
};
export default codemod;
