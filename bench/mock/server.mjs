import { createServer } from 'node:http';

// Stands in for FastAPI. GET /v1/items waits 20ms, then 401s an expired access token so the
// BFF refreshes, and 200s a token that refresh just issued.
const delayMs = Number(process.env.MOCK_DELAY_MS || 20);
let refreshes = 0;

function wait() {
	return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function tokenFrom(header) {
	const match = /^Bearer\s+(.+)$/i.exec(header || '');
	return match ? match[1] : '';
}

const server = createServer(async (req, res) => {
	const url = new URL(req.url || '/', 'http://mock');
	if (req.method === 'POST' && url.pathname === '/v1/auth/login') {
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ access_token: 'access-login', refresh_token: 'refresh-1', token_type: 'bearer' }));
		return;
	}
	if (req.method === 'GET' && url.pathname === '/v1/auth/refresh_token') {
		const cookie = req.headers.cookie || '';
		if (!cookie.includes('refresh_token=')) {
			res.writeHead(401, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ detail: 'no refresh token' }));
			return;
		}
		refreshes += 1;
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end(JSON.stringify({ access_token: `access-${refreshes}`, token_type: 'bearer' }));
		return;
	}
	if (req.method === 'GET' && url.pathname === '/v1/items') {
		await wait();
		const token = tokenFrom(req.headers.authorization);
		if (!token.startsWith('access-')) {
			res.writeHead(401, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ detail: 'expired' }));
			return;
		}
		res.writeHead(200, { 'content-type': 'application/json' });
		res.end('[]');
		return;
	}
	res.writeHead(404, { 'content-type': 'application/json' });
	res.end(JSON.stringify({ detail: 'not found', path: url.pathname }));
});

server.listen(9000, '0.0.0.0', () => {
	console.log('mock fastapi on :9000');
});
