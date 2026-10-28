export function isProtectedRoute(path: string | null): boolean {
	if (!path) return false;
	return path.split('/').includes('(protected)');
}
