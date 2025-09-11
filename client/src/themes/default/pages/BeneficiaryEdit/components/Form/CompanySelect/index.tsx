import './index.scss';
import debounce from 'lodash/debounce';
import { defineComponent } from 'vue';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import formatOptions from '@/utils/formatOptions';
import Select from '@/themes/default/components/Select';
import Button from '@/themes/default/components/Button';
import apiCompanies from '@/stores/api/companies';

import type { DebouncedMethod } from 'lodash';
import type { PropType } from 'vue';
import type { Company } from '@/stores/api/companies';
import type { Options } from '@/utils/formatOptions';

type Props = {
    /** La société sélectionnée par défaut. */
    defaultCompany?: Company | null,

    /**
     * Fonction appelée lorsque la société sélectionnée change.
     *
     * @param id - Identifiant de la société sélectionnée, ou `null` si aucune.
     */
    onChange?(id: Company['id'] | null): void,
};

type InstanceProperties = {
    debouncedSearch: (
        | DebouncedMethod<typeof BeneficiaryEditCompanySelect, 'search'>
        | undefined
    ),
};

type Data = {
    companies: Company[],
    value: Company['id'] | null,
};

/** Champ de formulaire de sélection d'une société. */
const BeneficiaryEditCompanySelect = defineComponent({
    name: 'BeneficiaryEditCompanySelect',
    props: {
        defaultCompany: {
            type: Object as PropType<Required<Props>['defaultCompany']>,
            default: null,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['change'],
    setup: (): InstanceProperties => ({
        debouncedSearch: undefined,
    }),
    data(): Data {
        const { defaultCompany } = this;

        return {
            value: defaultCompany?.id ?? null,
            companies: defaultCompany ? [defaultCompany] : [],
        };
    },
    computed: {
        options(): Options<Company> {
            const formatLabel = (company: Company): string => {
                let label = company.legal_name;
                if ((company.registration_id ?? '').length > 0) {
                    label += ` (${company.registration_id!})`;
                }
                return label;
            };
            return formatOptions<Company>(this.companies, formatLabel);
        },
    },
    created() {
        this.debouncedSearch = debounce(
            this.search.bind(this),
            DEBOUNCE_WAIT_DURATION.asMilliseconds(),
        );
    },
    beforeDestroy() {
        this.debouncedSearch?.cancel();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChange(value: Company['id'] | null) {
            this.value = value;
            this.$emit('change', value);
        },

        handleCreate(name: string) {
            this.$router.push({ name: 'add-company', query: { name } });
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async search(search: string): Promise<void> {
            try {
                const { data } = await apiCompanies.all({ search, limit: 20 });
                this.companies = data;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error while searching a company (term: "${search}").`, error);
            }
        },
    },
    render() {
        const {
            $t: __,
            value,
            options,
            debouncedSearch,
            handleCreate,
            handleChange,
        } = this;

        return (
            <div class="BeneficiaryEditCompanySelect">
                <Select
                    value={value}
                    options={options}
                    placeholder={__('page.beneficiary-edit.type-to-search-company')}
                    class="BeneficiaryEditCompanySelect__select"
                    createLabel={__('create-company')}
                    searcher={debouncedSearch}
                    onCreate={handleCreate}
                    onInput={handleChange}
                    canCreate
                />
                {(value !== null) && (
                    <Button
                        class="BeneficiaryEditCompanySelect__edit-button"
                        icon="edit"
                        type="default"
                        to={{
                            name: 'edit-company',
                            params: { id: value.toString() },
                        }}
                    >
                        {__('action-edit')}
                    </Button>
                )}
            </div>
        );
    },
});

export default BeneficiaryEditCompanySelect;
