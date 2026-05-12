import 'vue';

import type Requester from '@/utils/requester';
import type { ModalApi } from '@/components/Modal/plugin';
import type { ComponentPublicInstance, ExtractDefaultPropTypes, InjectionKey, markRaw } from 'vue';
import type { ComponentOptionsBase, MethodOptions } from 'vue/types/v3-component-options';

declare module 'vue' {
    // eslint-disable-next-line @typescript-eslint/no-restricted-types
    export type Raw<T extends object> = ReturnType<typeof markRaw<T>>;

    /** Récupère le type de la valeur injectée depuis une {@link InjectionKey}. */
    export type Injected<K> = K extends InjectionKey<infer T> ? T : never;

    export type ComponentRef<T extends abstract new (...args: any) => any = RawComponent> = (
        | InstanceType<T>
        | undefined
    );

    export type RawComponent<
        Props extends Record<string, any> = Record<string, any>,
        Methods extends MethodOptions = Record<string, any>,
    > = (
        & Omit<
            ComponentOptionsBase<
                Props,
                Record<string, any>,
                Record<string, any>,
                Record<string, any>,
                Methods,
                Record<string, any>,
                Record<string, any>,
                Record<string, any>,
                string,
                ExtractDefaultPropTypes<Props>
            >,
            'methods'
        >
        & (new () => ComponentPublicInstance<
            Props,
            Record<string, any>,
            Record<string, any>,
            Record<string, any>,
            Methods,
            any[]
        >)
        & { methods?: Methods }
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

    export interface HTMLAttributes {
        domPropsInnerHTML?: string;
    }
}

declare module 'vue/types/vue' {
    interface Vue {
        $http: Requester;
        $modal: ModalApi;
    }
}
