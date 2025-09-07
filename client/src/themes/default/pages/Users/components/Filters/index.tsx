import { z } from '@/utils/validation';
import { Group } from '@/stores/api/groups';
import { defineComponent } from 'vue';
import SearchPanel from '@/themes/default/components/SearchPanel';

import type { Options } from '@/utils/formatOptions';
import type { PropType } from 'vue';
import type { SchemaInfer } from '@/utils/validation';
import type { GroupDetails } from '@/stores/api/groups';
import type { FilterDefinition } from '@/themes/default/components/SearchPanel';

export enum TokenType {
    GROUP = 'group',
}

export const FiltersSchema = z.strictObject({
    search: z.string().array(),
    group: z.nativeEnum(Group).nullable(),
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

/** Filtres de la page des utilisateurs. */
const UsersFilters = defineComponent({
    name: 'UsersFilters',
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
    computed: {
        groupsOptions(): Options<GroupDetails> {
            return this.$store.getters['groups/options'];
        },

        definitions(): FilterDefinition[] {
            const { $t: __, groupsOptions } = this;

            return [
                {
                    type: TokenType.GROUP,
                    icon: 'users-cog',
                    title: __('group'),
                    placeholder: __('page.users.display-all-groups'),
                    options: groupsOptions,
                },
            ];
        },
    },
    created() {
        this.$store.dispatch('groups/fetch');
    },
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
            definitions,
            handleChange,
            handleSubmit,
        } = this;

        return (
            <SearchPanel
                values={values}
                definitions={definitions}
                onChange={handleChange}
                onSubmit={handleSubmit}
            />
        );
    },
});

export default UsersFilters;
