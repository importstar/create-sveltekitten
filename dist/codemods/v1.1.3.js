import { normalizeNewlines, warn } from './helpers.js';
// 1.1.3: openapi-typescript is a codegen CLI and the devtools component is bundled into the build,
// so a production install (`pnpm install --prod`) needs neither.
const MOVED = ['@tanstack/svelte-query-devtools', 'openapi-typescript'];
const NOT_TEMPLATE_JSON_WARNING = 'is not tab-indented JSON like the template, so it was left as is; move @tanstack/svelte-query-devtools and openapi-typescript to devDependencies by hand (see CHANGELOG)';
/** Adds `name` before the first key that sorts after it, keeping the existing order. */
function insertSorted(deps, name, version) {
    const entries = Object.entries(deps);
    const at = entries.findIndex(([key]) => key.localeCompare(name, 'en') > 0);
    entries.splice(at === -1 ? entries.length : at, 0, [name, version]);
    return Object.fromEntries(entries);
}
export function moveToDevDependencies(content) {
    const normalized = normalizeNewlines(content);
    let pkg;
    try {
        pkg = JSON.parse(normalized);
    }
    catch {
        return warn(content, NOT_TEMPLATE_JSON_WARNING);
    }
    const toMove = MOVED.filter((name) => pkg.dependencies?.[name] !== undefined);
    if (toMove.length === 0)
        return content;
    if (JSON.stringify(pkg, null, '\t') + '\n' !== normalized) {
        return warn(content, NOT_TEMPLATE_JSON_WARNING);
    }
    const dependencies = { ...pkg.dependencies };
    let devDependencies = { ...pkg.devDependencies };
    for (const name of toMove) {
        const version = dependencies[name];
        delete dependencies[name];
        if (devDependencies[name] === undefined) {
            devDependencies = insertSorted(devDependencies, name, version);
        }
    }
    pkg.devDependencies = devDependencies;
    pkg.dependencies = dependencies;
    return JSON.stringify(pkg, null, '\t') + '\n';
}
const codemod = {
    from: '1.1.2',
    to: '1.1.3',
    transforms: [
        {
            file: 'package.json',
            transform: moveToDevDependencies,
        },
    ],
};
export default codemod;
