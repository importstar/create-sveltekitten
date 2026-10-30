/**
 * When the project has `AGENTS.md` and no `CLAUDE.md`, point `CLAUDE.md` at it.
 * A `CLAUDE.md` that already exists (a file or a symlink) is left alone.
 * Returns true when the link was created.
 */
export declare function linkClaudeMd(projectDir: string): Promise<boolean>;
