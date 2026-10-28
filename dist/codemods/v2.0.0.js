import { createFile, deleteFile, normalizeNewlines, replaceTexts, warn } from './helpers.js';
import { hunkTransforms } from './v2.0.0-hunks.js';
/** Ranges the 1.1.4 templates had (or any range of the same major) → the 2.0.0 range. */
const UPGRADES = {
    '@sveltejs/kit': { from: /^\^2\./, to: '^3.1.0' },
    '@sveltejs/adapter-node': { from: /^\^5\./, to: '^6.0.0' },
    '@sveltejs/adapter-static': { from: /^\^3\./, to: '^4.0.0' },
    'sveltekit-superforms': { from: /^\^2\./, to: '^3.0.0' },
    formsnap: { from: /^\^2\.0\./, to: '^2.1.0' }
};
const OLD_NODE_ENGINES = ['>=20', '>=22'];
const NODE_ENGINE = '>=22.17';
const LIB_IMPORTS = { '#lib': './src/lib/index.js', '#lib/*': './src/lib/*' };
const NOT_TEMPLATE_JSON_WARNING = 'is not tab-indented JSON like the template, so it was left as is; `npx sv migrate sveltekit-3` updates it (or see CHANGELOG)';
export function upgradePackageJson(content) {
    const normalized = normalizeNewlines(content);
    let pkg;
    try {
        pkg = JSON.parse(normalized);
    }
    catch {
        return warn(content, NOT_TEMPLATE_JSON_WARNING);
    }
    if (JSON.stringify(pkg, null, '\t') + '\n' !== normalized)
        return warn(content, NOT_TEMPLATE_JSON_WARNING);
    for (const deps of [pkg.devDependencies, pkg.dependencies]) {
        if (!deps)
            continue;
        for (const [name, { from, to }] of Object.entries(UPGRADES)) {
            if (deps[name] !== undefined && from.test(deps[name]))
                deps[name] = to;
        }
    }
    if (pkg.engines?.node && OLD_NODE_ENGINES.includes(pkg.engines.node))
        pkg.engines.node = NODE_ENGINE;
    pkg.imports = { ...LIB_IMPORTS, ...pkg.imports };
    return JSON.stringify(pkg, null, '\t') + '\n';
}
// --- svelte.config.js → sveltekit({ ... }) in vite.config.ts -------------------------------
const svelteConfig = (adapter) => `import adapter from '${adapter}';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: { adapter: adapter() }
};

export default config;
`;
const SVELTE_CONFIG_WARNING = 'differs from the template, so it was left as is; SvelteKit 3 will not start while it exists. Move its options into sveltekit({ ... }) in vite.config.ts and delete it (`npx sv migrate sveltekit-3` does both)';
const VITE_IMPORT_FROM = "import devtoolsJson from 'vite-plugin-devtools-json';\n";
const viteImportTo = (adapter) => `import adapter from '${adapter}';\nimport { vitePreprocess } from '@sveltejs/vite-plugin-svelte';\n${VITE_IMPORT_FROM}`;
const VITE_PLUGINS_FROM = '\tplugins: [tailwindcss(), sveltekit(), devtoolsJson()],\n';
const VITE_PLUGINS_TO = `\tplugins: [
\t\ttailwindcss(),
\t\tsveltekit({
\t\t\t// Consult https://svelte.dev/docs/kit/integrations
\t\t\t// for more information about preprocessors
\t\t\tpreprocess: vitePreprocess(),
\t\t\tadapter: adapter()
\t\t}),
\t\tdevtoolsJson()
\t],
`;
const SVELTEKIT_IMPORT = "import { sveltekit } from '@sveltejs/kit/vite';\n";
/**
 * The template's vite.config.ts gets exactly the 2.0.0 file. One whose plugin list was edited but
 * still calls a bare `sveltekit()` once gets the options inline; anything else gets a warning
 * with the snippet to add.
 */
