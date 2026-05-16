/** Add new codemods here in chronological order whenever a template bug is fixed. */
export const codemods = [
// Example — uncomment and adapt when a real fix is needed:
// {
// 	from: '0.1.0',
// 	to: '0.1.1',
// 	transforms: [
// 		{
// 			file: 'src/lib/auth.ts',
// 			transform: (content) =>
// 				content.replaceAll("cookies.set('refreshToken'", "cookies.set('refresh_token'"),
// 		},
// 	],
// },
];
function parseVersion(v) {
    const [major = 0, minor = 0, patch = 0] = v.split('.').map(Number);
    return [major, minor, patch];
}
function versionGt(a, b) {
    const [aMaj, aMin, aPat] = parseVersion(a);
    const [bMaj, bMin, bPat] = parseVersion(b);
    if (aMaj !== bMaj)
        return aMaj > bMaj;
    if (aMin !== bMin)
        return aMin > bMin;
    return aPat > bPat;
}
/** Returns codemods that need to run to go from `currentVersion` to `targetVersion`. */
export function getApplicableCodemods(currentVersion, targetVersion) {
    return codemods.filter((c) => versionGt(c.to, currentVersion) && !versionGt(c.to, targetVersion));
}
