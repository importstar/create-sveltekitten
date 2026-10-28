import type { Note } from '$lib/features/notes/schema';
import { cn } from '$lib/utils/shadcn';

export const noteClass = (note: Note) => cn('rounded border p-2', note.text.length > 80 && 'text-sm');
