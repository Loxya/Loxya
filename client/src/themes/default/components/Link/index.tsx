import './index.scss';
import invariant from 'invariant';
import { defineComponent } from 'vue';
import Fragment from '@/components/Fragment';
import Icon from '@/themes/default/components/Icon';

import type { Location } from 'vue-router';
import type { TooltipOptions } from 'v-tooltip';
import type { PropType } from 'vue';
import type {
    Props as IconProps,
    Variant as IconVariant,
} from '@/themes/default/components/Icon';

type Props = {
    /**
     * La cible du lien sous forme de chaîne ou d'objet `Location` compatible avec Vue-Router.
     *
     * Si non définie, un élément HTML `<button>` sera utilisé et
     * vous devriez écouter l'événement `onClick` pour réagir au click.
     */
    to?: string | Location,

    /**
     * L'icône à utiliser avant le texte du lien.
     *
     * Doit contenir une chaîne de caractère avec les composantes suivantes séparées par `:`:
     * - Le nom de l'icône sous forme de chaîne (e.g. `plus`, `wrench`)
     *   Pour une liste exhaustive des codes, voir: https://fontawesome.com/v5.15/icons?m=free
     * - La variante à utiliser de l'icône à utiliser (`solid`, `regular`, ...).
     *
     * @example
     * - `wrench`
     * - `wrench:solid`
     */
    icon?: string | `${string}:${Required<IconProps>['variant']}`,

    /**
     * La variante de lien (= son style).
     *
     * @default 'default'
     */
    variant?: 'default' | 'primary',

    /**
     * Le contenu d'une éventuelle infobulle qui sera affichée au survol du lien.
     *
     * La valeur peut avoir deux formats différents:
     * - Une chaîne de caractère: Celle-ci sera utilisée pour le contenu de l'infobulle
     *   qui sera elle-même affichée centrée en dessous du lien au survol.
     * - Un object de configuration contenant les clés:
     *   - `content`: Le texte affiché dans l'infobulle.
     *   - `placement`: La position de l'infobulle par rapport au lien.
     *                  (e.g. `top`, `bottom`, `left`, `right`, ...)
     */
    tooltip?: string | TooltipOptions,

    /**
     * Permet d'indiquer que c'est un lien externe.
     *
     * Si c'est le cas, le component fonctionnera comme suit:
     * - Le routing interne ("Vue Router"), ne sera pas utilisé.
     *   (Il ne faut donc pas passer d'objet à `to` mais bien une chaîne)
     * - Si c'est une URL absolue, celle-ci s'ouvrira dans une autre fenêtre / onglet.
     */
    external?: boolean,

    /**
     * Fonction appelée lorsque le lien a été cliqué.
     *
     * @param event - L'événement lié.
     */
    onClick?(event: MouseEvent): void,
};

/** Une lien. */
const Link = defineComponent({
    name: 'Link',
    props: {
        to: {
            type: [String, Object] as PropType<Props['to']>,
            default: undefined,
        },
        icon: {
            type: String as PropType<Props['icon']>,
            default: undefined,
        },
        variant: {
            type: String as PropType<Required<Props>['variant']>,
            default: 'default',
            validator: (value: unknown) => (
                typeof value === 'string' &&
                ['default', 'primary'].includes(value)
            ),
        },
        tooltip: {
            type: [String, Object] as PropType<Props['tooltip']>,
            default: undefined,
        },
        external: {
            type: Boolean as PropType<Required<Props>['external']>,
            default: false,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onClick: {
            type: Function as PropType<Props['onClick']>,
            default: undefined,
        },
    },
    emits: ['click'],
    setup(props) {
        invariant(
            !props.external || typeof props.to === 'string',
            'The `to` props. must be a string when the prop `external` is used.',
        );
        return {};
    },
    computed: {
        normalizedIcon(): IconProps | null {
            if (!this.icon) {
                return null;
            }

            if (!this.icon.includes(':')) {
                return { name: this.icon };
            }

            const [iconType, variant] = this.icon.split(':');
            return { name: iconType, variant: variant as IconVariant };
        },

        normalizedTooltip(): TooltipOptions | string | undefined {
            return typeof this.tooltip === 'object'
                ? { ...this.tooltip, content: this.tooltip.content }
                : this.tooltip;
        },
    },
    methods: {
        handleClick(event: MouseEvent) {
            this.$emit('click', event);
        },
    },
    render() {
        const children = this.$slots.default;
        const {
            to,
            variant,
            external,
            handleClick,
            normalizedIcon: icon,
            normalizedTooltip: tooltip,
        } = this;

        const className = ['Link', `Link--${variant}`];
        const content = (
            <Fragment>
                {icon && <Icon {...{ props: icon } as any} class="Link__icon" />}
                {children && <span class="Link__content">{children}</span>}
            </Fragment>
        );

        if (to) {
            if (external) {
                // Note: `to` est assuré d'être une string ici vu l'assertion dans le setup.
                const isOutside = (to as string).includes('://');
                return (
                    <a
                        href={to as string}
                        class={className}
                        v-tooltip={tooltip}
                        target={isOutside ? '_blank' : undefined}
                        rel={isOutside ? 'noreferrer noopener' : undefined}
                    >
                        {content}
                    </a>
                );
            }

            return (
                <router-link to={to} custom>
                    {({ href, navigate: handleNavigate }: any) => (
                        <a
                            href={href}
                            class={className}
                            v-tooltip={tooltip}
                            onClick={handleNavigate}
                        >
                            {content}
                        </a>
                    )}
                </router-link>
            );
        }

        return (
            <button
                type="button"
                class={className}
                v-tooltip={tooltip}
                onClick={handleClick}
            >
                {content}
            </button>
        );
    },
});

export default Link;
