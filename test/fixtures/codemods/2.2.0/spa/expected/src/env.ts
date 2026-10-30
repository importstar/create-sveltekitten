import { defineEnvVars } from '@sveltejs/kit/env';

// Static: inlined into the bundle at build time (a SPA has no server to read them at runtime).
export const variables = defineEnvVars({
	PUBLIC_APP_TITLE: {
		public: true,
		static: true,
		description: 'App title shown in the header'
	},
	PUBLIC_API_URL: {
		public: true,
		static: true,
		description: 'API base URL the browser calls'
	}
});
