import { replaceText } from './helpers.js';
// 1.1.1: new items get a UUID v4 id instead of 7 predictable Math.random characters.
const codemod = {
    from: '1.1.0',
    to: '1.1.1',
    transforms: [
        {
            file: 'src/lib/features/items/server.ts',
            template: 'ssr',
            ssrMode: 'fullstack',
            transform: replaceText('\tconst id = Math.random().toString(36).substring(2, 9);\n', '\tconst id = crypto.randomUUID();\n'),
        },
    ],
};
export default codemod;
