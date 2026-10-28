import { createServer } from 'node:http';

// Valid JWTs with exp: 9999999999 (year 2286) — jwt.decode() parses without verification
const MOCK_ACCESS_TOKEN =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.fake';
const MOCK_REFRESH_TOKEN =
	'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.fake-refresh';

const VALID = { username: 'admin', password: 'secret' };

const server = createServer(async (req, res) => {
	const chunks = [];
	for await (const chunk of req) chunks.push(chunk);
	const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');

	res.setHeader('Content-Type', 'application/json');

	if (req.method === 'POST' && req.url === '/v1/auth/login') {
		if (body.username === VALID.username && body.password === VALID.password) {
			res.writeHead(200);
			res.end(
				JSON.stringify({
					access_token: MOCK_ACCESS_TOKEN,
					refresh_token: MOCK_REFRESH_TOKEN,
					token_type: 'bearer',
				})
			);
		} else {
			res.writeHead(401);
			res.end(JSON.stringify({ detail: 'Invalid credentials' }));
		}
		return;
	}

	// As in src/libs/api-specs/fastapi.json: the refresh token arrives as the refresh_token cookie
	// and only a new access token (GetAccessTokenResponse) comes back.
	if (req.method === 'GET' && req.url === '/v1/auth/refresh_token') {
		const refreshToken = /(?:^|;\s*)refresh_token=([^;]*)/.exec(req.headers.cookie ?? '')?.[1];
		if (refreshToken === MOCK_REFRESH_TOKEN) {
			res.writeHead(200);
			res.end(JSON.stringify({ access_token: MOCK_ACCESS_TOKEN, token_type: 'bearer' }));
		} else {
			res.writeHead(401);
			res.end(JSON.stringify({ detail: 'Invalid refresh token' }));
		}
		return;
	}

	if (req.method === 'GET' && req.url === '/v1/users/me') {
		if (req.headers.authorization === `Bearer ${MOCK_ACCESS_TOKEN}`) {
			res.writeHead(200);
			res.end(JSON.stringify({ username: VALID.username }));
		} else {
			res.writeHead(401);
			res.end(JSON.stringify({ detail: 'Not authenticated' }));
		}
		return;
	}

	if (req.method === 'GET' && req.url === '/v1/health') {
		res.writeHead(200);
		res.end(JSON.stringify({ status: 'ok' }));
		return;
	}

	res.writeHead(404);
	res.end(JSON.stringify({ detail: 'Not found' }));
});

server.listen(9001, () => console.log('Mock API running on http://localhost:9001'));
