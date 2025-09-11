import './index.scss';
import { defineComponent } from 'vue';
import config, { BillingMode } from '@/globals/config';
import parseInteger from '@/utils/parseInteger';
import apiBeneficiaries from '@/stores/api/beneficiaries';
import { RequestError, HttpCode } from '@/globals/requester';
import Page from '@/themes/default/components/Page';
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
    selectedTabIndex: number,
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
            selectedTabIndex: 0,
            criticalError: null,
        };
    },
    computed: {
        pageTitle(): string | undefined {
            const { $t: __, isFetched, beneficiary } = this;

            return isFetched && beneficiary
                ? __('page.beneficiary-view.title', { name: beneficiary.full_name })
                : __('page.beneficiary-view.title-simple');
        },

        withBilling(): boolean {
            return config.billingMode !== BillingMode.NONE;
        },

        tabsIndexes(): string[] {
            const tabs = Object.values(TabName);
            return !this.withBilling
                ? tabs.filter((tab: string) => tab !== TabName.BILLING)
                : tabs;
        },

        tabsActions(): JSX.Element[] {
            const { $t: __, id, tabsIndexes, selectedTabIndex } = this;

            switch (tabsIndexes[selectedTabIndex]) {
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
                            {__('action-edit')}
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

        handleTabChanged(index: number) {
            this.selectedTabIndex = index;
            this.$router.replace(this.tabsIndexes[index]);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        selectTabFromRouting() {
            const { hash } = this.$route;
            if (hash && this.tabsIndexes.includes(hash)) {
                this.selectedTabIndex = this.tabsIndexes.indexOf(hash);
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
    },
    render() {
        const {
            $t: __,
            pageTitle,
            withBilling,
            tabsActions,
            isLoading,
            isFetched,
            criticalError,
            beneficiary,
            handleTabChanged,
            selectedTabIndex,
        } = this;

        if (criticalError || !isFetched) {
            return (
                <Page name="beneficiary-view" title={pageTitle} centered>
                    {criticalError ? <CriticalError type={criticalError} /> : <Loading />}
                </Page>
            );
        }

        const { stats } = beneficiary!;

        return (
            <Page name="beneficiary-view" title={pageTitle} loading={isLoading}>
                <div class="BeneficiaryView">
                    <Tabs
                        actions={tabsActions}
                        defaultIndex={selectedTabIndex}
                        onChanged={handleTabChanged}
                    >
                        <Tab title={__('informations')} icon="info-circle">
                            <Infos beneficiary={beneficiary!} />
                        </Tab>
                        {withBilling && (
                            <Tab title={__('page.beneficiary-view.billing.title')} icon="file-invoice">
                                <Billing beneficiary={beneficiary!} />
                            </Tab>
                        )}
                        <Tab
                            title={__('page.beneficiary-view.borrowings.title', { count: stats.borrowings })}
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
