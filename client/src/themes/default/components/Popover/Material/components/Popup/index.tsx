import './index.scss';
import { defineComponent } from 'vue';
import formatCustomFieldValue from '@/utils/formatCustomFieldValue';

import type { PropType } from 'vue';
import type { Material } from '@/stores/api/materials';
import type { PropertyWithValue } from '@/stores/api/properties';

type Props = {
    /** Le matériel dont on veut afficher les détails. */
    material: Material,
};

/**
 * Popup contenant le détails d'un matériel.
 *
 * (nom et référence, parc (si non-unitaire), photo, description,
 * caractéristiques spéciales et notes)
 */
const MaterialPopoverPopup = defineComponent({
    name: 'MaterialPopoverPopup',
    props: {
        material: {
            type: Object as PropType<Props['material']>,
            required: true,
        },
    },
    computed: {
        parkName(): string | null {
            const { material } = this;
            return this.$store.getters['parks/getName'](material.park_id);
        },

        hasInfos(): boolean {
            const { material } = this;

            return (
                (material.description ?? '').length > 0 ||
                (material.note ?? '').length > 0 ||
                material.properties.length > 0 ||
                !material.is_discountable
            );
        },
    },
    mounted() {
        this.$store.dispatch('parks/fetch');
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.Popover.Material.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const { __, parkName, material, hasInfos } = this;
        const {
            picture,
            name,
            reference,
            description,
            note,
            properties,
            is_discountable: isDiscountable,
        } = material;

        const pictureClassNames = ['MaterialPopoverPopup__picture', {
            'MaterialPopoverPopup__picture--placeholder': !picture,
        }];

        return (
            <div class="MaterialPopoverPopup">
                <div class={pictureClassNames}>
                    {picture && <img src={picture} class="MaterialPopoverPopup__image" />}
                </div>
                <div class="MaterialPopoverPopup__main">
                    <div class="MaterialPopoverPopup__main__header">
                        <div class="MaterialPopoverPopup__title">
                            <span class="MaterialPopoverPopup__title__name">{name}</span>
                            <span class="MaterialPopoverPopup__title__reference">
                                {__('global.ref-ref', { reference })}
                            </span>
                        </div>
                        {!!parkName && (
                            <span class="MaterialPopoverPopup__park">
                                {__('global.park-name', { name: parkName })}
                            </span>
                        )}
                    </div>
                    {hasInfos && (
                        <div class="MaterialPopoverPopup__main__infos">
                            {(description ?? '').length > 0 && (
                                <p class="MaterialPopoverPopup__description">
                                    {description}
                                </p>
                            )}
                            {properties.length > 0 && (
                                <dl class="MaterialPopoverPopup__properties">
                                    {properties.map((property: PropertyWithValue) => (
                                        <div key={property.id} class="MaterialPopoverPopup__properties__item">
                                            <dt class="MaterialPopoverPopup__properties__item__name">
                                                {__('global.label-colon', { label: property.name })}
                                            </dt>
                                            <dd class="MaterialPopoverPopup__properties__item__value">
                                                {formatCustomFieldValue(this.$t, property)}
                                            </dd>
                                        </div>
                                    ))}
                                </dl>
                            )}
                            {!isDiscountable && (
                                <p class="MaterialPopoverPopup__not-discountable">
                                    {__('not-discountable')}
                                </p>
                            )}
                            {(note ?? '').length > 0 && (
                                <p class="MaterialPopoverPopup__note">
                                    {note}
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    },
});

export default MaterialPopoverPopup;
