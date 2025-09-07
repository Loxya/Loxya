//
// - SCSS
//

declare module '*.scss';

//
// - Yml
//

declare module '*.yml' {
    const data: Record<string, any>;
    export default data;
}

declare module '*.yaml' {
    const data: Record<string, any>;
    export default data;
}

//
// - SVG
//

// @see https://www.npmjs.com/package/vue-cli-plugin-svg
declare module '*.svg?inline' {
    const component: any;
    export default component;
}

declare module '*.svg' {
    const src: string;
    export default src;
}

//
// - Images
//

declare module '*.png' {
    const src: string;
    export default src;
}

declare module '*.bmp' {
    const src: string;
    export default src;
}

declare module '*.jpg' {
    const src: string;
    export default src;
}

declare module '*.jpeg' {
    const src: string;
    export default src;
}

declare module '*.gif' {
    const src: string;
    export default src;
}

declare module '*.avif' {
    const src: string;
    export default src;
}

declare module '*.webp' {
    const src: string;
    export default src;
}
