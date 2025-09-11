import './index.scss';
import { defineComponent } from 'vue';
import DateTime from '@/utils/datetime';
import ClickOutside from 'vue-click-outside';
import Fragment from '@/components/Fragment';
import { MountingPortal as Portal } from 'portal-vue';
import Transition from './components/Transition';
import Popup from './components/Popup';
import {
    computePosition,
    autoUpdate,
    offset,
    flip,
} from '@floating-ui/dom';

import type { PropType } from 'vue';
import type { Material } from '@/stores/api/materials';
import type { Session } from '@/stores/api/session';

type Props = {
    /**
     * Le matériel dont on veut afficher les informations
     * dans une infobulle.
     */
    material: Material,
};

type Data = {
    isOpen: boolean,
    popupPosition: Position,
};

type InstanceProperties = {
    showTimerId: ReturnType<typeof setTimeout> | undefined,
    hideTimerId: ReturnType<typeof setTimeout> | undefined,
    cancelPopupPositionUpdater: (() => void) | undefined,
    isPopupHovered: boolean,
};

/** Délai avant l'affichage de l'infobulle. */
const SHOW_DELAY = DateTime.duration(350, 'milliseconds');

/** Délai avant de cacher l'infobulle une fois sorti de celle-ci. */
const HIDE_DELAY = DateTime.duration(500, 'milliseconds');

/**
 * Permet d'afficher une infobulle avec les informations
 * sur un matériel.
 */
const MaterialPopover = defineComponent({
    name: 'MaterialPopover',
    directives: { ClickOutside },
    props: {
        material: {
            type: Object as PropType<Props['material']>,
            required: true,
        },
    },
    setup: (): InstanceProperties => ({
        showTimerId: undefined,
        hideTimerId: undefined,
        cancelPopupPositionUpdater: undefined,
        isPopupHovered: false,
    }),
    data: (): Data => ({
        isOpen: false,
        popupPosition: { x: 0, y: 0 },
    }),
    computed: {
        disabled(): boolean {
            const isLogged: boolean = this.$store.getters['auth/isLogged'];
            if (!isLogged) {
                return false;
            }

            const session = this.$store.state.auth.user as Session;
            return session.disable_contextual_popovers;
        },
    },
    mounted() {
        this.registerPopupPositionUpdater();
    },
    updated() {
        this.registerPopupPositionUpdater();
    },
    beforeDestroy() {
        this.cleanupShowTimer();
        this.cleanupHideTimer();
        this.cleanupPopupPositionUpdater();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleMouseEnter() {
            this.cleanupHideTimer();

            if (this.showTimerId !== undefined || this.isOpen) {
                return;
            }

            const callback = (): void => {
                this.isOpen = true;
                this.showTimerId = undefined;
            };
            this.showTimerId = setTimeout(callback, SHOW_DELAY.asMilliseconds());
        },

        handleMouseLeave() {
            this.cleanupShowTimer();

            if (this.hideTimerId !== undefined || !this.isOpen) {
                return;
            }

            if (this.isPopupHovered) {
                return;
            }

            const callback = (): void => {
                this.isOpen = false;
                this.isPopupHovered = false;
                this.hideTimerId = undefined;
            };
            this.hideTimerId = setTimeout(callback, HIDE_DELAY.asMilliseconds());
        },

        handleClickOutside() {
            this.cleanupShowTimer();
            this.cleanupHideTimer();
            this.isOpen = false;
            this.isPopupHovered = false;
        },

        handleMouseEnterPopup() {
            this.cleanupHideTimer();

            this.isPopupHovered = true;
        },

        handleMouseLeavePopup() {
            this.isPopupHovered = false;

            this.handleMouseLeave();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async updatePopupPosition(): Promise<void> {
            const $target = this.$refs.target as HTMLElement;
            const $popup = this.$refs.popup as HTMLElement | undefined;

            if (!this.isOpen || !$popup) {
                return;
            }

            const oldPosition = { ...this.popupPosition };
            const newPosition = await computePosition($target, $popup, {
                placement: 'bottom-start',
                middleware: [offset(10), flip()],
            });

            if (newPosition.x === oldPosition.x && newPosition.y === oldPosition.y) {
                return;
            }

            this.popupPosition = { x: newPosition.x, y: newPosition.y };
        },

        registerPopupPositionUpdater() {
            this.cleanupPopupPositionUpdater();

            const $target = this.$refs.target as HTMLElement | undefined;
            const $popup = this.$refs.popup as HTMLElement | undefined;
            if ($target && $popup) {
                this.cleanupPopupPositionUpdater = autoUpdate(
                    $target,
                    $popup,
                    this.updatePopupPosition.bind(this),
                );
            }
        },

        cleanupPopupPositionUpdater() {
            if (typeof this.cancelPopupPositionUpdater === 'function') {
                this.cancelPopupPositionUpdater();
                this.cancelPopupPositionUpdater = undefined;
            }
        },

        cleanupShowTimer() {
            if (this.showTimerId === undefined) {
                return;
            }

            clearTimeout(this.showTimerId);
            this.showTimerId = undefined;
        },

        cleanupHideTimer() {
            if (this.hideTimerId === undefined) {
                return;
            }

            clearTimeout(this.hideTimerId);
            this.hideTimerId = undefined;
        },
    },
    render() {
        const children = this.$slots.default;
        const {
            isOpen,
            disabled,
            material,
            popupPosition,
            handleMouseEnter,
            handleMouseLeave,
            handleClickOutside,
            handleMouseEnterPopup,
            handleMouseLeavePopup,
        } = this;

        if (disabled) {
            return (
                <Fragment>
                    {children}
                </Fragment>
            );
        }

        return (
            <Fragment>
                <div
                    ref="target"
                    onMouseenter={handleMouseEnter}
                    onMouseleave={handleMouseLeave}
                >
                    {children}
                </div>
                {isOpen && (
                    <Portal mountTo="#app" transition={Transition} append>
                        <div
                            ref="popup"
                            class="MaterialPopover__popup"
                            v-clickOutside={handleClickOutside}
                            onMouseenter={handleMouseEnterPopup}
                            onMouseleave={handleMouseLeavePopup}
                            style={{
                                left: `${popupPosition.x}px`,
                                top: `${popupPosition.y}px`,
                            }}
                        >
                            <Popup material={material} />
                        </div>
                    </Portal>
                )}
            </Fragment>
        );
    },
});

export default MaterialPopover;
