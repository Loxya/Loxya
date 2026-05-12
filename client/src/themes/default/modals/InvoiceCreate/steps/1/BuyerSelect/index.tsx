import './index.scss';
import config from '@/globals/config';
import { defineComponent } from 'vue';
import debounce from 'lodash/debounce';
import apiBeneficiaries from '@/stores/api/beneficiaries';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import formatOptions from '@/utils/formatOptions';
import Button from '@/themes/default/components/Button';
import Select from '@/themes/default/components/Select';

import type { PropType } from 'vue';
import type { DebouncedMethod } from 'lodash';
import type { Options, Option } from '@/themes/default/components/Select';
import type { Beneficiary } from '@/stores/api/beneficiaries';

type Props = {
    /** L'acheteur actuellement sélectionné, ou `null` si aucun. */
    value: Beneficiary | null,

    /**
     * Fonction appelée quand l'utilisateur sélectionne un acheteur
     * ou retire sa sélection.
     *
     * @param buyer - Le nouvel acheteur sélectionné, ou `null` si retiré.
     */
    onChange?(buyer: Beneficiary | null): void,
};

type InstanceProperties = {
    debouncedSearch: (
        | DebouncedMethod<typeof InvoiceCreateStepBuyerAndLinesBuyerSelect, 'search'>
        | undefined
    ),
};

type Data = {
    list: Beneficiary[],
};

/** Champ de sélection d'un acheteur pour la création d'une facture. */
const InvoiceCreateStepBuyerAndLinesBuyerSelect = defineComponent({
    name: 'InvoiceCreateStepBuyerAndLinesBuyerSelect',
    props: {
        value: {
            type: Object as PropType<Props['value']>,
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
    data: (): Data => ({
        list: [],
    }),
    computed: {
        options(): Options<Beneficiary['id'], Beneficiary> {
            const { list } = this;

            const options = formatOptions(list, (beneficiary: Beneficiary) => {
                const { full_name: fullName, reference, company } = beneficiary;

                let label = fullName;
                if (reference && reference.length > 0) {
                    label += ` (${reference})`;
                }
                if (company && company.legal_name.length > 0) {
                    label += ` − ${company.legal_name}`;
                }
                return label;
            });

            return options.map((option) => ({
                ...option,
                disabled: !option.data.is_invoiceable,
            }));
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

        handleSelect(id: Beneficiary['id'] | null) {
            if (id === null) {
                this.$emit('change', null);
                return;
            }

            const selected = this.list.find(
                ({ id: beneficiaryId }: Beneficiary) => beneficiaryId === id,
            );
            this.$emit('change', selected ?? null);
        },

        handleClear() {
            this.$emit('change', null);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async search(term: string): Promise<void> {
            try {
                const { data } = await apiBeneficiaries.all({ search: term, limit: 20 });
                this.list = data;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error while searching a beneficiary (term: "${term}").`, error);
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            if (!key.startsWith('global.')) {
                if (!key.startsWith('modal.')) {
                    key = `modal.steps.buyer-and-lines.fields.buyer.${key}`;
                }
                key = key.replace(/^modal\./, 'modal.invoice-create.');
            } else {
                key = key.replace(/^global\./, '');
            }
            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            value,
            options,
            debouncedSearch,
            handleSelect,
            handleClear,
        } = this;

        const renderContent = (): JSX.Element => {
            if (value === null) {
                return (
                    <Select
                        value={null}
                        options={options}
                        placeholder={__('placeholder')}
                        searcher={debouncedSearch}
                        renderer={(option: Option<Beneficiary['id'], Beneficiary>) => {
                            const { label, data: beneficiary } = option;
                            if (beneficiary!.is_invoiceable) {
                                return (
                                    <span class="InvoiceCreateStepBuyerAndLinesBuyerSelect__option">
                                        <span class="InvoiceCreateStepBuyerAndLinesBuyerSelect__option__label">
                                            {label}
                                        </span>
                                    </span>
                                );
                            }

                            return (
                                <span
                                    class={[
                                        'InvoiceCreateStepBuyerAndLinesBuyerSelect__option',
                                        'InvoiceCreateStepBuyerAndLinesBuyerSelect__option--not-invoiceable',
                                    ]}
                                    v-tooltip={(
                                        beneficiary!.company !== null
                                            ? __('not-invoiceable.tooltip.with-company')
                                            : __('not-invoiceable.tooltip.without-company')
                                    )}
                                >
                                    <span class="InvoiceCreateStepBuyerAndLinesBuyerSelect__option__label">
                                        {label}
                                    </span>
                                    <span class="InvoiceCreateStepBuyerAndLinesBuyerSelect__option__warning">
                                        {__('not-invoiceable.label')}
                                    </span>
                                </span>
                            );
                        }}
                        onInput={handleSelect}
                    />
                );
            }

            const { company } = value;
            const { address: rawAddress, country } = company !== null ? company : value;
            const address = !country.isSame(config.organization.country)
                ? [rawAddress, country.name].join('\n')
                : rawAddress;

            return (
                <div class="InvoiceCreateStepBuyerAndLinesBuyerSelect__selected">
                    <div class="InvoiceCreateStepBuyerAndLinesBuyerSelect__selected__info">
                        <span class="InvoiceCreateStepBuyerAndLinesBuyerSelect__selected__name">
                            <span class="InvoiceCreateStepBuyerAndLinesBuyerSelect__selected__name__value">
                                {company !== null ? company.legal_name : value.full_name}
                            </span>
                        </span>
                        {company !== null && (
                            <span class="InvoiceCreateStepBuyerAndLinesBuyerSelect__selected__contact">
                                {__('global.contact-name', { name: value.full_name })}
                            </span>
                        )}
                        {address !== null && (
                            <address class="InvoiceCreateStepBuyerAndLinesBuyerSelect__selected__address">
                                {address}
                            </address>
                        )}
                    </div>
                    <Button icon="exchange-alt" onClick={handleClear}>
                        {__('change')}
                    </Button>
                </div>
            );
        };

        return (
            <div class="InvoiceCreateStepBuyerAndLinesBuyerSelect">
                {renderContent()}
            </div>
        );
    },
});

export default InvoiceCreateStepBuyerAndLinesBuyerSelect;
