import type { Codemod, TransformResult } from './index.js';
/** Adds the OpenTelemetry packages to `dependencies` (server runtime), keeping any already listed. */
export declare function addOtelDependencies(content: string): TransformResult;
declare const codemod: Codemod;
export default codemod;
