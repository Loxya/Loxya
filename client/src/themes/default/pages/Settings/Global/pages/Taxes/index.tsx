import './index.scss';
import { RequestError } from '@/globals/requester';
import config from '@/globals/config';
import isTruthy from '@/utils/isTruthy';
import { confirm } from '@/utils/alert';
import { defineComponent } from 'vue';
import apiTaxes from '@/stores/api/taxes';
import apiSettings from '@/stores/api/settings';
import formatOptions from '@/utils/formatOptions';
import { ApiErrorCode } from '@/stores/api/@codes';
import Fragment from '@/components/Fragment';
import FormField from '@/themes/default/components/FormField';
import CriticalError from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import Fieldset from '@/themes/default/components/Fieldset';
import { ClientTable } from '@/themes/default/components/Table';
import Button from '@/themes/default/components/Button';
import SubPage from '../../components/SubPage';

// - Modales
import TaxEdition from './modals/TaxEdition';

import type { CreateElement } from 'vue';
import type { Tax } from '@/stores/api/taxes';
import type { Options } from '@/utils/formatOptions';
import type { Settings } from '@/stores/api/settings';
import type { Columns } from '@/themes/default/components/Table/Client';

type Data = {
    taxes: Tax[],
    isFetched: boolean,
    isSaving: boolean,
    hasCriticalError: boolean,
    validationErrors: Record<string, string> | null,
    defaultTaxId: Tax['id'] | null,
};

