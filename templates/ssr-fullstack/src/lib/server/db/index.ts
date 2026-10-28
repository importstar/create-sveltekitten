import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { createDb } from './client';
import { DATABASE_URL } from '$app/env/private';
import { building } from '$app/env';

export const db = building ? drizzle(new Database(':memory:'), { schema }) : createDb(DATABASE_URL);
