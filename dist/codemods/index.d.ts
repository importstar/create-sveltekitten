/**
 * What a transform returns: the new content, or the content plus warnings for the person
 * running `patch` (e.g. the file was edited, so the change must be applied by hand).
 */
export type TransformResult = string | {
    content: string;
    warnings: string[];
    /** Remove the file from the project (`content` is ignored). Use `deleteFile` from helpers. */
    delete?: boolean;
};
export interface FileTransform {
    /** Relative path from project root, e.g. "src/lib/auth.ts" */
    file: string;
    /** If true, create the file even when it doesn't exist yet (transform receives empty string). */
    create?: boolean;
    /** Restrict this transform to a specific template type. Skipped when template doesn't match. */
    template?: 'ssr' | 'spa';
    /** Restrict this transform to a specific SSR mode. Skipped when the project's ssrMode doesn't match (or is unset). `fastapi` and `openapi` match each other. */
    ssrMode?: 'fullstack' | 'openapi' | 'fastapi';
    /** Must be pure. Return warnings instead of silently leaving a file unchanged when the expected text is missing. */
    transform: (content: string) => TransformResult;
}
export interface Codemod {
    from: string;
    to: string;
    transforms: FileTransform[];
    /**
     * Steps `patch` cannot do itself (e.g. run an upstream migration over the user's own code),
     * printed after this codemod is applied.
     */
    notes?: string[];
    /**
     * After applying, `patch` lists project source files that still match this pattern, so code
     * the codemod does not own (files the user wrote) is never left broken silently.
     */
    leftovers?: {
        pattern: RegExp;
        message: string;
    };
}
/** Add new version modules here in ascending order. */
export declare const codemods: Codemod[];
/** Returns codemods that need to run to go from `currentVersion` to `targetVersion`. */
export declare function getApplicableCodemods(currentVersion: string, targetVersion: string): Codemod[];
