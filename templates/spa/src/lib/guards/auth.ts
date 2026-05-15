import { authStore } from '$lib/stores/auth.svelte';
import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';
import { ensureValidToken } from '$lib/api/auth-interceptor';

/**
 * Auth guard for protected routes
 * ใช้ใน load function ของ +layout.ts หรือ +page.ts
 * จะตรวจสอบ authentication และพยายาม refresh token ถ้าหมดอายุ
 * คล้ายกับ authHandler ใน SSR version (hooks.server.ts)
 *
 * @example
 * // src/routes/dashboard/+layout.ts
 * import { requireAuth } from '$lib/guards/auth';
 *
 * export const load = async () => {
 *   await requireAuth();
 *   return {};
 * };
 */
export async function requireAuth() {
	console.log('[Auth Guard] requireAuth called, browser:', browser);
	if (!browser) return;

	// ✅ รอให้ auth store โหลดจาก storage ก่อน
	console.log('[Auth Guard] Waiting for auth store initialization...');
	authStore.ensureInitialized();
	console.log('[Auth Guard] Auth store initialized, state:', {
		isAuthenticated: authStore.isAuthenticated,
		hasAccessToken: !!authStore.accessToken,
		// [CapacitorJS] Uncomment for mobile app
		// hasRefreshToken: !!authStore.refreshToken,
		expiresAt: authStore.expiresAt
	});

	if (!authStore.isAuthenticated) {
		console.log('[Auth Guard] ❌ Not authenticated, redirecting to /login');
		throw redirect(302, '/login');
	}

	// เช็ค access token expired
	const accessTokenExpired = authStore.isTokenExpired(60); // buffer 60 seconds
	// [CapacitorJS] Uncomment for mobile app
	// const refreshTokenExpired = authStore.isRefreshTokenExpired(60); // buffer 60 seconds

	console.log('[Auth Guard] Token status:', {
		accessTokenExpired
		// [CapacitorJS] Uncomment for mobile app
		// refreshTokenExpired
	});

	if (accessTokenExpired) {
		console.log('[Auth Guard] ⚠️ Access token is expired, attempting to refresh...');

		// [Web] Use httpOnly cookie - browser sends cookie automatically
		console.log('[Auth Guard] Attempting to refresh using httpOnly cookie...');

		// [CapacitorJS] Uncomment for mobile app - check refresh token before attempting refresh
		// if (refreshTokenExpired) {
		// 	console.log('[Auth Guard] ❌ Both access & refresh tokens expired, redirecting to login');
		// 	authStore.logout();
		// 	throw redirect(302, '/login');
		// }
		// console.log('[Auth Guard] Refresh token still valid, attempting to refresh...');

		const refreshed = await ensureValidToken();
		console.log('[Auth Guard] Refresh result:', refreshed);

		if (!refreshed) {
			console.log('[Auth Guard] ❌ Refresh failed, redirecting to login');
			throw redirect(302, '/login');
		}
		console.log('[Auth Guard] ✅ Token refreshed successfully');
	} else {
		console.log('[Auth Guard] ✅ Access token is still valid');
	}
}

/**
 * Redirect to home if already authenticated
 * ใช้สำหรับหน้า login/register เพื่อป้องกันการเข้าถึงเมื่อ login แล้ว
 *
 * @example
 * // src/routes/login/+page.ts
 * import { redirectIfAuthenticated } from '$lib/guards/auth';
 *
 * export const load = async () => {
 *   await redirectIfAuthenticated();
 *   return {};
 * };
 */
export async function redirectIfAuthenticated(redirectTo = '/') {
	console.log('[Auth Guard] redirectIfAuthenticated called, browser:', browser);
	if (!browser) return;

	// ✅ รอให้ auth store โหลดจาก storage ก่อน
	console.log('[Auth Guard] Waiting for auth store initialization...');
	await authStore.ensureInitialized();

	const isAuth = authStore.isAuthenticated;
	const isExpired = authStore.isTokenExpired();
	console.log('[Auth Guard] redirectIfAuthenticated check:', {
		isAuthenticated: isAuth,
		isTokenExpired: isExpired,
		shouldRedirect: isAuth && !isExpired
	});

	if (isAuth && !isExpired) {
		console.log('[Auth Guard] ➡️ Already authenticated, redirecting to:', redirectTo);
		throw redirect(302, redirectTo);
	}
	console.log('[Auth Guard] Not redirecting (not authenticated or token expired)');
}
