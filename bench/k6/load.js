import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const plan = JSON.parse(open(__ENV.PLAN));
const workOk = new Counter('bench_work_ok');

export const options = {
	scenarios: plan.scenarios,
	summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'count'],
	discardResponseBodies: false
};

function baseHeaders(origin, cookie) {
	const host = origin.replace(/^https?:\/\//, '');
	const headers = {
		'x-forwarded-proto': 'http',
		'x-forwarded-host': host,
		Origin: origin
	};
	if (cookie) headers.Cookie = cookie;
	return headers;
}

export function setup() {
	if (!plan.needsAsset) return { asset: '' };
	const res = http.get(`${plan.originFullstack}/login`, {
		headers: baseHeaders(plan.originFullstack)
	});
	const match = String(res.body).match(/\/_app\/immutable\/[^"' ]+\.js/);
	return { asset: match ? match[0] : '' };
}

export function home() {
	const res = http.get(`${plan.originFullstack}/home`, {
		headers: baseHeaders(plan.originFullstack, `session_id=${plan.session}`),
		redirects: 0
	});
	if (check(res, { 'home is the dashboard': (r) => r.status === 200 && String(r.body).includes('Dashboard') })) {
		workOk.add(1);
	}
}

export function itemsGet() {
	const res = http.get(`${plan.originFullstack}/api/items`, {
		headers: baseHeaders(plan.originFullstack, `session_id=${plan.session}`),
		redirects: 0
	});
	if (
		check(res, {
			'items list has the seed': (r) => {
				if (r.status !== 200) return false;
				try {
					const body = JSON.parse(r.body);
					return Array.isArray(body) && body.length >= 1000;
				} catch {
					return false;
				}
			}
		})
	) {
		workOk.add(1);
	}
}

export function itemsPost() {
	const res = http.post(`${plan.originFullstack}/api/items`, JSON.stringify({ title: 'bench' }), {
		headers: {
			...baseHeaders(plan.originFullstack, `session_id=${plan.session}`),
			'Content-Type': 'application/json'
		},
		redirects: 0
	});
	if (check(res, { 'create item returns 201': (r) => r.status === 201 })) workOk.add(1);
}

export function login() {
	const res = http.post(
		`${plan.originFullstack}/login`,
		`username=${encodeURIComponent(plan.username)}&password=${encodeURIComponent(plan.password)}`,
		{
			headers: {
				...baseHeaders(plan.originFullstack),
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			redirects: 0
		}
	);
	const setCookie = res.headers['Set-Cookie'] || '';
	if (check(res, { 'login sets a session': (r) => r.status === 303 && setCookie.includes('session_id=') })) {
		workOk.add(1);
	}
}

export function proxy() {
	// A fresh expired access token on every call, so the BFF refreshes instead of reusing a warm token.
	const res = http.get(`${plan.originFastapi}/api/proxy/v1/items`, {
		headers: baseHeaders(plan.originFastapi, 'access_token=expired; refresh_token=refresh-1'),
		redirects: 0
	});
	if (check(res, { 'proxy returns the mock list': (r) => r.status === 200 })) workOk.add(1);
}

export function asset(data) {
	const res = http.get(`${plan.originFullstack}${data.asset}`, {
		headers: baseHeaders(plan.originFullstack),
		redirects: 0
	});
	if (
		check(res, {
			'immutable asset is javascript': (r) =>
				r.status === 200 && String(r.headers['Content-Type'] || '').includes('javascript')
		})
	) {
		workOk.add(1);
	}
}
