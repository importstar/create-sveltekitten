import { defineEnvVars } from '@sveltejs/kit/env';

// Read when the server starts; import them from $app/env/public and $app/env/private.
export const variables = defineEnvVars({
	PUBLIC_APP_TITLE: {
		public: true,
		description: 'App title shown in the header',
		schema: (value) => value ?? ''
	},
	DATABASE_URL: {
		description: 'SQLite database file (default sqlite.db)',
		schema: (value) => value || 'sqlite.db'
	}
});
