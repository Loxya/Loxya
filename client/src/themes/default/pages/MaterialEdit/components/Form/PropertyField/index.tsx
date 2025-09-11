import Period from '@/utils/period';
import { defineComponent } from 'vue';
import { CustomFieldType } from '@/stores/api/@types';
import FormField from '@/themes/default/components/FormField';

import type { PropType } from 'vue';
import type { PropertyDetails, PropertyWithValue } from '@/stores/api/properties';

type Props = {
    /** La propriété en cours d'édition. */
    property: PropertyDetails,

    /** Valeur courante de la propriété. */
    value: PropertyWithValue['value'],

    /**
     * Fonction appelée lorsque la valeur de la propriété a changé.
     *
     * @param newValue - Nouvelle valeur de la propriété.
     */
    onChange?(newValue: PropertyWithValue['value']): void,
};

type Data = {
    inputIsFullDays: boolean | undefined,
};

/**
 * Champ de formulaire d'une propriété dans le
 * formulaire d'édition du materiel.
 */
const MaterialEditFormPropertyField = defineComponent({
    name: 'MaterialEditFormPropertyField',
    props: {
        property: {
            type: Object as PropType<Props['property']>,
            required: true,
        },
        value: {
            type: null as unknown as PropType<Required<Props>['value']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['change'],
    data(): Data {
        let inputIsFullDays: boolean | undefined;
        if (this.property.type === CustomFieldType.PERIOD) {
            inputIsFullDays = this.value instanceof Period
                ? this.value.isFullDays
                : true;
        }
        return { inputIsFullDays };
    },
    computed: {
        inputAttrs(): Record<string, any> {
            const { property } = this;

            switch (property.type) {
                case CustomFieldType.INTEGER:
                case CustomFieldType.FLOAT: {
                    return {
                        type: 'number',
                        step: property.type === CustomFieldType.INTEGER ? 1 : 0.001,
                        addon: property.unit ?? undefined,
                    };
                }
                case CustomFieldType.BOOLEAN: {
                    return { type: 'switch' };
                }
                case CustomFieldType.DATE: {
                    return { type: 'date' };
                }
                case CustomFieldType.PERIOD: {
                    const type = property.full_days === null
                        ? (this.inputIsFullDays ? 'date' : 'datetime')
                        : (property.full_days ? 'date' : 'datetime');

                    return {
                        type,
                        range: true,
                        withFullDaysToggle: property.full_days === null,
                    };
                }
                case CustomFieldType.LIST: {
                    return {
                        type: 'select',
                        options: property.options,
                    };
                }
                case CustomFieldType.TEXT: {
                    return { type: 'textarea' };
                }
                default: {
                    return { type: 'text' };
                }
            }
        },
    },
    methods: {
        handleChangeFactory() {
            const { property } = this;

            if (property.type === CustomFieldType.PERIOD) {
                return (value: PropertyWithValue['value'], isFullDays: boolean) => {
                    this.inputIsFullDays = isFullDays;
                    this.$emit('change', value);
                };
            }

            return (value: PropertyWithValue['value']) => {
                this.$emit('change', value);
            };
        },
    },
    render() {
        const {
            value,
            property,
            inputAttrs,
            handleChangeFactory,
        } = this;

        return (
            <FormField
                key={property.id}
                label={property.name}
                value={value}
                onChange={handleChangeFactory()}
                {...{ attrs: inputAttrs }}
            />
        );
    },
});

export default MaterialEditFormPropertyField;
