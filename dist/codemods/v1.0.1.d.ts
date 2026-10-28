declare const _default: {
    from: string;
    to: string;
    transforms: ({
        file: string;
        transform: (content: string) => import("./index.js").TransformResult;
        ssrMode?: undefined;
        template?: undefined;
    } | {
        file: string;
        template: "ssr";
        ssrMode: "fullstack";
        transform: (content: string) => import("./index.js").TransformResult;
    } | {
        file: string;
        template: "ssr";
        ssrMode: "fastapi";
        transform: (content: string) => import("./index.js").TransformResult;
    } | {
        ssrMode?: undefined;
        file: string;
        template: "spa";
        transform: (content: string) => import("./index.js").TransformResult;
    } | {
        ssrMode?: undefined;
        file: string;
        template: "ssr";
        transform: (content: string) => import("./index.js").TransformResult;
    })[];
};
export default _default;
