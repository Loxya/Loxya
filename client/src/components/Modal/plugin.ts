import invariant from 'invariant';
import ModalContainer from './Container';

import type Vue from 'vue';
import type { PluginObject, RawComponent } from 'vue';
import type {
    ModalProps,
    ModalComponent,
    ModalComponentProps,
} from './_types';

/** Api exposée par le plugin dans la propriété `$modal` de Vue. */
export interface ModalApi {
    /**
     * Affiche une modale contenant le composant fourni.
     *
     * @param component - Composant Vue à monter dans la modale.
     * @param props - Props du composant + Éventuels handlers du cycle de vie de la modale.
     *
     * @returns Une promesse résolue avec les données passées à la fermeture.
     *          (ou `undefined` si la modale a été fermée prématurément)
     */
    show<
        InnerProps extends Record<string, any> = ModalComponentProps,
        Data = InnerProps extends { onClose?(data?: infer D): void } ? D : any,
    >(
        component: ModalComponent<Data, InnerProps>,
        props?: ModalProps<Data, InnerProps>,
    ): Promise<Data | undefined>;

    /**
     * Ferme immédiatement toutes les modales ouvertes.
     *
     * Les promesses associées sont résolues avec `undefined`.
     */
    clear(): void;
}

/**
 * Factory de création d'un plugin Vue qui expose une API
 * `$modal` permettant d'afficher des fenêtres modales.
 *
 * @param modalComponent - Le composant Vue à utiliser pour le rendering de la fenêtre modale.
 *
 * @returns Le plugin Vue.
 */
const createModalPlugin = (modalComponent: RawComponent): PluginObject<RawComponent> => ({
    install(VueInstance) {
        if (VueInstance.prototype.$modal !== undefined) {
            return;
        }

        let container: InstanceType<typeof ModalContainer> | null = null;
        const ensureContainer = (root: Vue): InstanceType<typeof ModalContainer> => {
            if (container !== null) {
                return container;
            }

            const wrapper = new VueInstance({
                parent: root,
                render: (h) => (
                    h(ModalContainer, {
                        props: { component: modalComponent },
                    })
                ),
            });
            wrapper.$mount();

            document.body.appendChild(wrapper.$el);
            container = wrapper.$children[0] as unknown as InstanceType<typeof ModalContainer>;

            return container;
        };

        const pluginInstance: ModalApi = {
            show: <
                InnerProps extends Record<string, any> = ModalComponentProps,
                Data = InnerProps extends { onClose?(data?: infer D): void } ? D : any,
            >(
                component: ModalComponent<Data, InnerProps>,
                props: ModalProps<Data, InnerProps> = {} as ModalProps<Data, InnerProps>,
            ): Promise<Data | undefined> => {
                invariant(container !== null, '[$modal.show] No mounted container.');
                return container.push(component, props);
            },
            clear: () => {
                container?.clear();
            },
        };

        Object.defineProperty(VueInstance.prototype, '$modal', {
            get(this: Vue): ModalApi {
                if (this instanceof VueInstance) {
                    ensureContainer(this.$root);
                }
                return pluginInstance;
            },
        });
    },
});

export default createModalPlugin;
