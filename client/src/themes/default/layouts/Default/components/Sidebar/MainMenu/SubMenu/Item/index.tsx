import './index.scss';
import { defineComponent } from 'vue';
import Icon from '@/themes/default/components/Icon';

import type { PropType } from 'vue';
import type { CustomRouterLinkProps, RawLocation } from 'vue-router';

export type Props = {
    /** Le label du lien. */
    label: string,

    /**
     * La cible du lien sous forme de chaîne ou d'objet `Location` compatible avec Vue-Router.
     *
     * Si non définie, un élément HTML `<button>` sera utilisé et
     * vous devriez écouter l'événement `onClick` pour réagir au click.
     */
    to: RawLocation,

    /** L'icône à afficher. */
    icon: string,

    /** Un nombre à afficher dans une pastille sur le lien. */
    counter?: number,

    /**
     * Si la valeur vaut `true`, le router considérera
     * l'URL comme exacte lors du check du lien actif.
     */
    exact?: boolean,
};

/** Élément de sous-menu dans le menu principal de la barre latérale. */
const DefaultLayoutSidebarMainMenuSubMenuItem = defineComponent({
    name: 'DefaultLayoutSidebarMainMenuSubMenuItem',
    props: {
        label: {
            type: String as PropType<Props['label']>,
            required: true,
        },
        to: {
            type: [String, Object] as PropType<Props['to']>,
            required: true,
        },
        icon: {
            type: String as PropType<Props['icon']>,
            required: true,
        },
        counter: {
            type: Number as PropType<Props['counter']>,
            default: undefined,
        },
        exact: {
            type: Boolean as PropType<Required<Props>['exact']>,
            default: false,
        },
    },
    render() {
        const { label, to, icon, counter, exact } = this;

        return (
            <router-link to={to} exact={exact} custom>
                {({ href, navigate, isActive }: CustomRouterLinkProps) => (
                    <li
                        class={[
                            'DefaultLayoutSidebarMainMenuSubMenuItem',
                            { 'DefaultLayoutSidebarMainMenuSubMenuItem--active': isActive },
                        ]}
                    >
                        <a
                            href={href}
                            onClick={navigate}
                            class="DefaultLayoutSidebarMainMenuSubMenuItem__link"
                        >
                            <span class="DefaultLayoutSidebarMainMenuSubMenuItem__icon">
                                <Icon
                                    name={icon}
                                    class="DefaultLayoutSidebarMainMenuSubMenuItem__icon__content"
                                />
                                {!!counter && (
                                    <span class="DefaultLayoutSidebarMainMenuSubMenuItem__icon__counter">
                                        {counter}
                                    </span>
                                )}
                            </span>
                            <span class="DefaultLayoutSidebarMainMenuSubMenuItem__text">
                                {label}
                            </span>
                        </a>
                    </li>
                )}
            </router-link>
        );
    },
});

export default DefaultLayoutSidebarMainMenuSubMenuItem;
