// See https://svelte.dev/docs/kit/types#app.d.ts

import type { paths } from '$lib/api/paths/fastapi';
import type { Client } from 'openapi-fetch';

// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			fastapiClient: Client<paths>;
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
