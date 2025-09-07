import './index.scss';
import { RequestError, HttpCode } from '@/globals/requester';
import config from '@/globals/config';
import parseInteger from '@/utils/parseInteger';
import apiTechnicians from '@/stores/api/technicians';
import { defineComponent } from 'vue';
import { confirm } from '@/utils/alert';
import { Tabs, Tab } from '@/themes/default/components/Tabs';
import CriticalError, { ErrorType } from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import Page from '@/themes/default/components/Page';
import Button from '@/themes/default/components/Button';
import MultiSwitch from '@/themes/default/components/MultiSwitch';

// - Tabs
import Infos from './tabs/Infos';
import Schedule from './tabs/Schedule';
import Documents from './tabs/Documents';
import Assignments, { AssignmentListDisplayMode } from './tabs/Assignments';

import type { ComponentRef } from 'vue';
import type { Technician, TechnicianDetails } from '@/stores/api/technicians';
import type { TabChangeEvent } from '@/themes/default/components/Tabs';

type Data = {
    id: Technician['id'],
    technician: TechnicianDetails | null,
    isFetched: boolean,
    criticalError: ErrorType | null,
    selectedTabIndex: number,
    assignmentsDisplayMode: AssignmentListDisplayMode,
};

enum TabName {
    INFOS = '#infos',
    SCHEDULE = '#schedule',
    DOCUMENTS = '#documents',
    ASSIGNMENTS = '#assignments',
}

/** Page de détails d'un technicien. */
const TechnicianView = defineComponent({
    name: 'TechnicianView',
    data(): Data {
        return {
            id: parseInteger(this.$route.params.id)!,
            technician: null,
            isFetched: false,
            criticalError: null,
            selectedTabIndex: 0,
            assignmentsDisplayMode: AssignmentListDisplayMode.DEFAULT,
        };
    },
    computed: {
        isEnabled(): boolean {
            return config.features.technicians;
        },

        pageTitle(): string {
            const { $t: __, isFetched, technician } = this;

            return isFetched
                ? __('page.technician-view.title', { name: technician!.full_name })
                : __('page.technician-view.title-simple');
        },

        tabsIndexes(): string[] {
            return Object.values(TabName);
        },

        tabsActions(): JSX.Element[] {
            const { $t: __, tabsIndexes, selectedTabIndex } = this;

            if (tabsIndexes[selectedTabIndex] === TabName.INFOS) {
                const { id } = this;

                return [
                    <Button
                        type="edit"
                        to={{
                            name: 'edit-technician',
                            params: { id: id.toString() },
                        }}
                        collapsible
                    >
                        {__('action-edit')}
                    </Button>,
                ];
            }

            if (tabsIndexes[selectedTabIndex] === TabName.ASSIGNMENTS) {
                const modes = [
                    {
                        label: __('page.technician-view.assignments.simple-list'),
                        value: AssignmentListDisplayMode.DEFAULT,
                    },
                    {
                        label: __('page.technician-view.assignments.by-event'),
                        value: AssignmentListDisplayMode.BY_EVENT,
                    },
                    {
                        label: __('page.technician-view.assignments.by-position'),
                        value: AssignmentListDisplayMode.BY_POSITION,
                    },
                ];
                return [
                    <MultiSwitch
                        options={modes}
                        onChange={this.handleChangeAssignmentDisplayMode}
                        value={this.assignmentsDisplayMode}
                    />,
                ];
            }

            return [];
        },
    },
    mounted() {
        if (!this.isEnabled) {
            this.$router.replace({ name: 'home' });
        }

        this.fetchData();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleTabChange(event: TabChangeEvent) {
            if (this.tabsIndexes[event.prevIndex] !== TabName.DOCUMENTS) {
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

        handleTabChanged(index: number) {
            this.selectedTabIndex = index;
            this.$router.replace(this.tabsIndexes[index]);
        },

        handleChangeAssignmentDisplayMode(newMode: AssignmentListDisplayMode) {
            this.assignmentsDisplayMode = newMode;
        },

        // ------------------------------------------------------
        // -
        // -    Internal Methods
        // -
        // ------------------------------------------------------

        selectTabFromRouting() {
            const { hash } = this.$route;
            if (hash && this.tabsIndexes.includes(hash)) {
                this.selectedTabIndex = this.tabsIndexes.indexOf(hash);
            }
        },

        async fetchData() {
            try {
                this.technician = await apiTechnicians.one(this.id);
                this.selectTabFromRouting();
                this.isFetched = true;
            } catch (error) {
                if (error instanceof RequestError && error.httpCode === HttpCode.NotFound) {
                    this.criticalError = ErrorType.NOT_FOUND;
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving technician #${this.id} data`, error);
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
            technician,
            selectedTabIndex,
            handleTabChange,
            handleTabChanged,
            assignmentsDisplayMode,
        } = this;

        if (criticalError || !isFetched) {
            return (
                <Page name="technician-view" title={pageTitle} centered>
                    {criticalError ? <CriticalError type={criticalError} /> : <Loading />}
                </Page>
            );
        }

        return (
            <Page name="technician-view" title={pageTitle}>
                <div class="TechnicianView">
                    <Tabs
                        defaultIndex={selectedTabIndex}
                        onChange={handleTabChange}
                        onChanged={handleTabChanged}
                        actions={tabsActions}
                    >
                        <Tab title={__('informations')} icon="info-circle">
                            <Infos technician={technician!} />
                        </Tab>
                        <Tab title={__('schedule')} icon="calendar-alt">
                            <Schedule technician={technician!} />
                        </Tab>
                        <Tab title={__('documents')} icon="file-pdf">
                            <Documents ref="documents" technician={technician!} />
                        </Tab>
                        <Tab title={__('page.technician-view.assignments.title')} icon="tools">
                            <Assignments
                                technician={technician!}
                                displayMode={assignmentsDisplayMode}
                            />
                        </Tab>
                    </Tabs>
                </div>
            </Page>
        );
    },
});

export default TechnicianView;
