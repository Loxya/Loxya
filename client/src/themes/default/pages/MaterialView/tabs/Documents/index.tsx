import './index.scss';
import { defineComponent } from 'vue';
import apiMaterials from '@/stores/api/materials';
import apiDocuments from '@/stores/api/documents';
import CriticalError from '@/themes/default/components/CriticalError';
import FileManager from '@/themes/default/components/FileManager';
import Loading from '@/themes/default/components/Loading';
import { confirm } from '@/utils/alert';

import type { ComponentRef, PropType } from 'vue';
import type { ProgressCallback } from '@/globals/requester';
import type { Document } from '@/stores/api/documents';
import type { Material } from '@/stores/api/materials';

type Props = {
    /** Le matériel dont on veut gérer les documents. */
    material: Material,
};

type Data = {
    isFetched: boolean,
    hasCriticalError: boolean,
    documents: Document[],
};

/** Onglet des documents dans la visualisation d'un matériel. */
const MaterialViewDocuments = defineComponent({
    name: 'MaterialViewDocuments',
    props: {
        material: {
            type: Object as PropType<Required<Props>['material']>,
            required: true,
        },
    },
    data: (): Data => ({
        hasCriticalError: false,
        isFetched: false,
        documents: [],
    }),
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
                text: __('page.material-view.documents.confirm-permanently-delete'),
                confirmButtonText: __('yes-permanently-delete'),
            });
            if (!isConfirmed) {
                return;
            }

            this.$delete(this.documents, index);
            try {
                await apiDocuments.remove(id);
                this.$toasted.success(__('page.material-view.documents.deleted'));
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
                const data = await apiMaterials.documents(this.material.id);
                this.documents = data;
                this.isFetched = true;
            } catch {
                this.hasCriticalError = true;
            }
        },

        persistDocument(file: File, signal: AbortSignal, onProgress: ProgressCallback): Promise<Document> {
            return apiMaterials.attachDocument(this.material.id, file, { onProgress, signal });
        },
    },
    render() {
        const {
            isFetched,
            hasCriticalError,
            persistDocument,
            documents,
            handleDocumentUploaded,
            handleDocumentDelete,
        } = this;

        if (hasCriticalError || !isFetched) {
            return (
                <div class="MaterialViewDocuments">
                    {hasCriticalError ? <CriticalError /> : <Loading />}
                </div>
            );
        }

        return (
            <div class="MaterialViewDocuments">
                <FileManager
                    ref="fileManager"
                    class="MaterialViewDocuments__manager"
                    documents={documents}
                    persister={persistDocument}
                    onDocumentUploaded={handleDocumentUploaded}
                    onDocumentDelete={handleDocumentDelete}
                />
            </div>
        );
    },
});

export default MaterialViewDocuments;
