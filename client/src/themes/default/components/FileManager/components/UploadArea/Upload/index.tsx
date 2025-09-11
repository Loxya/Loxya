import './index.scss';
import { defineComponent } from 'vue';
import config from '@/globals/config';
import formatBytes from '@/utils/formatBytes';
import Button from '@/themes/default/components/Button';
import Icon from '@/themes/default/components/Icon';
import Progressbar from '@/themes/default/components/Progressbar';
import { getIconFromFile } from '../../../_utils';
import { FileError } from '../_utils';

import type { Upload as UploadType } from '../index';
import type { PropType } from 'vue';

type Props = {
    /** L'object représentant l'upload en cours. */
    upload: UploadType,

    /**
     * Fonction appelée lorsque l'annulation de l'envoi a
     * été demandée par l'utilisateur.
     *
     * @param uid - Uid de l'upload annulé.
     */
    onCancel?(uid: UploadType['uid']): void,
};

/** Affiche l'état d'un fichier en cours d'upload. */
const FileManagerUpload = defineComponent({
    name: 'FileManagerUpload',
    props: {
        upload: {
            type: Object as PropType<Required<Props>['upload']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onCancel: {
            type: Function as PropType<Props['onCancel']>,
            default: undefined,
        },
    },
    emits: ['cancel'],
    computed: {
        hasError(): boolean {
            return this.upload.error !== null;
        },

        basename(): string {
            const { file } = this.upload;
            return file.name.split('.').slice(0, -1).join('.');
        },

        extension(): string | undefined {
            const { file } = this.upload;
            return file.name.indexOf('.') > 0
                ? `.${file.name.split('.').pop()!.toLowerCase()}`
                : undefined;
        },

        progress(): number {
            return this.upload.progress;
        },

        icon(): string {
            return getIconFromFile(this.upload.file);
        },

        size(): string {
            const { file } = this.upload;
            return formatBytes(file.size);
        },

        status(): string {
            const { __, hasError, upload } = this;

            if (hasError) {
                if (upload.error === FileError.TYPE_NOT_ALLOWED) {
                    return __('global.errors.file-type-not-allowed');
                }

                if (upload.error === FileError.SIZE_EXCEEDED) {
                    return __('global.errors.file-size-exceeded', {
                        max: formatBytes(config.maxFileUploadSize),
                    });
                }

                if (upload.error === FileError.UPLOAD_ERROR) {
                    return __('global.errors.file-upload-failed');
                }

                return __('global.errors.file-unknown-error');
            }

            if (upload.isCancelled) {
                return __('upload-cancelled');
            }

            if (!upload.isStarted) {
                return __('upload-in-queue');
            }

            if (upload.isFinished) {
                return __('upload-complete');
            }

            return upload.progress < 100
                ? __('upload-in-progress', { progress: upload.progress })
                : __('upload-in-process');
        },

        cancellable(): boolean {
            if (this.upload.isCancelled) {
                return false;
            }
            return this.hasError || !this.upload.isFinished;
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleCancel() {
            if (!this.cancellable) {
                return;
            }
            this.$emit('cancel', this.upload.uid);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.FileManager.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            icon,
            basename,
            extension,
            size,
            status,
            progress,
            hasError,
            cancellable,
            handleCancel,
        } = this;

        const className = ['FileManagerUpload', {
            'FileManagerUpload--error': hasError,
            'FileManagerUpload--cancellable': cancellable,
        }];

        return (
            <div class={className}>
                {cancellable && (
                    <Button
                        icon="times"
                        class="FileManagerUpload__button-cancel"
                        onClick={handleCancel}
                    />
                )}
                <div class="FileManagerUpload__data">
                    <Icon class="FileManagerUpload__data__icon" name={icon} />
                    <div class="FileManagerUpload__data__main">
                        <h4 class="FileManagerUpload__name">
                            <span class="FileManagerUpload__name__base">{basename}</span>
                            {undefined !== extension && (
                                <span class="FileManagerUpload__name__ext">{extension}</span>
                            )}
                        </h4>
                        <div class="FileManagerUpload__infos">
                            <span class="FileManagerUpload__infos__info">
                                {size}
                            </span>
                            <span
                                class={[
                                    'FileManagerUpload__infos__info',
                                    'FileManagerUpload__infos__info--status',
                                ]}
                            >
                                {status}
                            </span>
                        </div>
                    </div>
                </div>
                {!hasError && (
                    <Progressbar
                        class="FileManagerUpload__progress"
                        percent={progress}
                        minimalist
                    />
                )}
            </div>
        );
    },
});

export default FileManagerUpload;
