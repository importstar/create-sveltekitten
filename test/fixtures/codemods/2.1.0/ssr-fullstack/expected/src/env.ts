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
	},
	LOG_LEVEL: {
		description:
			'pino level: trace, debug, info, warn, error or fatal (default debug in dev, info otherwise)',
		schema: (value) => value ?? ''
	},
	OTEL_EXPORTER_OTLP_ENDPOINT: {
		description: 'OTLP/HTTP collector base URL; spans are exported only when set',
		schema: (value) => value ?? ''
	},
	OTEL_SERVICE_NAME: {
		description: 'service.name on exported spans (default sveltekitten)',
		schema: (value) => value || 'sveltekitten'
	}
});
