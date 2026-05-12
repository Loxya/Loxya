import './index.scss';
import parseInteger from '@/utils/parseInteger';
import { RequestError, HttpCode } from '@/globals/requester';
import { defineComponent } from 'vue';
import apiMaterials from '@/stores/api/materials';
import { confirm } from '@/utils/alert';
import Page from '@/themes/default/components/Page';
import CriticalError, { ErrorType } from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import { Tabs, Tab } from '@/themes/default/components/Tabs';
import Button from '@/themes/default/components/Button';

// - Tabs
import Infos from './tabs/Infos';
import Documents from './tabs/Documents';

import type { ComponentRef } from 'vue';
import type { TabChangeEvent } from '@/themes/default/components/Tabs';
import type { MaterialDetails as Material } from '@/stores/api/materials';

type InstanceProperties = {
    fetchInterval: ReturnType<typeof setInterval> | undefined,
};

type Data = {
    id: Material['id'],
    material: Material | null,
    isFetched: boolean,
    selectedTab: TabName,
    criticalError: ErrorType | null,
};

enum TabName {
    INFOS = '#infos',
    DOCUMENTS = '#documents',
}

/** Page de détails d'un matériel. */
const MaterialView = defineComponent({
    name: 'MaterialView',
    setup: (): InstanceProperties => ({
        fetchInterval: undefined,
    }),
    data(): Data {
        return {
            id: parseInteger(this.$route.params.id)!,
            material: null,
            isFetched: false,
            selectedTab: TabName.INFOS,
            criticalError: null,
        };
    },
    computed: {
        pageTitle(): string {
            const { $t: __, isFetched, material } = this;

            return isFetched
                ? __('page.material-view.title', { name: material!.name })
                : __('page.material-view.title-simple');
        },

        tabsActions(): JSX.Element[] {
            const { $t: __, id, isFetched, selectedTab } = this;

            switch (selectedTab) {
                case TabName.INFOS: {
                    if (!isFetched) {
                        return [];
                    }

                    return [
                        <Button
                            type="edit"
                            to={{
                                name: 'edit-material',
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
        this.$store.dispatch('categories/fetch');

        this.fetchInterval = setInterval(this.fetchData, 60_000); // - 1 minute.
        this.fetchData();
    },
    beforeDestroy() {
        if (this.fetchInterval) {
            clearInterval(this.fetchInterval);
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleTabChange(event: TabChangeEvent) {
            if (event.prevId !== TabName.DOCUMENTS) {
                return;
            }

            const $documents = this.$refs.documents as ComponentRef<typeof Documents>;
            if (!$documents?.isUploading()) {
                return;
            }

            event.preventDefault();

            const { $t: __ } = this;
            const isConfirmed = await confirm({
                type: 'danger',
                text: __('confirm-cancel-upload-change-tab'),
            });
            if (!isConfirmed) {
                return;
            }

            event.executeDefault();
        },

        handleTabChanged(id: TabName) {
            this.selectedTab = id;
            this.$router.replace(id);
        },

        handleOutdated() {
            this.fetchData();
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
            try {
                const data = await apiMaterials.one(this.id);
                this.material = data;
                this.selectTabFromRouting();
                this.isFetched = true;
            } catch (error) {
                // - On ne tente pas de refetch si on est en erreur critique...
                if (this.fetchInterval) {
                    clearInterval(this.fetchInterval);
                }

                if (error instanceof RequestError && error.httpCode === HttpCode.NotFound) {
                    this.criticalError = ErrorType.NOT_FOUND;
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving material #${this.id} data`, error);
                this.criticalError = ErrorType.UNKNOWN;
            }
        },
    },
    render() {
        const {
            $t: __,
            pageTitle,
            tabsActions,
            isFetched,
            criticalError,
            material,
            handleTabChange,
            handleTabChanged,
            selectedTab,
        } = this;

        if (criticalError || !isFetched) {
            return (
                <Page name="material-view" title={pageTitle} centered>
                    {criticalError ? <CriticalError type={criticalError} /> : <Loading />}
                </Page>
            );
        }

        return (
            <Page name="material-view" title={pageTitle}>
                <div class="MaterialView">
                    <Tabs
                        defaultActive={selectedTab}
                        onChange={handleTabChange}
                        onChanged={handleTabChanged}
                        actions={tabsActions}
                    >
                        <Tab id={TabName.INFOS} title={__('informations')} icon="info-circle">
                            <Infos material={material!} />
                        </Tab>
                        <Tab id={TabName.DOCUMENTS} title={__('documents')} icon="file-pdf">
                            <Documents ref="documents" material={material!} />
                        </Tab>
                    </Tabs>
                </div>
            </Page>
        );
    },
});

export default MaterialView;
