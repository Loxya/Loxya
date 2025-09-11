import 'vue';

declare module 'vue' {
    import type { markRaw } from 'vue';
    import type {
        DefaultData,
        DefaultProps,
        DefaultComputed,
        DefaultMethods,
    } from 'vue/types/options';

    // eslint-disable-next-line @typescript-eslint/no-restricted-types
    export type Raw<T extends object> = ReturnType<typeof markRaw<T>>;

    export type ComponentRef<T extends abstract new (...args: any) => any = RawComponent> = (
        | InstanceType<T>
        | undefined
    );

    export type RawComponent<Props = DefaultProps, Methods = DefaultMethods<never>> = (
        Component<DefaultData<never>, Methods, DefaultComputed, Props>
    );

    //
    // - HTML Attributes
    //

    export interface InputHTMLAttributes {
        onChange?(payload: InputEvent): void;
        onInput?(payload: InputEvent): void;
    }

    export interface FormHTMLAttributes {
        onSubmit?(payload: SubmitEvent): void;
    }
}
