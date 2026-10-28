// See https://svelte.dev/docs/kit/types#app.d.ts

import type { User, Session } from '#lib/server/db/schema.js';

// for information about these interfaces
declare global {
	namespace App {
		interface Error {
			/** The request's trace id, set by handleError (src/lib/hooks/handle-error.ts). */
			errorId?: string;
		}
		interface Locals {
			user: User | null;
			session: Session | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
		namespace Superforms {
			type Message = {
				type: 'error' | 'success';
				text: string;
				description?: string;
			};
		}
	}
}

export {};
