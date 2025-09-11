import './index.scss';

import Queue from 'p-queue';
import { defineComponent, markRaw } from 'vue';
import { FileError, getFileError } from './_utils';
import uniqueId from 'lodash/uniqueId';
import DropZone from '@/themes/default/components/DropZone';
import UploadItem from './Upload';

import type { PropType, Raw } from 'vue';
import type { ProgressCallback } from '@/globals/requester';
import type { Document } from '@/stores/api/documents';

export type Upload = {
    uid: string,
    file: Raw<File>,
    error: FileError | null,
    progress: number,
    isStarted: boolean,
    isFinished: boolean,
    isCancelled: boolean,
    signal: Raw<AbortSignal>,
    cancel(): void,
};

type Props = {
    /**
     * Fonction permettant de persister un nouveau document.
     *
     * @param file - Le fichier à persister.
     * @param signal - Un `AbortSignal` fourni par le composant.
     *                 Permet au composant d'annuler l'opération (par
     *                 exemple si l'utilisateur annule l'envoi du fichier).
     * @param onProgress - Callback a appeler régulièrement pour indiquer
     *                     l'avancement du transfert (voir {@link ProgressCallback}).
     *
     * @returns La fonction doit retourner une promesse résolue avec le `Document` persisté.
     */
    persister(file: File, signal: AbortSignal, onProgress: ProgressCallback): Promise<Document>,

    /**
     * Fonction appelée lorsqu'un fichier vient d'être uploadé.
     *
     * @param document - Le document uploadé.
     */
    onUpload?(document: Document): void,
};

type Data = {
    uploadQueue: Raw<Queue>,
    uploads: Upload[],
};

/**
 * Nombre d'upload simultanés maximum (au delà, les
 * uploads seront placés dans une queue).
 */
const MAX_CONCURRENT_UPLOADS = 5;

/** Upload de fichiers avec système de queue et persistance. */
const FileManagerUploadArea = defineComponent({
    name: 'FileManagerUploadArea',
    props: {
        persister: {
            type: Function as PropType<Required<Props>['persister']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onUpload: {
            type: Function as PropType<Props['onUpload']>,
            default: undefined,
        },
    },
    emits: ['upload'],
    data: (): Data => ({
        uploadQueue: markRaw(new Queue({ concurrency: MAX_CONCURRENT_UPLOADS })),
        uploads: [],
    }),
    beforeDestroy() {
        // - Vide la queue courante.
        this.uploadQueue.clear();

        // - Annule les envois en cours...
        this.uploads.forEach((upload: Upload) => {
            if (upload.isFinished || upload.isCancelled) {
                return;
            }
            upload.cancel();
        });
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleAddFiles(files: FileList) {
            const uploads: Upload[] = Array.from(files).map((file: File) => {
                const abortController = new AbortController();
                const error = getFileError(file);
                const hasError = error !== null;

                const upload: Upload = {
                    uid: uniqueId(),
                    file: markRaw(file),
                    error,
                    signal: markRaw(abortController.signal),
                    isStarted: false,
                    isFinished: hasError,
                    isCancelled: false,
                    cancel: () => {},
                    progress: 0,
                };

                upload.cancel = () => {
                    this.$set(file, 'isCancelled', true);
                    abortController.abort();
                };

                return upload;
            });

            // - Ajoute les uploads aux uploads en cours.
            this.uploads.unshift(...uploads);

            // - Upload les fichiers qui doivent l'être.
            const waitingUploads = uploads.filter(({ isFinished }: Upload) => !isFinished);
            waitingUploads.forEach(async (upload: Upload) => {
                try {
                    const newDocument = await this.uploadQueue.add(async (): Promise<Document> => {
                        if (upload.isCancelled) {
                            throw new Error('aborted.');
                        }

                        this.$set(upload, 'isStarted', true);

                        return this.persister(upload.file, upload.signal, (progress: number): void => {
                            this.$set(upload, 'progress', Math.min(100, Math.round(progress)));
                        });
                    });

                    this.$set(upload, 'isFinished', true);
                    this.$emit('upload', newDocument);

                    const handleFinishedUploaded = (): void => {
                        const index = this.uploads.indexOf(upload);
                        if (index === -1) {
                            return;
                        }
                        this.$delete(this.uploads, index);
                    };
                    setTimeout(handleFinishedUploaded, 3000);
                } catch {
                    if (upload.isCancelled) {
                        return;
                    }

                    // TODO: Améliorer la prise en charge des erreurs de validation.
                    this.$set(upload, 'error', FileError.UPLOAD_ERROR);
                }
            });
        },

        handleCancelUpload(uid: Upload['uid']) {
            const upload = this.uploads.find((_upload: Upload) => _upload.uid === uid);
            if (upload === undefined) {
                return;
            }

            if (!upload.isFinished && !upload.isCancelled) {
                upload.cancel();
            }

            this.uploads.splice(this.uploads.indexOf(upload), 1);
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Indique si au moins un fichier est en cours d'upload ou non.
         *
         * @returns `true` si un fichier est en cours d'upload, `false` sinon.
         */
        isUploading(): boolean {
            return this.uploads.some(
                ({ isFinished }: Upload) => !isFinished,
            );
        },
    },
    render() {
        const { uploads, handleAddFiles, handleCancelUpload } = this;
        const isUploading = uploads.length > 0;

        const className = ['FileManagerUploadArea', {
            'FileManagerUploadArea--uploading': isUploading,
        }];

        return (
            <div class={className}>
                <DropZone
                    class="FileManagerUploadArea__drop-zone"
                    onInput={handleAddFiles}
                />
                {uploads.length > 0 && (
                    <ul class="FileManagerUploadArea__uploads">
                        {uploads.map((upload: Upload) => (
                            <li key={upload.uid} class="FileManagerUploadArea__uploads__item">
                                <UploadItem upload={upload} onCancel={handleCancelUpload} />
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        );
    },
});

export default FileManagerUploadArea;
