import type { Codemod } from './index.js';
export declare function upgradePackageJson(content: string): import("./index.js").TransformResult;
/**
 * The template's vite.config.ts gets exactly the 2.0.0 file. One whose plugin list was edited but
 * still calls a bare `sveltekit()` once gets the options inline; anything else gets a warning
 * with the snippet to add.
 */
export declare function moveConfigIntoVite(adapter: string): (content: string) => ReturnType<(content: string) => import("./index.js").TransformResult>;
declare const codemod: Codemod;
export default codemod;
