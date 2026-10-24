import { dev } from '$app/environment';
import pino from 'pino';

// Create different logger configurations for server and browser
const createLogger = () => {
	return pino({
		level: dev ? 'debug' : 'info',
		redact: [
			'password',
			'*.password',
			'cookie',
			'*.cookie',
			'authorization',
			'*.authorization',
			'req.headers.cookie',
			'req.headers.authorization'
		],
		transport: dev
			? {
					target: 'pino-pretty',
					options: {
						colorize: true,
						translateTime: 'SYS:yyyy-mm-dd HH:MM:ss'
					}
				}
			: undefined
	});
};

const baseLogger = createLogger();

export const logger = Object.assign(baseLogger, {
	inspect: (...args: any[]) => {
		if (dev) {
			console.log(...args);
		}
	},
	dir: (obj: any, options?: any) => {
		if (dev) {
			console.dir(obj, options);
		}
	},
	table: (data: any, columns?: string[]) => {
		if (dev) {
			console.table(data, columns);
		}
	}
});