/** Page des paramètres des taxes. */
const TaxesGlobalSettings = defineComponent({
    name: 'TaxesGlobalSettings',
    data(): Data {
        const currentValues: Settings['billing'] = this.$store.state.settings.billing;

        return {
            taxes: [],
            isFetched: false,
            isSaving: false,
            hasCriticalError: false,
            validationErrors: null,
            defaultTaxId: currentValues.defaultTax,
        };
    },
    computed: {
        isSimpleVatSystem(): boolean {
            const { country } = config.organization;
            return !!country.hasSimpleVatSystem;
        },

        defaultTaxIdSync(): Tax['id'] | null {
            const currentValues: Settings['billing'] = this.$store.state.settings.billing;
            return currentValues.defaultTax;
        },

        taxesOptions(): Options<Tax> {
            const { taxes, isSimpleVatSystem } = this;

            return formatOptions(taxes, (tax: Tax) => {
                if (tax.is_group) {
                    return tax.name;
                }

                return !isSimpleVatSystem && tax.name !== undefined
                    ? `${tax.name} (${tax.value.toString()}%)`
                    : `${tax.value.toString()}%`;
            });
        },

        tableColumns(): Columns<Tax> {
            const {
                __,
                __s,
                defaultTaxId,
                defaultTaxIdSync,
                isSimpleVatSystem,
                handleEdit,
                handleDelete,
            } = this;

            return [
                {
                    key: 'name',
                    title: __s('table-column.name'),
                    sortable: (ascending: boolean) => (
                        (a: Tax, b: Tax): number => {
                            const direction = ascending ? 1 : -1;

                            if (!isSimpleVatSystem) {
                                const nameComparison = (a.name ?? '').localeCompare(b.name ?? '');
                                if (nameComparison !== 0) {
                                    return nameComparison * direction;
                                }
                            }

                            if (!a.is_group && !b.is_group) {
                                const valueComparison = isSimpleVatSystem
                                    ? a.value.comparedTo(b.value)
                                    : b.value.comparedTo(a.value);

                                if (valueComparison !== 0) {
                                    return valueComparison * direction;
                                }
                            }

                            const idComparison = a.id - b.id;
                            return idComparison * direction;
                        }
                    ),
                    render: (h: CreateElement, tax: Tax) => {
                        if (tax.is_group) {
                            return tax.name;
                        }

                        return !isSimpleVatSystem && tax.name !== undefined
                            ? `${tax.name} (${tax.value.toString()}%)`
                            : `${tax.value.toString()}%`;
                    },
                },
                !isSimpleVatSystem && {
                    key: 'is_group',
                    title: __('table-column.is-group'),
                    sortable: (ascending: boolean) => (
                        (a: Tax, b: Tax): number => {
                            if (a.is_group === b.is_group) {
                                return 0;
                            }
                            const result = a.is_group ? 1 : -1;
                            return ascending ? result : -result;
                        }
                    ),
                    render: (h: CreateElement, tax: Tax) => {
                        if (!tax.is_group) {
                            return __('global.no');
                        }

                        const componentsCount = tax.components.length;
                        return componentsCount > 0
                            ? __('yes-with-count-sub-taxes', { count: componentsCount }, componentsCount)
                            : __('global.yes');
                    },
                },
                {
                    key: 'actions',
                    render: (h: CreateElement, tax: Tax) => {
                        const isDefault = defaultTaxIdSync === tax.id || defaultTaxId === tax.id;
                        const isDefaultUnsaved = isDefault && defaultTaxId !== tax.id;
                        const isDeletable = !tax.is_used && !isDefault;

                        return (
                            <Fragment>
                                <Button
                                    icon="edit"
                                    onClick={() => { handleEdit(tax.id); }}
                                />
                                <Button
                                    type="delete"
                                    onClick={() => { handleDelete(tax.id); }}
                                    disabled={!isDeletable}
                                    tooltip={(() => {
                                        if (isDeletable) {
                                            return undefined;
                                        }

                                        if (isDefault && tax.is_used) {
                                            return __('not-deletable.default-and-used');
                                        }

                                        if (tax.is_used) {
                                            return __('not-deletable.used');
                                        }

                                        if (isDefault) {
                                            return isDefaultUnsaved
                                                ? __('not-deletable.default-changed-not-saved')
                                                : __('not-deletable.default');
                                        }

                                        return undefined;
                                    })()}
                                />
                            </Fragment>
                        );
                    },
                },
            ].filter(isTruthy);
        },
    },
    mounted() {
        this.fetchData();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleSubmit(e: SubmitEvent) {
            e.preventDefault();

            if (this.isSaving) {
                return;
            }

            this.isSaving = true;
            const { __, defaultTaxId } = this;

            try {
                await apiSettings.update({
                    billing: { defaultTax: defaultTaxId },
                });

                this.validationErrors = null;

                this.$store.dispatch('settings/fetch');
                this.$toasted.success(__('saved'));
            } catch (error) {
                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    return;
                }
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            } finally {
                this.isSaving = false;
            }
        },

        async handleCreate() {
            // - On affiche la modale de création de taxe.
            const newTax: Tax | undefined = (
                await this.$modal.show(TaxEdition)
            );
            if (!newTax) {
                return;
            }

            // - On ajoute la taxe directement vu qu'on les a toutes récupérées.
            this.taxes.push(newTax);
        },

        async handleEdit(taxId: Tax['id']) {
            // - Si la taxe n'existe pas, on ne va pas plus loin, sinon on la récupère.
            const tax = this.taxes.find((_tax: Tax) => _tax.id === taxId);
            if (!tax) {
                return;
            }

            // - On affiche la modale d'édition de la taxe.
            const updatedTax: Tax | undefined = (
                await this.$modal.show(TaxEdition, { tax })
            );
            if (!updatedTax) {
                return;
            }

            // - NOTE: On utilise pas `.indexOf()` car la référence
            //         de la taxe a pu changer depuis.
            const taxIndex = this.taxes.findIndex((_tax: Tax) => _tax.id === tax.id);
            if (taxIndex === -1) {
                return;
            }

            // - On modifie la taxe directement vu qu'on les a toutes récupérées.
            this.$set(this.taxes, taxIndex, updatedTax);
        },

        async handleDelete(taxId: Tax['id']) {
            // - Si la taxe n'existe pas, on ne va pas plus loin, sinon on la récupère.
            const tax = this.taxes.find((_tax: Tax) => _tax.id === taxId);
            if (!tax) {
                return;
            }

            const isDeletable = !tax.is_used && this.defaultTaxIdSync !== tax.id;
            if (!isDeletable) {
                return;
            }

            const { __ } = this;
            const isConfirmed = await confirm({
                type: 'danger',
                text: __('confirm-delete'),
                confirmButtonText: __('global.yes-delete'),
            });
            if (!isConfirmed) {
                return;
            }

            // - On supprime la taxe de manière optimiste, au pire on la remettra à sa position.
            const taxIndex = this.taxes.indexOf(tax);
            this.taxes.splice(taxIndex, 1);

            try {
                await apiTaxes.remove(tax.id);
                this.$store.dispatch('taxes/refresh');
            } catch {
                this.taxes.splice(taxIndex, 0, tax);
                this.$toasted.error(__('global.errors.unexpected-while-deleting'));
            }
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData() {
            try {
                this.taxes = await apiTaxes.all();
                this.isFetched = true;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving taxes data:`, error);
                this.hasCriticalError = true;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.settings.taxes.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },

        __s(key: string, params?: Record<string, number | string>, count?: number): string {
            const systemSuffix = this.isSimpleVatSystem ? 'simple' : 'default';
            return this.__(`${key}.${systemSuffix}`, params, count);
        },
    },
    render() {
        const {
            __,
            __s,
            taxes,
            taxesOptions,
            tableColumns,
            isSaving,
            isFetched,
            isSimpleVatSystem,
            hasCriticalError,
            validationErrors,
            handleCreate,
            handleSubmit,
        } = this;

        if (hasCriticalError || !isFetched) {
            return (
                <SubPage class="TaxesGlobalSettings" title={__s('title')} help={__s('help')} centered>
                    {hasCriticalError ? <CriticalError /> : <Loading />}
                </SubPage>
            );
        }

        return (
            <SubPage
                class="TaxesGlobalSettings"
                title={__s('title')}
                help={__s('help')}
                hasValidationError={!!validationErrors}
            >
                <form class="TaxesGlobalSettings__form" onSubmit={handleSubmit}>
                    <FormField
                        type="select"
                        label={__s('default-field.label')}
                        placeholder={__s('default-field.placeholder')}
                        options={taxesOptions}
                        value={this.defaultTaxId}
                        error={validationErrors?.['billing.defaultTax']}
                        onInput={(value: Tax['id']) => {
                            this.defaultTaxId = value;
                        }}
                    />
                    <section class="TaxesGlobalSettings__form__actions">
                        <Button icon="save" htmlType="submit" type="primary" loading={isSaving}>
                            {isSaving ? __('global.saving') : __('global.save')}
                        </Button>
                    </section>
                </form>
                <Fieldset
                    title={__s('section-title')}
                    class="TaxesGlobalSettings__taxes"
                    actions={[
                        <Button type="add" size="small" onClick={handleCreate}>
                            {__s('create-action')}
                        </Button>,
                    ]}
                >
                    <ClientTable
                        data={taxes}
                        columns={tableColumns}
                        defaultOrderBy={{
                            column: 'name',
                            ascending: !isSimpleVatSystem,
                        }}
                    />
                </Fieldset>
            </SubPage>
        );
    },
});

export default TaxesGlobalSettings;
