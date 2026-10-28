import { normalizeNewlines, PATTERN_NOT_FOUND_WARNING, replaceText, warn } from './helpers.js';
const SSR_E2E_OLD = '"test:e2e": "pnpm build && playwright test"';
const SSR_E2E_NEW = '"test:e2e": "playwright install chromium && pnpm build && playwright test"';
const SPA_E2E_OLD = '"test:e2e": "vite build --mode test && playwright test"';
const SPA_E2E_NEW = '"test:e2e": "playwright install chromium && vite build --mode test && playwright test"';
const ROLE_ANCHOR = '- **Type-check and unit-test before finishing**: `pnpm check && pnpm test:unit`\n';
const ROLE_NOTE = "- **E2E**: `pnpm test:e2e` installs the browser Playwright needs on first run (network required once), then builds and runs `e2e/`.\n";
function addRoleNote(content) {
    if (normalizeNewlines(content).includes(ROLE_NOTE))
        return content;
    if (!content.includes(ROLE_ANCHOR))
        return warn(content, PATTERN_NOT_FOUND_WARNING);
    return content.replace(ROLE_ANCHOR, ROLE_ANCHOR + ROLE_NOTE);
}
const codemod = {
    from: '0.3.21',
    to: '0.3.22',
    transforms: [
        {
            file: 'package.json',
            template: 'ssr',
            transform: replaceText(SSR_E2E_OLD, SSR_E2E_NEW),
        },
        {
            file: 'package.json',
            template: 'spa',
            transform: replaceText(SPA_E2E_OLD, SPA_E2E_NEW),
        },
        {
            file: 'agent-role.md',
            transform: addRoleNote,
        },
    ],
};
export default codemod;
