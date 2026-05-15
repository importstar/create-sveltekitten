import { authStore } from '$lib/stores/auth.svelte';
import { PUBLIC_API_URL } from '$env/static/public';
import type { components } from './openapi';
import client from './client';

// Singleton state for token refresh coordination
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let refreshSubscribers: Array<(token: string | null) => void> = [];

/**
 * Subscribe to token refresh completion
 */
function subscribeToRefresh(callback: (token: string | null) => void) {
	refreshSubscribers.push(callback);
}

/**
 * Notify all subscribers that refresh is complete
 */
function notifyRefreshComplete(token: string | null) {
	refreshSubscribers.forEach((callback) => callback(token));
	refreshSubscribers = [];
}

/**
 * Check if currently refreshing token
 */
export function isCurrentlyRefreshing(): boolean {
	return isRefreshing;
}

/**
 * Wait for ongoing token refresh to complete
 */
export function waitForRefresh(): Promise<string | null> {
	return new Promise((resolve) => {
		subscribeToRefresh(resolve);
	});
}

/**
 * Refresh access token using refresh token
 * ไม่ควร redirect ใน utility function - ให้ caller (guard) จัดการแทน
 */
export async function refreshAccessToken(): Promise<boolean> {
	// ถ้ากำลัง refresh อยู่แล้ว ให้รอ promise เดิม
	if (isRefreshing && refreshPromise) {
		console.log('[Token Refresh] Already refreshing, waiting for existing promise...');
		return refreshPromise;
	}

	// [CapacitorJS] Uncomment for mobile app that stores refresh token locally
	// if (!authStore.refreshToken) {
	// 	console.warn('[Token Refresh] ❌ No refresh token available');
	// 	return false;
	// }

	isRefreshing = true;
	refreshPromise = (async () => {
		try {
			console.log('[Token Refresh] Starting... (using httpOnly cookie)');

			// [CapacitorJS] Uncomment for mobile app - use Authorization header with stored refresh token
			// const response = await fetch(`${PUBLIC_API_URL}/v1/auth/refresh_token`, {
			// 	method: 'GET',
			// 	headers: {
			// 		Authorization: `Bearer ${authStore.refreshToken}`,
			// 		accept: 'application/json'
			// 	}
			// });

			// [Web] Use httpOnly cookie - browser sends cookie automatically
			const { data, error, response } = await client.GET('/v1/auth/refresh_token', {
				credentials: 'include'
			});

			console.log('[Token Refresh] Response status:', response.status);

			if (!response.ok) {
				console.error('[Token Refresh] ❌ Failed with status:', response.status, 'Body:', error);

				// ไม่ redirect ที่นี่ ให้ caller จัดการ
				notifyRefreshComplete(null);
				return false;
			}

			if (!data) {
				console.error('[Token Refresh] ❌ No data received');
				notifyRefreshComplete(null);
				return false;
			}

			// API คืน GetAccessTokenResponse { access_token, token_type }
			type GetAccessTokenResponse = components['schemas']['GetAccessTokenResponse'];
			// const data: GetAccessTokenResponse = await response.json();

			console.log('[Token Refresh] ✓ Received new token:', {
				accessToken: data.access_token ? `${data.access_token.substring(0, 20)}...` : 'none',
				tokenType: data.token_type
			});

			// Update แค่ access token (ไม่มี refresh_token ใหม่)
			authStore.updateAccessToken(data.access_token, data.token_type);
			console.log('[Token Refresh] ✓ Successfully updated auth store');

			// Notify all waiting requests
			notifyRefreshComplete(data.access_token);
			return true;
		} catch (error) {
			console.error('[Token Refresh] ✗ Error:', error);
			notifyRefreshComplete(null);

			// ไม่ redirect ที่นี่ ให้ caller จัดการ
			return false;
		} finally {
			isRefreshing = false;
			refreshPromise = null;
		}
	})();

	return refreshPromise;
}

/**
 * Wrapper function to automatically handle 401 errors and retry with refreshed token
 */
export async function fetchWithAuth<T>(
	fetcher: () => Promise<{ data?: T; error?: unknown }>,
	retry = true
): Promise<{ data?: T; error?: unknown }> {
	const result = await fetcher();

	// ถ้าได้ 401 และยังสามารถ retry ได้
	if (
		result.error &&
		typeof result.error === 'object' &&
		'status' in result.error &&
		result.error.status === 401 &&
		retry
	) {
		const refreshed = await refreshAccessToken();
		if (refreshed) {
			// ลองเรียก API อีกครั้งหลัง refresh token
			return fetchWithAuth(fetcher, false);
		}
	}

	return result;
}

/**
 * Check and refresh token if needed before making requests
 * สำหรับ testing: bufferTime = 540 seconds (9 นาที) → refresh หลัง 1 นาที
 */
export async function ensureValidToken(): Promise<boolean> {
	console.log('[ensureValidToken] Called');

	// รอให้ auth store โหลดข้อมูลจาก storage ก่อน
	await authStore.ensureInitialized();

	console.log('[ensureValidToken] After ensureInitialized:', {
		isAuthenticated: authStore.isAuthenticated,
		hasAccessToken: !!authStore.accessToken
		// [CapacitorJS] Uncomment for mobile app
		// hasRefreshToken: !!authStore.refreshToken
	});

	if (!authStore.isAuthenticated) {
		console.log('[ensureValidToken] ❌ Not authenticated, returning false');
		return false;
	}

	// [CapacitorJS] Uncomment for mobile app - check refresh token expiry before attempting refresh
	// const refreshTokenExpired = authStore.isRefreshTokenExpired(60);
	// console.log('[ensureValidToken] Refresh token status:', {
	// 	expired: refreshTokenExpired,
	// 	hasRefreshToken: !!authStore.refreshToken
	// });
	// if (refreshTokenExpired) {
	// 	console.log('[ensureValidToken] ❌ Refresh token expired, cannot refresh');
	// 	return false;
	// }

	// ถ้า access token หมดอายุแล้ว หรือใกล้จะหมดอายุ (bufferTime = 540 seconds = 9 นาที) ให้ refresh
	// นั่นคือ refresh หลังจาก login ไป 1 นาที
	const expiringSoon = authStore.isTokenExpiringSoon(540); // 540 seconds = 9 minutes
	console.log('[ensureValidToken] Access token status:', {
		expiringSoon,
		bufferTime: 540
	});

	if (expiringSoon) {
		console.log('[ensureValidToken] ⚠️ Token expiring soon, attempting refresh...');
		const result = await refreshAccessToken();
		console.log('[ensureValidToken] refreshAccessToken result:', result);
		return result;
	}

	console.log('[ensureValidToken] ✅ Token is valid, returning true');
	return true;
}
