import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { createDb } from './client';
import { env } from '$env/dynamic/private';
import { building } from '$app/environment';

export const db = building
	? drizzle(new Database(':memory:'), { schema })
	: createDb(env.DATABASE_URL || 'sqlite.db');
