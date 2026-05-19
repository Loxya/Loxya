import './index.scss';
import { defineComponent } from 'vue';
import { getLocationStateFactory } from './_utils';
import Icon from '@/themes/default/components/Icon';
import Item from './Item';

import type { PropType } from 'vue';
import type { RawLocation } from 'vue-router';
import type { Props as ItemProps } from './Item';

export type Props = {
    /** Le label de l'élément. */
    label: string,

    /** L'icône à afficher. */
    icon: string,

    /** Un nombre à afficher dans une pastille à côté de l'élément. */
    counter?: number,

    /** Les éléments enfants de l'élément. */
    items: ItemProps[],
};

/** Sous-menu du menu principal de la barre latérale. */
const DefaultLayoutSidebarMainMenuSubMenu = defineComponent({
    name: 'DefaultLayoutSidebarMainMenuSubMenu',
    props: {
        label: {
            type: String as PropType<Props['label']>,
            required: true,
        },
        icon: {
            type: String as PropType<Props['icon']>,
            required: true,
        },
        items: {
            type: Array as PropType<Props['items']>,
            required: true,
            validator: (values: unknown) => {
                if (!Array.isArray(values)) {
                    return false;
                }
                return values.length > 0;
            },
        },
        counter: {
            type: Number as PropType<Props['counter']>,
            default: undefined,
        },
    },
    computed: {
        mainTarget(): RawLocation | undefined {
            const firstItem = [...this.items].shift();
            return firstItem?.to;
        },

        hasActiveItem(): boolean {
            const getLocationState = getLocationStateFactory(this.$router, this.$route);
            return this.items.some((item: ItemProps) => {
                const { isActive, isExactActive } = getLocationState(item.to);
                return item.exact ? isExactActive : isActive;
            });
        },
    },
    methods: {
        handleClick() {
            const target = this.mainTarget;
            if (target === undefined) {
                return;
            }
            this.$router.push(target, () => {});
        },
    },
    render() {
        const {
            label,
            icon,
            counter,
            items,
            hasActiveItem,
            handleClick,
        } = this;

        const className = ['DefaultLayoutSidebarMainMenuSubMenu', {
            'DefaultLayoutSidebarMainMenuSubMenu--active': hasActiveItem,
        }];

        return (
            <li class={className}>
                <button
                    type="button"
                    class="DefaultLayoutSidebarMainMenuSubMenu__button"
                    onClick={handleClick}
                >
                    <span class="DefaultLayoutSidebarMainMenuSubMenu__button__icon">
                        <Icon
                            name={icon}
                            class="DefaultLayoutSidebarMainMenuSubMenu__button__icon__content"
                        />
                        {!!counter && (
                            <span class="DefaultLayoutSidebarMainMenuSubMenu__button__icon__counter">
                                {counter}
                            </span>
                        )}
                    </span>
                    <span class="DefaultLayoutSidebarMainMenuSubMenu__button__text">
                        {label}
                    </span>
                </button>
                <ul class="DefaultLayoutSidebarMainMenuSubMenu__items">
                    {items.map((item: ItemProps) => (
                        <Item
                            key={item.label}
                            label={item.label}
                            to={item.to}
                            icon={item.icon}
                            counter={item.counter}
                            exact={item.exact}
                        />
                    ))}
                </ul>
            </li>
        );
    },
});

export default DefaultLayoutSidebarMainMenuSubMenu;
