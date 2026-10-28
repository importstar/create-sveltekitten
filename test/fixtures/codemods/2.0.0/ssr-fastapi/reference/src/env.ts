import { defineEnvVars } from '@sveltejs/kit/env';

// Read when the server starts; import them from $app/env/public and $app/env/private.
export const variables = defineEnvVars({
	PUBLIC_APP_TITLE: {
		public: true,
		description: 'App title shown in the header',
		schema: (value) => value ?? ''
	},
	BACKEND_API_URL: {
		description: 'FastAPI base URL the /api/proxy route forwards to',
		schema: (value) => value ?? ''
	}
});
