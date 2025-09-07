import { z } from '@/utils/validation';
import { defineComponent } from 'vue';
import SearchPanel from '@/themes/default/components/SearchPanel';

import type { PropType } from 'vue';
import type { SchemaInfer } from '@/utils/validation';

export const FiltersSchema = z.strictObject({
    search: z.string().array(),
});

export type Filters = SchemaInfer<typeof FiltersSchema>;

type Props = {
    /** Les valeurs actuelles des filtres. */
    values: Filters,

    /**
     * Fonction appelée lorsque les filtres ont changés.
     *
     * @param newFilters - Les nouveaux filtres.
     */
    onChange?(newFilters: Filters): void,

    /**
     * Fonction appelée lorsque l'utilisateur a soumis
     * les changements dans les filtres.
     */
    onSubmit?(): void,
};

/** Filtres de la page des bénéficiaires. */
const BeneficiariesFilters = defineComponent({
    name: 'BeneficiariesFilters',
    props: {
        values: {
            type: Object as PropType<Required<Props>['values']>,
            required: true,
            validator: (value: unknown) => (
                FiltersSchema.safeParse(value).success
            ),
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSubmit: {
            type: Function as PropType<Props['onSubmit']>,
            default: undefined,
        },
    },
    emits: ['change', 'submit'],
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChange(newFilters: Filters) {
            this.$emit('change', newFilters);
        },

        handleSubmit() {
            this.$emit('submit');
        },
    },
    render() {
        const {
            values,
            handleChange,
            handleSubmit,
        } = this;

        return (
            <SearchPanel
                values={values}
                onChange={handleChange}
                onSubmit={handleSubmit}
            />
        );
    },
});

export default BeneficiariesFilters;
