import './index.scss';
import { defineComponent } from 'vue';
import config, { BillingMode } from '@/globals/config';
import parseInteger from '@/utils/parseInteger';
import apiBeneficiaries from '@/stores/api/beneficiaries';
import { RequestError, HttpCode } from '@/globals/requester';
import Page from '@/themes/default/components/Page';
import Alert from '@/themes/default/components/Alert';
import CriticalError, { ErrorType } from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import { Tabs, Tab } from '@/themes/default/components/Tabs';
import Button from '@/themes/default/components/Button';

// - Tabs
import Infos from './tabs/Infos';
import Billing from './tabs/Billing';
import Borrowings from './tabs/Borrowings';

import type { BeneficiaryDetails } from '@/stores/api/beneficiaries';

enum TabName {
    INFO = '#infos',
    BILLING = '#billing',
    BORROWINGS = '#borrowings',
}

type Data = {
    id: number,
    beneficiary: BeneficiaryDetails | null,
    isLoading: boolean,
    isFetched: boolean,
    selectedTab: TabName,
    criticalError: ErrorType | null,
};

/** Page de détails d'un bénéficiaire. */
const BeneficiaryView = defineComponent({
    name: 'BeneficiaryView',
    data(): Data {
        return {
            id: parseInteger(this.$route.params.id)!,
            beneficiary: null,
            isLoading: false,
            isFetched: false,
            selectedTab: TabName.INFO,
            criticalError: null,
        };
    },
    computed: {
        pageTitle(): string {
            const { __, isFetched, beneficiary } = this;

            return isFetched && beneficiary
                ? __('title', { name: beneficiary.full_name })
                : __('title-simple');
        },

        isBillingEnabled(): boolean {
            return config.billingMode !== BillingMode.NONE;
        },

        tabsActions(): JSX.Element[] {
            const { __, id, selectedTab } = this;

            switch (selectedTab) {
                case TabName.INFO: {
                    return [
                        <Button
                            type="edit"
                            to={{
                                name: 'edit-beneficiary',
                                params: { id: id.toString() },
                            }}
                            collapsible
                        >
                            {__('global.action-edit')}
                        </Button>,
                    ];
                }
                default: {
                    return [];
                }
            }
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

        handleTabChanged(id: TabName) {
            this.selectedTab = id;
            this.$router.replace(id);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        selectTabFromRouting() {
            const { hash } = this.$route;
            if (hash && (Object.values(TabName) as string[]).includes(hash)) {
                this.selectedTab = hash as TabName;
            }
        },

        async fetchData() {
            this.isLoading = true;
            try {
                const data = await apiBeneficiaries.one(this.id);
                this.beneficiary = data;
                this.selectTabFromRouting();
                this.isFetched = true;
            } catch (error) {
                if (error instanceof RequestError && error.httpCode === HttpCode.NotFound) {
                    this.criticalError = ErrorType.NOT_FOUND;
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving beneficiary #${this.id} data`, error);
                this.criticalError = ErrorType.UNKNOWN;
            } finally {
                this.isLoading = false;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.beneficiary-view.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            id,
            pageTitle,
            isBillingEnabled,
            tabsActions,
            isLoading,
            isFetched,
            selectedTab,
            beneficiary,
            criticalError,
            handleTabChanged,
        } = this;

        if (criticalError || !isFetched) {
            return (
                <Page name="beneficiary-view" title={pageTitle} centered>
                    {criticalError ? <CriticalError type={criticalError} /> : <Loading />}
                </Page>
            );
        }

        const { company, stats, is_invoiceable: isInvoiceable } = beneficiary!;

        const renderNotInvoiceableWarning = (): JSX.Element | null => {
            if (!isBillingEnabled || isInvoiceable) {
                return null;
            }

            const translationKey = company !== null
                ? 'warnings.not-invoiceable.with-company'
                : 'warnings.not-invoiceable.without-company';

            return (
                <Alert
                    type="warning"
                    class="BeneficiaryView__not-invoiceable"
                    action={{
                        label: __(`${translationKey}.action`),
                        target: (
                            company !== null
                                ? { name: 'edit-company', params: { id: company.id.toString() } }
                                : { name: 'edit-beneficiary', params: { id: id.toString() } }
                        ),
                        icon: 'edit',
                    }}
                >
                    {__(`${translationKey}.message`)}
                </Alert>
            );
        };

        return (
            <Page name="beneficiary-view" title={pageTitle} loading={isLoading}>
                <div class="BeneficiaryView">
                    {renderNotInvoiceableWarning()}
                    <Tabs defaultActive={selectedTab} actions={tabsActions} onChanged={handleTabChanged}>
                        <Tab id={TabName.INFO} title={__('global.informations')} icon="info-circle">
                            <Infos beneficiary={beneficiary!} />
                        </Tab>
                        {isBillingEnabled && (
                            <Tab id={TabName.BILLING} title={__('billing.title')} icon="file-invoice">
                                <Billing beneficiary={beneficiary!} />
                            </Tab>
                        )}
                        <Tab
                            id={TabName.BORROWINGS}
                            title={__('borrowings.title', { count: stats.borrowings })}
                            icon="calendar-alt"
                        >
                            <Borrowings beneficiary={beneficiary!} />
                        </Tab>
                    </Tabs>
                </div>
            </Page>
        );
    },
});

export default BeneficiaryView;
