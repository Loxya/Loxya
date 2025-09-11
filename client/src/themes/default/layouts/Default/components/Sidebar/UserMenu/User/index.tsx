import './index.scss';
import { defineComponent } from 'vue';
import ClickOutside from 'vue-click-outside';
import { MountingPortal as Portal } from 'portal-vue';
import Icon from '@/themes/default/components/Icon';
import Transition from './Transition';
import Dropdown from './Dropdown';
import {
    computePosition,
    autoPlacement,
    autoUpdate,
    offset,
} from '@floating-ui/dom';

import type { Session } from '@/stores/api/session';

type InstanceProperties = {
    cancelDropdownPositionUpdater: (() => void) | undefined,
};

type Data = {
    isDropdownOpen: boolean,
    dropdownPosition: Position,
};

/** L'utilisateur dans la barre latérale du layout par défaut. */
const DefaultLayoutSidebarUser = defineComponent({
    name: 'DefaultLayoutSidebarUser',
    directives: { ClickOutside },
    setup: (): InstanceProperties => ({
        cancelDropdownPositionUpdater: undefined,
    }),
    data: (): Data => ({
        isDropdownOpen: false,
        dropdownPosition: { x: 0, y: 0 },
    }),
    computed: {
        user(): Session {
            return this.$store.state.auth.user;
        },

        isActive(): boolean {
            return this.$route.name === 'user-settings';
        },
    },
    watch: {
        $route() {
            this.isDropdownOpen = false;
        },
    },
    mounted() {
        this.registerDropdownPositionUpdater();
    },
    updated() {
        this.registerDropdownPositionUpdater();
    },
    beforeDestroy() {
        this.cleanupDropdownPositionUpdater();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleClickOutside(e: Event) {
            // - Si c'est un click dans le dropdown, on ne fait rien.
            const $dropdown = this.$refs.dropdown as HTMLElement | undefined;
            if (e.target !== null && $dropdown?.contains(e.target as Node)) {
                return;
            }
            this.isDropdownOpen = false;
        },

        handleToggleDropdown() {
            this.isDropdownOpen = !this.isDropdownOpen;
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async updateDropdownPosition(): Promise<void> {
            const $main = this.$refs.main as HTMLElement;
            const $dropdown = this.$refs.dropdown as HTMLElement | undefined;

            if (!this.isDropdownOpen || !$dropdown) {
                return;
            }

            const oldPosition = { ...this.dropdownPosition };
            const newPosition = await computePosition($main, $dropdown, {
                placement: 'top-start',
                middleware: [
                    autoPlacement({
                        alignment: 'start',
                        allowedPlacements: ['top-start'],
                    }),
                    offset(5),
                ],
            });

            if (newPosition.x === oldPosition.x && newPosition.y === oldPosition.y) {
                return;
            }

            this.dropdownPosition = { x: newPosition.x, y: newPosition.y };
        },

        cleanupDropdownPositionUpdater() {
            if (typeof this.cancelDropdownPositionUpdater === 'function') {
                this.cancelDropdownPositionUpdater();
                this.cancelDropdownPositionUpdater = undefined;
            }
        },

        registerDropdownPositionUpdater() {
            this.cleanupDropdownPositionUpdater();

            const $main = this.$refs.main as HTMLElement | undefined;
            const $dropdown = this.$refs.dropdown as HTMLElement | undefined;
            if ($main && $dropdown) {
                this.cleanupDropdownPositionUpdater = autoUpdate(
                    $main,
                    $dropdown,
                    this.updateDropdownPosition.bind(this),
                );
            }
        },
    },
    render() {
        const {
            user,
            isDropdownOpen,
            isActive,
            dropdownPosition,
            handleClickOutside,
            handleToggleDropdown,
        } = this;

        const classNames = ['DefaultLayoutSidebarUser', {
            'DefaultLayoutSidebarUser--dropdown-open': isDropdownOpen,
            'DefaultLayoutSidebarUser--active': isActive,
        }];

        return (
            <div class={classNames} v-clickOutside={handleClickOutside}>
                <div
                    ref="main"
                    class="DefaultLayoutSidebarUser__main"
                    onClick={handleToggleDropdown}
                    role="button"
                >
                    <div class="DefaultLayoutSidebarUser__main__avatar">
                        <Icon name="user" />
                    </div>
                    <div class="DefaultLayoutSidebarUser__main__text">
                        <span class="DefaultLayoutSidebarUser__main__name">
                            {user.full_name}
                        </span>
                        <span class="DefaultLayoutSidebarUser__main__email">
                            {user.email}
                        </span>
                    </div>
                </div>
                {isDropdownOpen && (
                    <Portal mountTo="#app" transition={Transition} append>
                        <div
                            ref="dropdown"
                            class="DefaultLayoutSidebarUser__dropdown"
                            style={{
                                top: `${dropdownPosition.y}px`,
                                left: `${dropdownPosition.x}px`,
                            }}
                        >
                            <Dropdown />
                        </div>
                    </Portal>
                )}
            </div>
        );
    },
});

export default DefaultLayoutSidebarUser;
