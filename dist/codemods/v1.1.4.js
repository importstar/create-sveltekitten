import { replaceText } from './helpers.js';
// 1.1.4: SPA docs say the access token is saved to localStorage (it was "in memory"),
// plus one line on the XSS risk.
const XSS_NOTE = (separator) => `- **XSS can steal the access token**${separator}any script injected into the page can read \`localStorage\`, so never render untrusted HTML with \`{@html}\`.\n`;
const codemod = {
    from: '1.1.3',
    to: '1.1.4',
    transforms: [
        {
            file: 'AGENTS.md',
            template: 'spa',
            transform: replaceText('- Auth is **client-side**: `authStore` (`src/lib/stores/auth.svelte.ts`) holds the access token in memory; refresh token lives in an httpOnly cookie\n', '- Auth is **client-side**: `authStore` (`src/lib/stores/auth.svelte.ts`) saves its state, access token included, to `localStorage` (`auth_state`) so it survives a reload; refresh token lives in an httpOnly cookie\n' +
                XSS_NOTE(': ')),
        },
        {
            file: 'agent-role.md',
            template: 'spa',
            transform: replaceText('- **Auth is client-side** — `authStore` holds the access token in memory; refresh token is in an httpOnly cookie\n', '- **Auth is client-side** — `authStore` saves its state, access token included, to `localStorage` (`auth_state`) so it survives a reload; refresh token is in an httpOnly cookie\n' +
                XSS_NOTE(' — ')),
        },
    ],
};
export default codemod;
