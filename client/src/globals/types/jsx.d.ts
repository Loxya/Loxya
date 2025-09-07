import type { VNode as VNodeCore } from 'vue';
import type { ScopedSlot } from 'vue/types/vnode';

declare global {
    namespace JSX {
        type Node = (
            | VNodeCore
            | string
            | number
            | null
            | undefined
            | Node[]
        );

        type NodeClass = (
            | string
            | number
            | null
            | undefined
            | boolean
            | Record<string, boolean>
            | NodeClass[]
        );

        interface IntrinsicAttributes {
            'scopedSlots'?: Record<string, ScopedSlot | undefined>;

            /**
             * @deprecated Cette prop. n'est pas correctement typée par Vue et
             *             change de manière drastique (et indésirable ...) en Vue 3.
             *             Utilisez plutôt la paire `value` + `onInput`.
             */
            'v-model'?: any;
        }
    }
}
