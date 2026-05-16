import jwt from 'jsonwebtoken';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ cookies }) => {
	const accessToken = cookies.get('access_token');
	const payload = accessToken
		? (jwt.decode(accessToken) as { sub?: string } | null)
		: null;
	return { user: { username: payload?.sub ?? 'User' } };
};