export function moveConfigIntoVite(adapter) {
    const exact = replaceTexts([
        [VITE_IMPORT_FROM, viteImportTo(adapter)],
        [VITE_PLUGINS_FROM, VITE_PLUGINS_TO]
    ]);
    return (content) => {
        const result = exact(content);
        if (typeof result === 'string')
            return result;
        const normalized = normalizeNewlines(content);
        if (normalized.split('sveltekit()').length === 2 &&
            normalized.includes(SVELTEKIT_IMPORT) &&
            !/\badapter\b/.test(normalized)) {
            return normalized
                .replace(SVELTEKIT_IMPORT, `import adapter from '${adapter}';\nimport { vitePreprocess } from '@sveltejs/vite-plugin-svelte';\n${SVELTEKIT_IMPORT}`)
                .replace('sveltekit()', 'sveltekit({ preprocess: vitePreprocess(), adapter: adapter() })');
        }
        return warn(content, `differs from the template, so it was left as is; pass the options that were in svelte.config.js to the plugin by hand: sveltekit({ preprocess: vitePreprocess(), adapter: adapter() }) with \`import adapter from '${adapter}'\` and \`import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'\``);
    };
}
// --- src/env.ts (new) -------------------------------------------------------------------------
const ENV_FULLSTACK = `import { defineEnvVars } from '@sveltejs/kit/env';

// Read when the server starts; import them from $app/env/public and $app/env/private.
export const variables = defineEnvVars({
	PUBLIC_APP_TITLE: {
		public: true,
		description: 'App title shown in the header',
		schema: (value) => value ?? ''
	},
	DATABASE_URL: {
		description: 'SQLite database file (default sqlite.db)',
		schema: (value) => value || 'sqlite.db'
	}
});
`;
const ENV_FASTAPI = `import { defineEnvVars } from '@sveltejs/kit/env';

// Read when the server starts; import them from $app/env/public and $app/env/private.
export const variables = defineEnvVars({
	PUBLIC_APP_TITLE: {
		public: true,
		description: 'App title shown in the header',
		schema: (value) => value ?? ''
	},
	BACKEND_API_URL: {
		description: 'FastAPI base URL the /api/proxy route forwards to',
		schema: (value) => value ?? ''
	}
});
`;
const ENV_SPA = `import { defineEnvVars } from '@sveltejs/kit/env';

// Static: inlined into the bundle at build time (a SPA has no server to read them at runtime).
export const variables = defineEnvVars({
	PUBLIC_APP_TITLE: {
		public: true,
		static: true,
		description: 'App title shown in the header'
	},
	PUBLIC_API_URL: {
		public: true,
		static: true,
		description: 'FastAPI base URL the browser calls'
	}
});
`;
const configTransforms = [
    { file: 'package.json', transform: upgradePackageJson },
    {
        file: 'svelte.config.js',
        template: 'ssr',
        transform: deleteFile(svelteConfig('@sveltejs/adapter-node'), SVELTE_CONFIG_WARNING)
    },
    {
        file: 'svelte.config.js',
        template: 'spa',
        transform: deleteFile(svelteConfig('@sveltejs/adapter-static'), SVELTE_CONFIG_WARNING)
    },
    { file: 'vite.config.ts', template: 'ssr', transform: moveConfigIntoVite('@sveltejs/adapter-node') },
    { file: 'vite.config.ts', template: 'spa', transform: moveConfigIntoVite('@sveltejs/adapter-static') },
    { file: 'src/env.ts', template: 'ssr', ssrMode: 'fullstack', create: true, transform: createFile(ENV_FULLSTACK) },
    { file: 'src/env.ts', template: 'ssr', ssrMode: 'fastapi', create: true, transform: createFile(ENV_FASTAPI) },
    { file: 'src/env.ts', template: 'spa', create: true, transform: createFile(ENV_SPA) }
];
const codemod = {
    from: '1.1.4',
    to: '2.0.0',
    transforms: [...configTransforms, ...hunkTransforms],
    leftovers: {
        pattern: /(['"`])\$lib(\/|['"`])|\$app\/stores|\$app\/environment|\$env\/|svelte\.config\.[cm]?[jt]s|import\s+(type\s+)?\{[^}]*\b(Handle|HandleServerError|HandleFetch|HandleClientError|ServerInit|Reroute|Transport)\b[^}]*\}\s*from\s*['"]@sveltejs\/kit['"]/,
        message: 'these files still use SvelteKit 2 APIs ($lib, $app/stores, $app/environment, $env/*, svelte.config.js or hook types from @sveltejs/kit). Commit, then run `npx sv migrate sveltekit-3` to migrate them:'
    },
    notes: [
        'SvelteKit 3 needs Node 22.17 or later.',
        '1. pnpm install            (pnpm-lock.yaml cannot be patched; this installs SvelteKit 3)',
        '2. git commit -am "chore: create-sveltekitten 2.0.0"',
        '3. npx sv migrate sveltekit-3   (migrates code you wrote: $lib → #lib, hook types, $env, …;',
        '   files patch already migrated are left as they are; read MIGRATION_TASKS.md it writes)',
        '4. pnpm check && pnpm build'
    ]
};
export default codemod;
