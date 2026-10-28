import { z } from 'zod';

export const noteSchema = z.object({ id: z.string(), text: z.string().min(1) });
export type Note = z.infer<typeof noteSchema>;
