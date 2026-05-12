import './index.scss';
import { defineComponent } from 'vue';
import debounce from 'lodash/debounce';
import apiBeneficiaries from '@/stores/api/beneficiaries';
import formatOptions from '@/utils/formatOptions';
import { DEBOUNCE_WAIT_DURATION } from '@/globals/constants';
import Button from '@/themes/default/components/Button';
import Fragment from '@/components/Fragment';
import IconMessage from '@/themes/default/components/IconMessage';
import FormField from '@/themes/default/components/FormField';
import Select from '@/themes/default/components/Select';

import type { PropType } from 'vue';
import type { DebouncedMethod } from 'lodash';
import type { Option, Options } from '@/utils/formatOptions';
import type { Beneficiary } from '@/stores/api/beneficiaries';
import type { SelectRef } from '@/themes/default/components/Select';

type Props = {
    /**
     * Les bénéficiaires sélectionnés à l'affichage du champ.
     *
     * Note: Cette prop. ne permet PAS de contrôler le champ mais
     *       uniquement de fournir une liste de départ.
     */
    defaultValues?: Beneficiary[],

    /**
     * Fonction appelée lorsque la liste des bénéficiaires a été modifiée.
     *
     * @param ids - Liste des identifiants des bénéficiaires sélectionnés.
     */
    onChange?(ids: Array<Beneficiary['id']>): void,
};

type InstanceProperties = {
    debouncedSearch: (
        | DebouncedMethod<typeof EventEditStepBeneficiariesSelect, 'search'>
        | undefined
    ),
};

type Data = {
    values: Beneficiary[],
    showNewItemForm: boolean,
    beneficiaries: Beneficiary[],
};

const getItemLabel = (beneficiary: Beneficiary): string => {
    const { full_name: fullName, reference, company } = beneficiary;

    let label = fullName;
    if (reference && reference.length > 0) {
        label += ` (${reference})`;
    }
    if (company && company.legal_name.length > 0) {
        label += ` − ${company.legal_name}`;
    }

    return label;
};

