import { defineComponent } from 'vue';
import { dimensionToCss } from './_utils';

import type { PropType } from 'vue';

type Props = {
    /**
     * Largeur de la modale (pixels ou pourcentage).
     *
     * @default 950
     */
    width?: number | `${number}%`,

    /**
     * Hauteur de la modale.
     *
     * @default 'auto'
     */
    height?: number | `${number}%` | 'auto',

    /**
     * Permet de faire en sorte que la modale occupe la quasi entièreté
     * de l'écran sur mobile (avec simplement une petite marge autour).
     *
     * @default false
     */
    fillOnMobile?: boolean,

    /**
     * Autorise l'utilisateur à fermer la modale via un clic sur
     * l'overlay ou la touche "Échap".
     *
     * @default true
     */
    dismissible?: boolean,

    /**
     * La modale est-elle en cours de fermeture ?
     *
     * @default false
     */
    closing?: boolean,

    /**
     * Profondeur de la modale dans la pile.
     *
     * Utilisée pour calculer son `z-index` afin que les modales
     * empilées s'affichent dans le bon ordre.
     *
     * @default 0
     */
    layer?: number,

    /**
     * Indique si la modale est au sommet de la pile.
     *
     * Une modale qui ne l'est pas est rendue inactive (pas d'interactions
     * possibles) afin que seule la modale du dessus reste manipulable.
     *
     * @default true
     */
    topmost?: boolean,
};

type Data = {
    isShown: boolean,
};

type InstanceProperties = {
    overlayPressTarget: EventTarget | null,
};

/** Une fenêtre modale. */
const Modal = defineComponent({
    name: 'Modal',
    props: {
        width: {
            type: [Number, String] as PropType<Required<Props>['width']>,
            default: 950,
        },
        height: {
            type: [Number, String] as PropType<Required<Props>['height']>,
            default: 'auto',
        },
        fillOnMobile: {
            type: Boolean as PropType<Required<Props>['fillOnMobile']>,
            default: false,
        },
        dismissible: {
            type: Boolean as PropType<Required<Props>['dismissible']>,
            default: true,
        },
        closing: {
            type: Boolean as PropType<Required<Props>['closing']>,
            default: false,
        },
        layer: {
            type: Number as PropType<Required<Props>['layer']>,
            default: 0,
        },
        topmost: {
            type: Boolean as PropType<Required<Props>['topmost']>,
            default: true,
        },
    },
    emits: ['open', 'opened', 'closeRequest', 'closed'],
    setup: (): InstanceProperties => ({
        overlayPressTarget: null,
    }),
    data: (): Data => ({
        isShown: true,
    }),
    computed: {
        isFullscreen(): boolean {
            return (
                this.width === '100%' &&
                this.height === '100%'
            );
        },
    },
    watch: {
        closing(closing: boolean) {
            if (closing) {
                this.isShown = false;
            }
        },
    },
    created() {
        // - Binding.
        this.handleKeyUp = this.handleKeyUp.bind(this);
    },
    mounted() {
        // - Retire le focus de l'élément qui l'avait
        //   avant l'ouverture de  la modale.
        const $active = document.activeElement;
        if (
            $active instanceof HTMLElement &&
            $active !== document.body &&
            !this.$el.contains($active)
        ) {
            $active.blur();
        }

        // - Événements globaux.
        document.addEventListener('keyup', this.handleKeyUp);
    },
    beforeDestroy() {
        // - Événements globaux.
        document.removeEventListener('keyup', this.handleKeyUp);
    },
    methods: {
        handleKeyUp(event: KeyboardEvent) {
            if (!this.dismissible || !this.topmost) {
                return;
            }

            if (event.key === 'Escape' && this.isShown) {
                this.$emit('closeRequest');
            }
        },

        handleOverlayPress(event: MouseEvent | TouchEvent) {
            this.overlayPressTarget = event.target;
        },

        handleOverlayClick(event: MouseEvent) {
            if (!this.dismissible || !this.topmost) {
                return;
            }

            // - Le clic ferme la modale uniquement si l'appui initial avait
            //   eu lieu sur l'overlay (et pas sur un descendant).
            const hasPressedOverlay = this.overlayPressTarget === event.currentTarget;
            this.overlayPressTarget = null;

            if (hasPressedOverlay) {
                this.$emit('closeRequest');
            }
        },

        handleOpen() {
            this.$emit('open');
        },

        handleOpened() {
            this.$emit('opened');
        },

        handleClosed() {
            this.$emit('closed');
        },
    },
    render() {
        const children = this.$slots.default;
        const {
            layer,
            width,
            height,
            topmost,
            isShown,
            isFullscreen,
            fillOnMobile,
            handleOpen,
            handleOpened,
            handleClosed,
            handleOverlayPress,
            handleOverlayClick,
        } = this;

        const classNames = ['Modal', {
            'Modal--in-background': !topmost,
            'Modal--fullscreen': isFullscreen,
        }];

        return (
            <div class={classNames} style={{ '--Modal--layer': layer }}>
                <transition
                    enterClass="Modal__overlay--enter"
                    enterActiveClass="Modal__overlay--entering"
                    enterToClass="Modal__overlay--entered"
                    leaveClass="Modal__overlay--leave"
                    leaveActiveClass="Modal__overlay--leaving"
                    leaveToClass="Modal__overlay--leaved"
                    appear
                >
                    {isShown && (
                        <div
                            class="Modal__overlay"
                            onMousedown={handleOverlayPress}
                            onTouchstart={handleOverlayPress}
                            onClick={handleOverlayClick}
                        />
                    )}
                </transition>
                <transition
                    enterClass="Modal__body--enter"
                    enterActiveClass="Modal__body--entering"
                    enterToClass="Modal__body--entered"
                    leaveClass="Modal__body--leave"
                    leaveActiveClass="Modal__body--leaving"
                    leaveToClass="Modal__body--leaved"
                    onBeforeEnter={handleOpen}
                    onAfterEnter={handleOpened}
                    onAfterLeave={handleClosed}
                    appear
                >
                    {isShown && (
                        <div
                            ref="body"
                            role="dialog"
                            aria-modal="true"
                            class={['Modal__body', {
                                'Modal__body--fullscreen': isFullscreen,
                                'Modal__body--fill-on-mobile': fillOnMobile,
                            }]}
                            style={{
                                width: dimensionToCss(width),
                                height: dimensionToCss(height),
                            }}
                        >
                            {children}
                        </div>
                    )}
                </transition>
            </div>
        );
    },
});

export default Modal;
