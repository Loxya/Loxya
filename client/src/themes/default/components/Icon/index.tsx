import { defineComponent } from 'vue';

import type { PropType } from 'vue';
import type { TooltipOptions } from 'v-tooltip';

/** Les différentes variantes disponibles pour les icônes. */
export enum Variant {
    REGULAR = 'regular',
    SOLID = 'solid',
    BRANDS = 'brands',
}

export const VARIANT_MAP = {
    [Variant.REGULAR]: 'far',
    [Variant.SOLID]: 'fas',
    [Variant.BRANDS]: 'fab',
} as const;

export type Props = {
    /**
     * Le nom de l'icône à afficher.
     *
     * Pour une liste exhaustive des codes, voir: https://fontawesome.com/v5.15/icons?m=free
     */
    name: string,

    /** Quelle variante faut-il utiliser pour l'icône ? */
    variant?: Variant,

    /** L'icône doit-elle tourner sur elle-même ? */
    spin?: boolean,

    /**
     * Le contenu d'une éventuelle infobulle qui sera affichée au survol de l'icône.
     *
     * La valeur peut avoir deux formats différents:
     * - Une chaîne de caractère: Celle-ci sera utilisée pour le contenu de l'infobulle
     *   qui sera elle-même affichée centrée en dessous de l'icône au survol.
     * - Un object de configuration contenant les clés:
     *   - `content`: Le texte affiché dans l'infobulle.
     *   - `placement`: La position de l'infobulle par rapport à l'icône.
     *                  (e.g. `top`, `bottom`, `left`, `right`, ...)
     */
    tooltip?: string | TooltipOptions,
};

/** Une icône. */
const Icon = defineComponent({
    name: 'Icon',
    props: {
        name: {
            type: String as PropType<Props['name']>,
            required: true,
        },
        variant: {
            type: String as PropType<Required<Props>['variant']>,
            default: Variant.SOLID,
            validator: (value: unknown) => (
                typeof value === 'string' &&
                Object.values(Variant).includes(value as any)
            ),
        },
        spin: {
            type: Boolean as PropType<Required<Props>['spin']>,
            default: false,
        },
        tooltip: {
            type: [String, Object] as PropType<Props['tooltip']>,
            default: undefined,
        },
    },
    computed: {
        normalizedTooltip(): TooltipOptions | string | undefined {
            return typeof this.tooltip === 'object'
                ? { ...this.tooltip, content: this.tooltip.content }
                : this.tooltip;
        },
    },
    render() {
        const {
            name,
            variant,
            spin,
            normalizedTooltip: tooltip,
        } = this;

        const classNames = ['Icon', VARIANT_MAP[variant], `fa-${name}`, {
            'fa-spin': spin,
        }];

        return (
            <i
                class={classNames}
                aria-hidden="true"
                v-tooltip={tooltip}
            />
        );
    },
});

export default Icon;
