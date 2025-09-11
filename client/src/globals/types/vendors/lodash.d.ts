import 'lodash';

declare module 'lodash' {
    export type DebouncedMethod<C, M> = DebouncedFunc<InstanceType<C>[M]>;

    interface LoDashStatic {
        isPlainObject(value?: any): value is Record<string, any>;
    }
}
