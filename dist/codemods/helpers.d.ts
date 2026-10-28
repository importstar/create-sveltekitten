import type { TransformResult } from './index.js';
export declare const EDITED_FILE_WARNING = "differs from the template this codemod expects, so it was left as is; apply this change by hand (see CHANGELOG)";
export declare const PATTERN_NOT_FOUND_WARNING = "pattern not found, so it was left as is; apply this change by hand (see CHANGELOG)";
export declare const EXISTING_FILE_WARNING = "already exists with different content, so it was left as is; compare it with the new template by hand (see CHANGELOG)";
export declare const normalizeNewlines: (content: string) => string;
export declare function warn(content: string, warning: string): TransformResult;
/**
 * Swaps a whole file that is still exactly the `from` template for `to`. A file that already
 * equals `to` is left alone; any other file was edited and is left alone with a warning.
 */
export declare function replaceFile(from: string, to: string): (content: string) => TransformResult;
/** Fills a file the codemod adds (`create: true`); an existing file with other content gets a warning. */
export declare function createFile(to: string): (content: string) => TransformResult;
/** Replaces the first `from` with `to`; warns when neither is in the file. */
export declare function replaceText(from: string, to: string): (content: string) => TransformResult;
/**
 * Deletes a file that is still exactly the `from` template; any other content was edited and
 * is left alone with `editedWarning`. A missing file is skipped by the runner.
 */
export declare function deleteFile(from: string, editedWarning?: string): (content: string) => TransformResult;
/**
 * Replaces each `from` with its `to`, all or nothing: every `from` must be in the file (each is
 * replaced once, in order). A file that already has every `to` and no `from` is left alone; any
 * other file was edited and is left alone with a warning.
 */
export declare function replaceTexts(pairs: ReadonlyArray<readonly [from: string, to: string]>): (content: string) => TransformResult;
