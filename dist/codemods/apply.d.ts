import type { Codemod } from './index.js';
export interface ProjectConfig {
    version: string;
    template: string;
    /** `fastapi` is the pre-2.2.0 name of `openapi`. `patch` refuses it; the engine still treats the two as one mode. */
    ssrMode?: 'fullstack' | 'openapi' | 'fastapi';
}
export type TransformStatus = 'create' | 'modified' | 'unchanged' | 'skipped' | 'delete';
export interface TransformLog {
    file: string;
    /** `skipped`: the file does not exist and the transform does not create it. */
    status: TransformStatus;
    warnings: string[];
}
export interface CodemodLog {
    codemod: Codemod;
    transforms: TransformLog[];
}
export interface CodemodWarning {
    file: string;
    from: string;
    to: string;
    message: string;
}
export interface FileChange {
    file: string;
    content: string;
    isNew: boolean;
    /** Remove the file instead of writing `content`. */
    delete?: boolean;
}
export interface CodemodRun {
    /** One entry per codemod, in run order, for `patch` to print. */
    log: CodemodLog[];
    /** Final content of every file a transform ran on, changed or not (deleted files excluded). */
    files: Map<string, string>;
    /** Files a transform removed: `patch` deletes them. */
    deleted: string[];
    /** Files whose final content differs from what is on disk: what `patch` writes. */
    changes: FileChange[];
    warnings: CodemodWarning[];
}
/**
 * Runs `codemods` in order over a project without touching the disk. `readFile` returns a
 * file's content, or undefined when it does not exist.
 *
 * Several codemods in one run can touch the same file (e.g. 0.3.0 → 0.3.3 applies 0.3.1,
 * 0.3.2 and 0.3.3). Each file's in-progress content is carried forward, so a later codemod
 * sees the earlier one's changes instead of re-reading stale content and clobbering them.
 */
export declare function applyCodemods(codemods: Codemod[], config: ProjectConfig, readFile: (file: string) => Promise<string | undefined>): Promise<CodemodRun>;
/** Source files `patch` scans for leftovers: Svelte components and JS/TS modules. */
export declare const isSourceFile: (file: string) => boolean;
/**
 * Source files in `files` (path → content) that match `pattern`: source a codemod could not migrate,
 * usually because the user wrote it. Sorted, for `patch` to print.
 */
export declare function findLeftovers(files: Map<string, string>, pattern: RegExp): string[];
