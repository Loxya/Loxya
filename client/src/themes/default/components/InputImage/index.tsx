import './index.scss';
import { defineComponent, markRaw } from 'vue';
import config from '@/globals/config';
import formatBytes from '@/utils/formatBytes';
import Button from '@/themes/default/components/Button';
import Loading from '@/themes/default/components/Loading';
import Progressbar from '@/themes/default/components/Progressbar';
import PlaceholderImage from './assets/placeholder.svg?inline';

import type { PropType, Raw } from 'vue';

type Props = {
    /**
     * La valeur actuelle du champ d'upload d'image.
     *
     * Peut contenir soit:
     * - Une chaîne de caractère contenant le chemin vers un fichier d'image précédemment ajouté.
     * - Une instance de {@link File} contenant un fichier d'image.
     * - La valeur `null` si le champ est "vide".
     *
     * @default null
     */
    value: string | File | null,

    /**
     * Le fichier d'image sélectionné est-il en cours d'upload pour persistance ?
     *
     * Peut contenir deux types de valeur:
     * - Un booléen indiquant s'il y a un fichier en cours d'upload ou non.
     * - Un nombre indiquant un pourcentage d'upload, ceci impliquant qu'un upload est en cours.
     *
     * @default false
     */
    uploading?: boolean | number,

    /**
     * Fonction appelée lorsque l'image sélectionnée a changé.
     *
     * @param value - Nouvelle valeur du champ (fichier ou `null`).
     */
    onChange?(value: Raw<File> | null): void,
};

/** Un champ de formulaire d'upload d'une image. */
const InputImage = defineComponent({
    name: 'InputImage',
    props: {
        value: {
            type: [String, File] as PropType<Required<Props>['value']>,
            default: null,
        },
        uploading: {
            type: [Boolean, Number] as PropType<Required<Props>['uploading']>,
            default: false,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['change'],
    computed: {
        isEmpty(): boolean {
            return this.value === null;
        },

        isUploading(): boolean {
            return this.uploading !== false;
        },

        uploadProgress(): number | undefined {
            const progress = this.uploading;
            if (!this.isUploading || typeof progress !== 'number' || progress === 0) {
                return undefined;
            }
            return progress;
        },

        imageSrc(): string | null {
            const { value } = this;
            return value instanceof File
                ? URL.createObjectURL(value)
                : value;
        },
    },
    methods: {
        handleSelectFile() {
            if (this.isUploading) {
                return;
            }
            (this.$refs.input as HTMLInputElement | undefined)?.click();
        },

        handleChange(event: InputEvent) {
            event.preventDefault();
            if (this.isUploading) {
                return;
            }

            const files = event.dataTransfer
                ? event.dataTransfer.files
                : (event.target as any as DataTransfer).files;

            if (!files || files.length === 0) {
                return;
            }

            const file = markRaw(files[0]);
            const { type, size } = file;
            const { $t: __ } = this;

            if (!config.authorizedImageTypes.includes(type)) {
                this.$toasted.error(__('errors.file-not-a-valid-image'));
                return;
            }

            if (size > config.maxFileUploadSize) {
                const formattedMaxSize = formatBytes(config.maxFileUploadSize);
                this.$toasted.error(__('errors.file-size-exceeded', { max: formattedMaxSize }));
                return;
            }

            this.$emit('change', file);
        },

        handleRemove() {
            if (this.isEmpty || this.isUploading) {
                return;
            }
            this.$emit('change', null);
        },
    },
    render() {
        const {
            $t: __,
            imageSrc,
            uploadProgress,
            isEmpty,
            isUploading,
            handleSelectFile,
            handleChange,
            handleRemove,
        } = this;

        const renderPreviewContent = (): JSX.Element => {
            if (isEmpty) {
                return <PlaceholderImage class="InputImage__preview__placeholder" />;
            }
            return <img src={imageSrc!} class="InputImage__preview__image" alt="" />;
        };

        const className = ['InputImage', {
            'InputImage--empty': isEmpty,
        }];

        return (
            <div class={className}>
                <div class="InputImage__preview">
                    {renderPreviewContent()}
                </div>
                <input
                    ref="input"
                    type="file"
                    readonly={isUploading}
                    onChange={handleChange}
                    class="InputImage__input"
                    accept="image/*"
                />
                {!isUploading && (
                    <div class="InputImage__actions">
                        <Button
                            type={isEmpty ? 'success' : 'default'}
                            icon={isEmpty ? 'plus' : 'sync'}
                            onClick={handleSelectFile}
                        >
                            {isEmpty ? __('add-a-picture') : __('change-the-picture')}
                        </Button>
                        {!isEmpty && (
                            <Button type="danger" icon="ban" onClick={handleRemove}>
                                {__('remove-the-picture')}
                            </Button>
                        )}
                    </div>
                )}
                {isUploading && <Loading horizontal />}
                {(isUploading && uploadProgress !== undefined) && (
                    <Progressbar
                        class="InputImage__progress"
                        percent={uploadProgress}
                    />
                )}
            </div>
        );
    },
});

export default InputImage;
