// API Client Factory
import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';
import { ApiError } from '$lib/utils/api-core';

type ApiClientConfig = {
	fetchInstance: typeof fetch;
	baseUrl?: string;
	cookies?: Cookies;
};

export interface ApiClient {
	get: <T>(endpoint: string, options?: RequestInit) => Promise<T>;
	post: <T>(endpoint: string, body: unknown, options?: RequestInit) => Promise<T>;
	put: <T>(endpoint: string, body: unknown, options?: RequestInit) => Promise<T>;
	delete: <T>(endpoint: string, options?: RequestInit) => Promise<T>;
}

export function createApiClient({ fetchInstance, baseUrl }: ApiClientConfig): ApiClient {
	async function coreFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
		// สร้าง URL สำหรับเรียก API
		const url = `${baseUrl ?? ''}${endpoint}`;

		// กำหนดค่า headers เริ่มต้น
		const defaultHeaders: Record<string, string> = {
			'Content-Type': 'application/json',
			Accept: 'application/json'
		};

		const mergedOptions: RequestInit = {
			...options,
			headers: {
				...defaultHeaders,
				...options.headers
			}
		};

		// ถ้า body เป็น object ให้แปลงเป็น JSON string
		if (
			mergedOptions.body &&
			typeof mergedOptions.body === 'object' &&
			!(mergedOptions.body instanceof Blob) &&
			!(mergedOptions.body instanceof FormData)
		) {
			mergedOptions.body = JSON.stringify(mergedOptions.body);
		}

		if (dev) {
			console.log(`[API] => ${mergedOptions.method || 'GET'} ${url}`);
		}

		try {
			const response = await fetchInstance(url, mergedOptions);
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({
					message: 'Server did not return a valid JSON error response.'
				}));

				const error = new ApiError(
					`HTTP Error: ${response.status} ${response.statusText}`,
					response.status,
					errorData
				);

				if (dev) {
					console.error(`[API Error] ${error.status}:`, error.data);
				}

				throw error;
			}

			// จัดการกรณี 204 No Content
			if (response.status === 204) {
				return null as T;
			}

			return (await response.json()) as T;
		} catch (error) {
			// ส่งต่อ error ที่เป็น ApiError ของเราออกไปเลย
			if (error instanceof ApiError) {
				throw error;
			}
			// ถ้าเป็น error อื่น (เช่น network error) ให้ log และโยนเป็น error ทั่วไป
			console.error('[API] Network or unexpected error:', error);
			throw new Error('A network or unexpected error occurred.');
		}
	}

	// คืนค่า API client ที่มี method สำหรับเรียก API
	return {
		get: <T>(endpoint: string, options?: RequestInit) =>
			coreFetch<T>(endpoint, { ...options, method: 'GET' }),
		post: <T>(endpoint: string, body: unknown, options?: RequestInit) =>
			coreFetch<T>(endpoint, { ...options, method: 'POST', body: body as BodyInit }),
		put: <T>(endpoint: string, body: unknown, options?: RequestInit) =>
			coreFetch<T>(endpoint, { ...options, method: 'PUT', body: body as BodyInit }),
		delete: <T>(endpoint: string, options?: RequestInit) =>
			coreFetch<T>(endpoint, { ...options, method: 'DELETE' })
	};
}