/** Champ de formulaire de sélection d'un ou plusieurs bénéficiaires */
const EventEditStepBeneficiariesSelect = defineComponent({
    name: 'EventEditStepBeneficiariesSelect',
    props: {
        defaultValues: {
            type: Array as PropType<Required<Props>['defaultValues']>,
            default: () => [],
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
        return {
            values: [...this.defaultValues],
            beneficiaries: [],
            showNewItemForm: this.defaultValues.length === 0,
        };
    },
    computed: {
        valuesIds(): Array<Beneficiary['id']> {
            return this.values.map((beneficiary: Beneficiary) => beneficiary.id);
        },

        options(): Options<Beneficiary> {
            return formatOptions(
                this.beneficiaries.filter(({ id }: Beneficiary) => (
                    !this.valuesIds.includes(id)
                )),
                (beneficiary: Beneficiary) => getItemLabel(beneficiary),
            );
        },
    },
    watch: {
        showNewItemForm: {
            handler(shouldShow: boolean) {
                if (!shouldShow) {
                    return;
                }

                this.$nextTick(() => {
                    const $input = this.$refs.input as SelectRef;
                    $input?.focus();
                });
            },
            immediate: true,
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

        handleAddItem() {
            this.showNewItemForm = true;
        },

        handleCancelAddItem() {
            this.showNewItemForm = false;
        },

        handleRemoveItem(e: MouseEvent, id: Beneficiary['id']) {
            e.preventDefault();

            this.values = this.values.filter((value: Beneficiary) => value.id !== id);
            this.$emit('change', this.valuesIds);
        },

        handleSelectNewValue(value: Beneficiary['id'] | null) {
            if (value === null) {
                return;
            }

            const selectedValue = this.beneficiaries.find(
                ({ id }: Beneficiary) => id === value,
            );
            if (selectedValue === undefined) {
                return;
            }

            this.values.push(selectedValue);
            this.$emit('change', this.valuesIds);
            this.showNewItemForm = false;
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async search(search: string): Promise<void> {
            try {
                const { data } = await apiBeneficiaries.all({ search, limit: 20 });
                this.beneficiaries = data;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error while searching a beneficiary (term: "${search}").`, error);
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.event-edit.steps.beneficiaries.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            values,
            options,
            showNewItemForm,
            debouncedSearch,
            handleAddItem,
            handleRemoveItem,
            handleSelectNewValue,
            handleCancelAddItem,
        } = this;

        const classNames = ['EventEditStepBeneficiariesSelect', {
            'EventEditStepBeneficiariesSelect--empty': values.length === 0 && !showNewItemForm,
        }];

        return (
            <div class={classNames}>
                {values.map((beneficiary: Beneficiary, index: number) => (
                    <FormField
                        key={beneficiary.id || `unknown-${index}`}
                        class="EventEditStepBeneficiariesSelect__field"
                        type="custom"
                        label={(
                            index > 0
                                ? __('numbered-label', { number: index + 1 })
                                : __('main-beneficiary')
                        )}
                    >
                        <div class="EventEditStepBeneficiariesSelect__item">
                            <div class="EventEditStepBeneficiariesSelect__item__value">
                                {!beneficiary && (
                                    <IconMessage
                                        name="exclamation-triangle"
                                        class="EventEditStepBeneficiariesSelect__item__value__error"
                                        message={__('beneficiary-not-found')}
                                    />
                                )}
                                {beneficiary && (
                                    <Fragment>
                                        <span class="EventEditStepBeneficiariesSelect__item__value__name">
                                            {getItemLabel(beneficiary)}
                                        </span>
                                    </Fragment>
                                )}
                            </div>
                            <Button
                                type="trash"
                                class="EventEditStepBeneficiariesSelect__item__action"
                                aria-label={__('remove-beneficiary')}
                                onClick={(e: MouseEvent) => { handleRemoveItem(e, beneficiary.id); }}
                            />
                        </div>
                    </FormField>
                ))}
                {showNewItemForm && (
                    <FormField
                        class="EventEditStepBeneficiariesSelect__field"
                        type="custom"
                        label={(
                            values.length > 0
                                ? __('numbered-label', { number: values.length + 1 })
                                : __('main-beneficiary')
                        )}
                    >
                        <div class="EventEditStepBeneficiariesSelect__item">
                            <Select
                                ref="input"
                                value={null}
                                options={options}
                                searcher={debouncedSearch}
                                onInput={handleSelectNewValue}
                                class="EventEditStepBeneficiariesSelect__item__field"
                                placeholder={__('global.please-choose')}
                                renderer={({ label }: Option<Beneficiary>) => (
                                    <span class="EventEditStepBeneficiariesSelect__option">
                                        <span class="EventEditStepBeneficiariesSelect__option__name">
                                            {label}
                                        </span>
                                    </span>
                                )}
                                noOptionsRenderer={(currentSearch: string) => (
                                    currentSearch.length === 0 ? null : (
                                        <Fragment>
                                            <p>{__('global.no-result-found-try-another-search')}</p>
                                            <Button type="add" to={{ name: 'add-beneficiary' }}>
                                                {__('create-a-beneficiary')}
                                            </Button>
                                        </Fragment>
                                    )
                                )}
                            />
                            <Button
                                icon="ban"
                                type="danger"
                                class="EventEditStepBeneficiariesSelect__item__action"
                                aria-label={__('cancel-add-beneficiary')}
                                onClick={handleCancelAddItem}
                            />
                        </div>
                    </FormField>
                )}
                <div class="EventEditStepBeneficiariesSelect__actions">
                    {!showNewItemForm && (
                        <Button type="add" onClick={handleAddItem}>
                            {__('add-beneficiary')}
                        </Button>
                    )}
                </div>
            </div>
        );
    },
});

export default EventEditStepBeneficiariesSelect;
