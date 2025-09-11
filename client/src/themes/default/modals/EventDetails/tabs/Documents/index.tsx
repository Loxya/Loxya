import { defineComponent } from 'vue';
import { Group } from '@/stores/api/groups';
import apiEvents from '@/stores/api/events';
import apiDocuments from '@/stores/api/documents';
import CriticalError from '@/themes/default/components/CriticalError';
import FileManager, { FileManagerLayout } from '@/themes/default/components/FileManager';
import Loading from '@/themes/default/components/Loading';
import { confirm } from '@/utils/alert';

import type { ComponentRef, PropType } from 'vue';
import type { ProgressCallback } from '@/globals/requester';
import type { Document } from '@/stores/api/documents';
import type { EventDetails } from '@/stores/api/events';

type Props = {
    /** L'événement dont on souhaite gérer les documents. */
    event: EventDetails,
};

type Data = {
    isFetched: boolean,
    hasCriticalError: boolean,
    documents: Document[],
};

/** L'onglet "Documents" de la modale de détails d'un événement. */
const EventDetailsDocuments = defineComponent({
    name: 'EventDetailsDocuments',
    props: {
        event: {
            type: Object as PropType<Required<Props>['event']>,
            required: true,
        },
    },
    data: (): Data => ({
        hasCriticalError: false,
        isFetched: false,
        documents: [],
    }),
    computed: {
        isTeamMember(): boolean {
            return this.$store.getters['auth/is']([
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
            ]);
        },
    },
    mounted() {
        this.fetchDocuments();

        this.persistDocument.bind(this);
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleDocumentUploaded(document: Document) {
            this.documents.push(document);
        },

        async handleDocumentDelete(id: Document['id']) {
            const index = this.documents.findIndex((document: Document) => document.id === id);
            if (index === -1) {
                return;
            }

            const { $t: __ } = this;
            const isConfirmed = await confirm({
                type: 'danger',
                text: __('modal.event-details.documents.confirm-permanently-delete'),
                confirmButtonText: __('yes-permanently-delete'),
            });
            if (!isConfirmed) {
                return;
            }

            this.$delete(this.documents, index);
            try {
                await apiDocuments.remove(id);
                this.$toasted.success(__('modal.event-details.documents.deleted'));
            } catch {
                this.$toasted.error(__('errors.unexpected-while-deleting'));
                this.fetchDocuments();
            }
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Indique si au moins un document est en cours d'upload ou non.
         *
         * @returns `true` si un document est en cours d'upload, `false` sinon.
         */
        isUploading(): boolean {
            const $fileManager = this.$refs.fileManager as ComponentRef<typeof FileManager>;
            return !!$fileManager?.isUploading();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchDocuments(): Promise<void> {
            try {
                const data = await apiEvents.documents(this.event.id);
                this.documents = data;
                this.isFetched = true;
            } catch {
                this.hasCriticalError = true;
            }
        },

        persistDocument(file: File, signal: AbortSignal, onProgress: ProgressCallback): Promise<Document> {
            return apiEvents.attachDocument(this.event.id, file, { onProgress, signal });
        },
    },
    render() {
        const {
            isFetched,
            hasCriticalError,
            isTeamMember,
            persistDocument,
            documents,
            handleDocumentUploaded,
            handleDocumentDelete,
        } = this;

        if (hasCriticalError || !isFetched) {
            return (
                <div class="EventDetailsDocuments">
                    {hasCriticalError ? <CriticalError /> : <Loading />}
                </div>
            );
        }

        return (
            <div class="EventDetailsDocuments">
                <FileManager
                    ref="fileManager"
                    class="EventDetailsDocuments__manager"
                    layout={FileManagerLayout.VERTICAL}
                    documents={documents}
                    readonly={!isTeamMember}
                    persister={persistDocument}
                    onDocumentUploaded={handleDocumentUploaded}
                    onDocumentDelete={handleDocumentDelete}
                />
            </div>
        );
    },
});

export default EventDetailsDocuments;
