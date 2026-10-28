declare const _default: {
    from: string;
    to: string;
    transforms: ({
        ssrMode?: undefined;
        file: string;
        create: true;
        template: "spa";
        transform: (content: string) => import("./index.js").TransformResult;
    } | {
        file: string;
        create: true;
        template: "ssr";
        ssrMode: "fullstack";
        transform: (content: string) => import("./index.js").TransformResult;
    } | {
        file: string;
        create: true;
        template: "ssr";
        ssrMode: "fastapi";
        transform: (content: string) => import("./index.js").TransformResult;
    } | {
        ssrMode?: undefined;
        create?: undefined;
        file: string;
        template: "spa";
        transform: (content: string) => import("./index.js").TransformResult;
    } | {
        create?: undefined;
        file: string;
        template: "ssr";
        ssrMode: "fullstack";
        transform: (content: string) => import("./index.js").TransformResult;
    } | {
        create?: undefined;
        file: string;
        template: "ssr";
        ssrMode: "fastapi";
        transform: (content: string) => import("./index.js").TransformResult;
    } | {
        ssrMode?: undefined;
        template?: undefined;
        create?: undefined;
        file: string;
        transform: (content: string) => import("./index.js").TransformResult;
    })[];
};
export default _default;
