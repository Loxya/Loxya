import omit from 'lodash/omit';
import { cloneDeep } from 'lodash';
import { defineComponent, markRaw } from 'vue';
import generateUniqueId from 'lodash/uniqueId';
import { lockBodyScroll } from './_utils';

import type { PropType, RawComponent } from 'vue';
import type {
    ModalProps,
    ModalOptions,
    ModalComponent,
    ModalCloseEvent,
    ModalComponentProps,
    ModalLifecycleProps,
} from './_types';

/** Les données d'une modale dans la pile d'affichage. */
export type ModalEntry<D = any> = {
    /** Identifiant interne unique. */
    id: string,

    /** Composant à monter dans la modale. */
    component: RawComponent,

    /** Props passées au composant à monter dans la modale. */
    componentProps: Record<string, any>,

    /** Options statiques de la modale (`width`, `dismissible`, etc.). */
    modalOptions: ModalOptions,

    /** Handlers optionnels de cycle de vie fournis par l'appelant. */
    lifecycle: ModalLifecycleProps<D>,

    /** Fonction permettant de résoudre la promesse de la modale. */
    resolve(value: D | undefined): void,

    /** La modale est-elle en cours de fermeture ? */
    isClosing: boolean,
};

type Props = {
    /** Composant `Modal` à utiliser pour wrapper chaque entrée. */
    component: RawComponent,
};

type Data = {
    stack: ModalEntry[],
};

type InstanceProperties = {
    releaseBodyScrollLock: (() => void) | undefined,
};

/** Conteneur des fenêtres modales. */
const ModalContainer = defineComponent({
    name: 'ModalContainer',
    props: {
        component: {
            type: Object as PropType<Props['component']>,
            required: true,
        },
    },
    setup: (): InstanceProperties => ({
        releaseBodyScrollLock: undefined,
    }),
    data: (): Data => ({
        stack: [],
    }),
    watch: {
        // - Bloque le scroll du body tant qu'au moins une modale est ouverte.
        'stack.length': function(newLength: number, oldLength: number) {
            if (newLength > 0 && oldLength === 0) {
                this.releaseBodyScrollLock = lockBodyScroll();
            } else if (newLength === 0 && oldLength > 0) {
                this.releaseBodyScrollLock?.();
                this.releaseBodyScrollLock = undefined;
            }
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleOpen(entry: ModalEntry) {
            entry.lifecycle.onOpen?.();
        },

        handleOpened(entry: ModalEntry) {
            entry.lifecycle.onOpened?.();
        },

        handleCloseRequest(entry: ModalEntry, data?: any) {
            if (entry.isClosing) {
                return;
            }

            let cancelled = false;
            const event: ModalCloseEvent = {
                data,
                cancel: () => { cancelled = true; },
            };
            entry.lifecycle.onClose?.(event);
            if (cancelled) {
                return;
            }
            entry.isClosing = true;

            entry.resolve(data);
        },

        handleClosed(entry: ModalEntry) {
            entry.lifecycle.onClosed?.();

            const index = this.stack.findIndex((
                (_entry: ModalEntry) => _entry.id === entry.id
            ));
            if (index !== -1) {
                this.stack.splice(index, 1);
            }
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Ajoute une nouvelle modale à la pile.
         *
         * @param component - Composant Vue à monter dans la modale.
         * @param props - Props du composant + handlers de cycle de vie.
         *
         * @returns Une promesse résolue avec les données passées à la fermeture.
         */
        push<D = any>(
            component: ModalComponent<D, any>,
            props: ModalProps<D, ModalComponentProps<D>>,
        ): Promise<D | undefined> {
            const lifecycle: ModalLifecycleProps<D> = {
                onOpen: props.onOpen,
                onOpened: props.onOpened,
                onClose: props.onClose,
                onClosed: props.onClosed,
            };
            const componentProps = omit(props, Object.keys(lifecycle));
            const modalOptions: ModalOptions = cloneDeep(component.modal ?? {});

            const deferred = Promise.withResolvers<D | undefined>();
            this.stack.push({
                id: generateUniqueId('Modal-'),
                component: markRaw(component),
                componentProps,
                modalOptions,
                lifecycle,
                resolve: deferred.resolve,
                isClosing: false,
            });
            return deferred.promise;
        },

        /**
         * Ferme immédiatement toutes les modales.
         *
         * Les promesses associées sont résolues avec `undefined`.
         */
        clear(): void {
            this.stack.forEach((entry: ModalEntry) => {
                entry.resolve(undefined);
                entry.lifecycle.onClosed?.();
            });
            this.stack = [];
        },
    },
    render() {
        const { stack, component: ModalWrapper } = this;
        const lastIndex = stack.length - 1;

        return (
            <div class="ModalContainer">
                {stack.map((entry: ModalEntry, index: number) => {
                    const ContentComponent = entry.component;

                    const modalProps: any = {
                        ...entry.modalOptions,
                        layer: index,
                        closing: entry.isClosing,
                        topmost: index === lastIndex,
                    };
                    const modalListeners = {
                        open: () => { this.handleOpen(entry); },
                        opened: () => { this.handleOpened(entry); },
                        closeRequest: () => { this.handleCloseRequest(entry); },
                        closed: () => { this.handleClosed(entry); },
                    };
                    const innerListeners = {
                        ...this.$listeners,
                        close: (data: any) => { this.handleCloseRequest(entry, data); },
                    };

                    return (
                        <ModalWrapper
                            key={entry.id}
                            {...{ props: modalProps, on: modalListeners }}
                        >
                            <ContentComponent
                                {...{ props: entry.componentProps, on: innerListeners }}
                            />
                        </ModalWrapper>
                    );
                })}
            </div>
        );
    },
});

export default ModalContainer;
