import './index.scss';
import { RequestError } from '@/globals/requester';
import { confirm } from '@/utils/alert';
import { defineComponent } from 'vue';
import showModal from '@/utils/showModal';
import apiDegressiveRates from '@/stores/api/degressive-rates';
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
import DegressiveRateEdition from './modals/DegressiveRateEdition';

import type { CreateElement } from 'vue';
import type { DegressiveRate } from '@/stores/api/degressive-rates';
import type { Options } from '@/utils/formatOptions';
import type { Settings } from '@/stores/api/settings';
import type { Columns } from '@/themes/default/components/Table/Client';

type Data = {
    degressiveRates: DegressiveRate[],
    isFetched: boolean,
    isSaving: boolean,
    hasCriticalError: boolean,
    validationErrors: Record<string, string> | null,
    defaultDegressiveRateId: DegressiveRate['id'] | null,
};

/** Page des paramètres des tarifs dégressifs. */
const DegressiveRatesGlobalSettings = defineComponent({
    name: 'DegressiveRatesGlobalSettings',
    data(): Data {
        const currentValues: Settings['billing'] = this.$store.state.settings.billing;

        return {
            degressiveRates: [],
            isFetched: false,
            isSaving: false,
            hasCriticalError: false,
            validationErrors: null,
            defaultDegressiveRateId: currentValues.defaultDegressiveRate,
        };
    },
    computed: {
        defaultDegressiveRateIdSync(): DegressiveRate['id'] | null {
            const currentValues: Settings['billing'] = this.$store.state.settings.billing;
            return currentValues.defaultDegressiveRate;
        },

        degressiveRatesOptions(): Options<DegressiveRate> {
            return formatOptions(this.degressiveRates);
        },

        tableColumns(): Columns<DegressiveRate> {
            const {
                __,
                defaultDegressiveRateId,
                defaultDegressiveRateIdSync,
                handleEdit,
                handleDelete,
            } = this;

            return [
                {
                    key: 'name',
                    title: __('table-column.name'),
                    sortable: true,
                    render: (h: CreateElement, { name }: DegressiveRate) => name,
                },
                {
                    key: 'actions',
                    render: (h: CreateElement, degressiveRate: DegressiveRate) => {
                        const isDefault = (
                            defaultDegressiveRateIdSync === degressiveRate.id ||
                            defaultDegressiveRateId === degressiveRate.id
                        );
                        const isDefaultUnsaved = (
                            isDefault &&
                            defaultDegressiveRateId !== degressiveRate.id
                        );
                        const isDeletable = !degressiveRate.is_used && !isDefault;

                        return (
                            <Fragment>
                                <Button
                                    icon="edit"
                                    onClick={() => { handleEdit(degressiveRate.id); }}
                                />
                                <Button
                                    type="delete"
                                    onClick={() => { handleDelete(degressiveRate.id); }}
                                    disabled={!isDeletable}
                                    tooltip={(() => {
                                        if (isDeletable) {
                                            return undefined;
                                        }

                                        if (isDefault && degressiveRate.is_used) {
                                            return __('not-deletable.default-and-used');
                                        }

                                        if (degressiveRate.is_used) {
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
            ];
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
            const { __, defaultDegressiveRateId } = this;

            try {
                await apiSettings.update({
                    billing: { defaultDegressiveRate: defaultDegressiveRateId },
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
            // - On affiche la modale de création de tarif dégressif.
            const newDegressiveRate: DegressiveRate | undefined = (
                await showModal(this.$modal, DegressiveRateEdition)
            );
            if (!newDegressiveRate) {
                return;
            }

            // - On ajoute le tarif dégressif directement vu qu'on les a tous récupérés.
            this.degressiveRates.push(newDegressiveRate);
        },

        async handleEdit(degressiveRateId: DegressiveRate['id']) {
            // - Si le tarif dégressif n'existe pas, on ne va pas plus loin, sinon on le récupère.
            const degressiveRate = this.degressiveRates.find(
                (_degressiveRate: DegressiveRate) => (
                    _degressiveRate.id === degressiveRateId
                ),
            );
            if (!degressiveRate) {
                return;
            }

            // - On affiche la modale d'édition du tarif dégressif.
            const updatedDegressiveRate: DegressiveRate | undefined = (
                await showModal(this.$modal, DegressiveRateEdition, { degressiveRate })
            );
            if (!updatedDegressiveRate) {
                return;
            }

            // - NOTE: On utilise pas `.indexOf()` car la référence
            //         du tarif dégressif a pu changer depuis.
            const degressiveRateIndex = this.degressiveRates.findIndex(
                (_degressiveRate: DegressiveRate) => (
                    _degressiveRate.id === degressiveRate.id
                ),
            );
            if (degressiveRateIndex === -1) {
                return;
            }

            // - On modifie le tarif dégressif directement vu qu'on les a tous récupérés.
            this.$set(this.degressiveRates, degressiveRateIndex, updatedDegressiveRate);
        },

        async handleDelete(degressiveRateId: DegressiveRate['id']) {
            // - Si le tarif dégressif n'existe pas, on ne va pas plus loin, sinon on le récupère.
            const degressiveRate = this.degressiveRates.find(
                (_degressiveRate: DegressiveRate) => (
                    _degressiveRate.id === degressiveRateId
                ),
            );
            if (!degressiveRate) {
                return;
            }

            const isDeletable = (
                !degressiveRate.is_used &&
                this.defaultDegressiveRateIdSync !== degressiveRate.id
            );
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

            // - On supprime le tarif dégressif de manière optimiste, au pire on le remettra plus bas.
            const degressiveRateIndex = this.degressiveRates.indexOf(degressiveRate);
            this.degressiveRates.splice(degressiveRateIndex, 1);

            try {
                await apiDegressiveRates.remove(degressiveRate.id);
                this.$store.dispatch('degressiveRates/refresh');
            } catch {
                this.degressiveRates.push(degressiveRate);
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
                this.degressiveRates = await apiDegressiveRates.all();
                this.isFetched = true;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving degressive rates data:`, error);
                this.hasCriticalError = true;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.settings.degressive-rates.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            degressiveRates,
            degressiveRatesOptions,
            tableColumns,
            isSaving,
            isFetched,
            hasCriticalError,
            validationErrors,
            handleCreate,
            handleSubmit,
        } = this;

        if (hasCriticalError || !isFetched) {
            return (
                <SubPage class="DegressiveRatesGlobalSettings" title={__('title')} help={__('help')} centered>
                    {hasCriticalError ? <CriticalError /> : <Loading />}
                </SubPage>
            );
        }

        return (
            <SubPage
                class="DegressiveRatesGlobalSettings"
                title={__('title')}
                help={__('help')}
                hasValidationError={!!validationErrors}
            >
                <form class="DegressiveRatesGlobalSettings__form" onSubmit={handleSubmit}>
                    <FormField
                        type="select"
                        label={__('default-field.label')}
                        placeholder={__('default-field.placeholder')}
                        options={degressiveRatesOptions}
                        v-model={this.defaultDegressiveRateId}
                        error={validationErrors?.['billing.defaultDegressiveRate']}
                    />
                    <section class="DegressiveRatesGlobalSettings__form__actions">
                        <Button icon="save" htmlType="submit" type="primary" loading={isSaving}>
                            {isSaving ? __('global.saving') : __('global.save')}
                        </Button>
                    </section>
                </form>
                <Fieldset
                    title={__('section-title')}
                    class="DegressiveRatesGlobalSettings__degressive-rates"
                    actions={[
                        <Button type="add" size="small" onClick={handleCreate}>
                            {__('create-action')}
                        </Button>,
                    ]}
                >
                    <ClientTable
                        data={degressiveRates}
                        columns={tableColumns}
                        defaultOrderBy="name"
                    />
                </Fieldset>
            </SubPage>
        );
    },
});

export default DegressiveRatesGlobalSettings;
