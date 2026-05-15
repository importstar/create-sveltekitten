import { browser } from '$app/environment';
import type { components } from '$lib/api/openapi';

type Token = components['schemas']['Token'];
type User = components['schemas']['UserResponse'];

const AUTH_KEY = 'auth_state';

interface AuthState {
	user: User | null;
	accessToken: string | null;
	// [CapacitorJS] Uncomment for mobile app that stores refresh token locally
	// refreshToken: string | null;
	tokenType: string | null;
	expiresAt: string | null;
	isAuthenticated: boolean;
}

class AuthStore {
	private state = $state<AuthState>({
		user: null,
		accessToken: null,
		// [CapacitorJS] Uncomment for mobile app
		// refreshToken: null,
		tokenType: null,
		expiresAt: null,
		isAuthenticated: false
	});

	private initPromise: Promise<void> | null = null;
	private initialized = false;

	constructor() {
		if (browser) {
			this.loadFromStorage();
		}
	}

	/**
	 * Ensure auth store is initialized before use
	 */
	ensureInitialized() {
		console.log('[Auth Store] ensureInitialized called, initialized:', this.initialized);
		if (this.initialized) {
			console.log('[Auth Store] Already initialized, skipping');
			return;
		}
		// Since loadFromStorage is now synchronous, just mark as initialized
		this.initialized = true;
		console.log('[Auth Store] ensureInitialized complete');
	}

	get user() {
		return this.state.user;
	}
	get accessToken() {
		return this.state.accessToken;
	}
	// [CapacitorJS] Uncomment for mobile app
	// get refreshToken() {
	// 	return this.state.refreshToken;
	// }
	get tokenType() {
		return this.state.tokenType;
	}
	get expiresAt() {
		return this.state.expiresAt;
	}
	get isAuthenticated() {
		return this.state.isAuthenticated;
	}

	login(tokens: Token, user: User) {
		const now = new Date();
		console.log('[Auth Store] Login - Token info:', {
			expiresAt: tokens.expires_at,
			expiresIn: tokens.expires_in,
			issuedAt: tokens.issued_at,
			currentTime: now.toISOString(),
			currentTimeLocal: now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
		});

		this.state = {
			user,
			accessToken: tokens.access_token,
			// [CapacitorJS] Uncomment for mobile app
			// refreshToken: tokens.refresh_token,
			tokenType: tokens.token_type,
			expiresAt: tokens.expires_at,
			isAuthenticated: true
		};
		this.saveToStorage();
	}

	updateTokens(tokens: Token) {
		const now = new Date();
		console.log('[Auth Store] Token refresh - New token info:', {
			expiresAt: tokens.expires_at,
			expiresIn: tokens.expires_in,
			issuedAt: tokens.issued_at,
			currentTime: now.toISOString(),
			currentTimeLocal: now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
		});

		this.state.accessToken = tokens.access_token;
		// [CapacitorJS] Uncomment for mobile app
		// this.state.refreshToken = tokens.refresh_token;
		this.state.tokenType = tokens.token_type;
		this.state.expiresAt = tokens.expires_at;
		this.saveToStorage();
	}

