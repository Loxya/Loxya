import { defineComponent } from 'vue';
import { confirm } from '@/utils/alert';
import showModal from '@/utils/showModal';
import SubPage from '../../components/SubPage';
import Loading from '@/themes/default/components/Loading';
import CriticalError from '@/themes/default/components/CriticalError';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import Button from '@/themes/default/components/Button';
import apiBillingCompanies from '@/stores/api/billing-companies';
import { ClientTable, Variant } from '@/themes/default/components/Table';
import Dropdown from '@/themes/default/components/Dropdown';

// - Modales
import CompanyEdition from './modals/CompanyEdition';

import type { CreateElement } from 'vue';
import type { Columns } from '@/themes/default/components/Table/Client';
import type { BillingCompany } from '@/stores/api/billing-companies';

type Data = {
    hasCriticalError: boolean,
    isFetching: boolean,
    isFetched: boolean,
    billingCompanies: BillingCompany[],
};

const CompaniesGlobalSettings = defineComponent({
    name: 'CompaniesGlobalSettings',
    data: (): Data => ({
        hasCriticalError: false,
        isFetching: false,
        isFetched: false,
        billingCompanies: [],
    }),
    computed: {
        columns(): Columns<BillingCompany> {
            const {
                __,
                handleDeleteCompanyClick,
                handleEditCompanyClick,
            } = this;
            return [
                {
                    key: 'name',
                    title: __('columns.name'),
                    render: (h: CreateElement, company: BillingCompany) => company.name,
                },
                {
                    key: 'address',
                    title: __('columns.address'),
                    render: (h: CreateElement, company: BillingCompany) => company.full_address,
                },
                {
                    key: 'actions',
                    render: (h: CreateElement, company: BillingCompany) => (
                        <Dropdown>
                            <Button
                                type="edit"
                                onClick={(e: MouseEvent) => handleEditCompanyClick(e, company.id)}
                            >
                                {__('edit')}
                            </Button>
                            <Button
                                type="delete"
                                onClick={(e: MouseEvent) => handleDeleteCompanyClick(e, company.id)}
                            >
                                {__('delete')}
                            </Button>
                        </Dropdown>
                    ),
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

        async handleClickNewCompany() {
            const newCompany: BillingCompany | undefined = (
                await showModal(this.$modal, CompanyEdition)
            );
            if (!newCompany) {
                return;
            }

            this.billingCompanies.push(newCompany);
        },

        async handleEditCompanyClick(e: MouseEvent, id: BillingCompany['id']) {
            e.stopPropagation();
            const company = this.billingCompanies.find((c) => c.id === id);
            if (!company) {
                return;
            }

            const updatedCompany: BillingCompany | undefined = (
                await showModal(this.$modal, CompanyEdition, { company })
            );
            if (!updatedCompany) {
                return;
            }

            const companyIndex = this.billingCompanies.findIndex((c) => c.id === id);
            if (companyIndex === -1) {
                return;
            }

            this.$set(this.billingCompanies, companyIndex, updatedCompany);
        },

        async handleDeleteCompanyClick(e: MouseEvent, id: BillingCompany['id']) {
            e.stopPropagation();

            const { __ } = this;

            const isConfirmed = await confirm({
                type: 'danger',
                text: __('confirm-delete'),
                confirmButtonText: __(`global.yes-trash`),
            });

            if (!isConfirmed) {
                return;
            }

            try {
                await apiBillingCompanies.remove(id);
                this.$toasted.success(__('deleted'));
                this.fetchData();
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-deleting'));
            }
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData(): Promise<void> {
            if (this.isFetching) {
                return;
            }

            try {
                this.isFetching = true;
                this.billingCompanies = await apiBillingCompanies.all();
            } catch {
                this.hasCriticalError = true;
            } finally {
                this.isFetching = false;
                this.isFetched = true;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.settings.companies.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            hasCriticalError,
            isFetched,
            handleClickNewCompany,
            billingCompanies,
            columns,
        } = this;

        if (hasCriticalError || !isFetched) {
            return (
                <SubPage
                    class="CompaniesGlobalSettings"
                    title={__('title')}
                    help={__('help')}
                    centered
                >
                    {hasCriticalError ? <CriticalError /> : <Loading />}
                </SubPage>
            );
        }

        if (this.billingCompanies.length === 0) {
            return (
                <SubPage
                    class="CompaniesGlobalSettings"
                    title={__('title')}
                    help={__('help')}
                    centered
                >
                    <EmptyMessage
                        message={__('no-company-yet')}
                        action={{
                            type: 'add',
                            label: __('create-a-first-company'),
                            onClick: handleClickNewCompany,
                        }}
                    />
                </SubPage>
            );
        }

        return (
            <SubPage
                class="CompaniesGlobalSettings"
                title={__('title')}
                help={__('help')}
                actions={[
                    <Button
                        type="add"
                        onClick={handleClickNewCompany}
                        collapsible
                    >
                        {__('new-company')}
                    </Button>,
                ]}
            >
                <ClientTable
                    name={__('table.name')}
                    uniqueKey="id"
                    columns={columns}
                    data={billingCompanies}
                    variant={Variant.DEFAULT}
                />
            </SubPage>
        );
    },
});

export default CompaniesGlobalSettings;
