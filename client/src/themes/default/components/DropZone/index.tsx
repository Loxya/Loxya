import './index.scss';
import { defineComponent, markRaw } from 'vue';
import config from '@/globals/config';
import formatBytes from '@/utils/formatBytes';
import Button from '@/themes/default/components/Button';
import Icon from '@/themes/default/components/Icon';

import type { PropType, Raw } from 'vue';

type Props = {
    /**
     * Est-ce que la drop-zone doit prendre en charge plusieurs fichiers ?
     *
     * @default true
     */
    multiple?: boolean,

    /**
     * Le(s) type(s) MIME de fichiers acceptés. Si plusieurs, utiliser un array.
     * Par défaut, il s'agit les types spécifiés dans la configuration globale.
     */
    accept?: string | string[],

    /**
     * Fonction appelée lorsque le survol en glissé-déposé
     * débute au-dessus de la zone.
     */
    onDragStart?(): void,

    /**
     * Fonction appelée lorsque le survol en glissé-déposé se termine
     * (ex: sortie du pointeur de la zone ou dépôt effectif).
     */
    onDragStop?(): void,

    /**
     * Fonction appelée quand des fichiers sont fournis au composant,
     * via un drag'n'drop ou via le sélecteur de fichiers.
     *
     * @param files - Le ou les fichiers fournis.
     */
    onInput?(files: Raw<File> | Raw<FileList>): void,
};

type Data = {
    isDragging: boolean,
};

/** Zone de dépôt de fichiers. */
const DropZone = defineComponent({
    name: 'DropZone',
    props: {
        multiple: {
            type: Boolean as PropType<Required<Props>['multiple']>,
            default: true,
        },
        accept: {
            type: [String, Array] as PropType<Required<Props>['accept']>,
            default: () => config.authorizedFileTypes,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onDragStart: {
            type: Function as PropType<Props['onDragStart']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onDragStop: {
            type: Function as PropType<Props['onDragStop']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onInput: {
            type: Function as PropType<Props['onInput']>,
            default: undefined,
        },
    },
    emits: ['input', 'dragStart', 'dragStop'],
    data: (): Data => ({
        isDragging: false,
    }),
    computed: {
        maxSize: () => formatBytes(config.maxFileUploadSize),

        acceptTypes() {
            const { accept } = this;
            return Array.isArray(accept) ? accept : [accept];
        },
    },
    mounted() {
        // - Binding.
        this.handleDragOver = this.handleDragOver.bind(this);
        this.handleDragLeave = this.handleDragLeave.bind(this);
        this.handleDrop = this.handleDrop.bind(this);

        // - Global listeners.
        document.addEventListener('dragover', this.handleDragOver);
        document.addEventListener('dragleave', this.handleDragLeave);
        document.addEventListener('drop', this.handleDrop);
    },
    beforeDestroy() {
        document.removeEventListener('dragover', this.handleDragOver);
        document.removeEventListener('dragleave', this.handleDragLeave);
        document.removeEventListener('drop', this.handleDrop);
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleDragOver(e: DragEvent) {
            e.preventDefault();

            this.isDragging = true;
            this.$emit('dragStart');
        },

        handleDragLeave(e: DragEvent) {
            e.preventDefault();

            this.isDragging = false;
            this.$emit('dragStop');
        },

        handleDrop(e: DragEvent) {
            e.preventDefault();

            this.isDragging = false;
            this.$emit('dragStop');

            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) {
                return;
            }

            const { multiple } = this;
            this.$emit('input', markRaw(multiple ? files : files[0]));
        },

        handleClickOpenFileBrowser(e: MouseEvent) {
            e.stopPropagation();

            const $inputFile = this.$refs.inputFile as HTMLInputElement | undefined;
            $inputFile?.click();
        },

        handleAddFiles(e: Event) {
            e.preventDefault();

            this.isDragging = false;
            this.$emit('dragStop');

            const files = (e.target as HTMLInputElement)?.files;
            if (!files || files.length === 0) {
                return;
            }

            const { multiple } = this;
            this.$emit('input', markRaw(multiple ? files : files[0]));
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.DropZone.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            maxSize,
            isDragging,
            multiple,
            acceptTypes,
            handleClickOpenFileBrowser,
            handleAddFiles,
        } = this;

        const className = ['DropZone', {
            'DropZone--dragging': isDragging,
        }];

        return (
            <div
                class={className}
                onClick={handleClickOpenFileBrowser}
            >
                <div class="DropZone__content">
                    <Icon name="cloud-upload-alt" class="DropZone__icon" />
                    <p class="DropZone__instruction">
                        {multiple ? __('drag-and-drop-files-here') : __('drag-and-drop-file-here')}<br />
                        <span class="DropZone__instruction__sub-line">
                            {__('max-size', { size: maxSize })}
                        </span>
                    </p>
                    <Button
                        type="success"
                        class="DropZone__choose-files"
                        onClick={handleClickOpenFileBrowser}
                    >
                        {multiple ? __('choose-files') : __('choose-file')}
                    </Button>
                </div>
                <input
                    multiple={multiple}
                    type="file"
                    ref="inputFile"
                    accept={acceptTypes.join(',')}
                    class="DropZone__file-input"
                    onChange={handleAddFiles}
                />
            </div>
        );
    },
});

export default DropZone;