	/**
	 * Update only access token (for refresh_token endpoint that returns GetAccessTokenResponse)
	 */
	updateAccessToken(accessToken: string, tokenType: string) {
		const now = new Date();
		console.log('[Auth Store] Access token refresh - New token info:', {
			accessToken: accessToken.substring(0, 20) + '...',
			tokenType,
			currentTime: now.toISOString(),
			currentTimeLocal: now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })
		});

		this.state.accessToken = accessToken;
		this.state.tokenType = tokenType;
		this.saveToStorage();
	}

	logout() {
		this.state = {
			user: null,
			accessToken: null,
			// [CapacitorJS] Uncomment for mobile app
			// refreshToken: null,
			tokenType: null,
			expiresAt: null,
			isAuthenticated: false
		};
		if (browser) {
			localStorage.removeItem(AUTH_KEY);
		}
	}

	/**
	 * Decode JWT payload (base64url decode)
	 * คล้ายกับ jwt.decode() ใน SSR version
	 */
	private decodeJwtPayload(token: string): { exp?: number; iat?: number; sub?: string } | null {
		try {
			const parts = token.split('.');
			if (parts.length !== 3 || !parts[1]) return null;

			// Base64url to Base64
			const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
			const payload = JSON.parse(atob(base64));
			return payload;
		} catch (e) {
			console.error('[Auth Store] Failed to decode JWT:', e);
			return null;
		}
	}

	/**
	 * Check if a JWT token is expired
	 * คล้ายกับ isTokenExpired() ใน SSR version (utils/auth.ts)
	 * @param token - JWT token string
	 * @param bufferTime - Buffer time in seconds before expiration (default: 60 = 1 minute)
	 */
	private isJwtExpired(token: string | null, bufferTime = 60): boolean {
		if (!token) return true;

		const payload = this.decodeJwtPayload(token);
		if (!payload?.exp) return true;

		// เหมือน SSR: Date.now() / 1000 >= exp - bufferTime
		const nowInSeconds = Date.now() / 1000;
		const isExpired = nowInSeconds >= payload.exp - bufferTime;

		console.log('[Auth Store] isJwtExpired check:', {
			token: token.substring(0, 20) + '...',
			exp: payload.exp,
			expDate: new Date(payload.exp * 1000).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
			nowInSeconds: Math.floor(nowInSeconds),
			nowDate: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
			bufferTime,
			secondsUntilExpiry: Math.floor(payload.exp - nowInSeconds),
			isExpired
		});

		return isExpired;
	}

	/**
	 * Check if access token is expired
	 * @param bufferTime - Buffer time in seconds (default: 60 = 1 minute)
	 */
	isTokenExpired(bufferTime = 60): boolean {
		return this.isJwtExpired(this.state.accessToken, bufferTime);
	}

	// [CapacitorJS] Uncomment for mobile app
	// /**
	//  * Check if refresh token is expired
	//  * @param bufferTime - Buffer time in seconds (default: 60 = 1 minute)
	//  */
	// isRefreshTokenExpired(bufferTime = 60): boolean {
	// 	return this.isJwtExpired(this.state.refreshToken, bufferTime);
	// }

	/**
	 * Check if access token is about to expire (within specified seconds)
	 * สำหรับ testing: bufferTime = 540 (9 นาที) → refresh หลัง 1 นาที
	 * @param bufferTime - Buffer time in seconds (default: 540 = 9 minutes for testing)
	 */
	isTokenExpiringSoon(bufferTime = 540): boolean {
		return this.isJwtExpired(this.state.accessToken, bufferTime);
	}

	private saveToStorage() {
		if (browser) {
			try {
				localStorage.setItem(AUTH_KEY, JSON.stringify(this.state));
				console.log('[Auth Store] Saved to localStorage');
			} catch (e) {
				console.error('[Auth Store] Failed to save to localStorage', e);
			}
		}
	}

	private loadFromStorage() {
		console.log('[Auth Store] loadFromStorage started...');
		try {
			const value = localStorage.getItem(AUTH_KEY);
			console.log(
				'[Auth Store] Raw value from localStorage:',
				value ? `${value.substring(0, 100)}...` : 'null'
			);
			if (value) {
				const parsed = JSON.parse(value);
				this.state = parsed;
				console.log('[Auth Store] ✓ Loaded from localStorage:', {
					hasUser: !!this.state.user,
					hasAccessToken: !!this.state.accessToken,
					// [CapacitorJS] Uncomment for mobile app
					// hasRefreshToken: !!this.state.refreshToken,
					isAuthenticated: this.state.isAuthenticated
				});

				// ตรวจสอบ token expiry หลังจากโหลด
				if (this.state.accessToken) {
					const accessExpired = this.isJwtExpired(this.state.accessToken, 0);
					// [CapacitorJS] Uncomment for mobile app
					// const refreshExpired = this.isJwtExpired(this.state.refreshToken, 0);
					console.log('[Auth Store] Token status on load:', {
						accessTokenExpired: accessExpired
						// [CapacitorJS] Uncomment for mobile app
						// refreshTokenExpired: refreshExpired
					});
				}
			} else {
				console.log('[Auth Store] No stored auth data found');
			}
		} catch (e) {
			console.error('[Auth Store] ✗ Failed to load from localStorage', e);
			localStorage.removeItem(AUTH_KEY);
		} finally {
			this.initialized = true;
			console.log('[Auth Store] loadFromStorage completed, initialized:', this.initialized);
		}
	}
}

export const authStore = new AuthStore();
