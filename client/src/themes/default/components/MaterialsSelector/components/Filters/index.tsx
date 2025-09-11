import './index.scss';
import omit from 'lodash/omit';
import isEqual from 'lodash/isEqual';
import debounce from 'lodash/debounce';
import { defineComponent } from 'vue';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import SearchPanel from '@/themes/default/components/MaterialsFilters';
import SwitchToggle from '@/themes/default/components/SwitchToggle';

import type { DebouncedMethod } from 'lodash';
import type { PropType } from 'vue';
import type { Filters as CoreFilters } from '@/themes/default/components/MaterialsFilters';
import type { Filters } from '../../_types';

type Props = {
    /** Les filtres actuels. */
    values: Filters,

    /**
     * Dois-t'on afficher le filtre permettant de n'afficher
     * que les éléments sélectionnés ?
     */
    withSelectedOnlyFilter?: boolean,

    /**
     * Fonction appelée lorsque les filtres ont changés.
     *
     * @param newFilters - Les nouveaux filtres.
     */
    onChange?(newFilters: Filters): void,
};

type InstanceProperties = {
    handleSearchChangeDebounced: (
        | DebouncedMethod<typeof MaterialsSelectorFilters, 'handleSearchChange'>
        | undefined
    ),
};

/** Les filtres du sélecteur de matériel. */
const MaterialsSelectorFilters = defineComponent({
    name: 'MaterialsSelectorFilters',
    props: {
        values: {
            type: Object as PropType<Required<Props>['values']>,
            required: true,
        },
        withSelectedOnlyFilter: {
            type: Boolean as PropType<Required<Props>['withSelectedOnlyFilter']>,
            default: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['change'],
    setup: (): InstanceProperties => ({
        handleSearchChangeDebounced: undefined,
    }),
    computed: {
        coreValues(): CoreFilters {
            return omit(this.values, ['onlySelected']);
        },
    },
    created() {
        this.handleSearchChangeDebounced = debounce(
            this.handleSearchChange.bind(this),
            DEBOUNCE_WAIT_DURATION.asMilliseconds(),
        );
    },
    beforeDestroy() {
        this.handleSearchChangeDebounced?.cancel();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSearchChange(search: string[]) {
            if (!isEqual(this.values.search, search)) {
                this.$emit('change', { ...this.values, search });
            }
        },

        handleFiltersChange(newFiltersRaw: CoreFilters) {
            // - On debounce le changement dans la recherche textuelle.
            this.handleSearchChangeDebounced!(newFiltersRaw.search);

            // - On trigger le changement directement pour les autres filtres.
            const newFilters = { ...this.values, ...omit(newFiltersRaw, ['search']) };
            if (!isEqual(newFilters, this.values)) {
                this.$emit('change', newFilters);
            }
        },

        handleSelectOnlyFilterChange(onlySelected: boolean) {
            if (!this.withSelectedOnlyFilter) {
                return;
            }
            this.$emit('change', { ...this.values, onlySelected });
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.MaterialsSelector.filters.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            values,
            coreValues,
            handleFiltersChange,
            withSelectedOnlyFilter,
            handleSelectOnlyFilterChange,
        } = this;

        return (
            <div class="MaterialsSelectorFilters">
                <SearchPanel
                    class="MaterialsSelectorFilters__search"
                    values={coreValues}
                    onChange={handleFiltersChange}
                />
                {withSelectedOnlyFilter && (
                    <div class="MaterialsSelectorFilters__selected-only">
                        <span class="MaterialsSelectorFilters__selected-only__label">
                            {__('selected-materials-only')}
                        </span>
                        <SwitchToggle
                            value={values.onlySelected}
                            onInput={handleSelectOnlyFilterChange}
                            class="MaterialsSelectorFilters__selected-only__input"
                        />
                    </div>
                )}
            </div>
        );
    },
});

export default MaterialsSelectorFilters;
