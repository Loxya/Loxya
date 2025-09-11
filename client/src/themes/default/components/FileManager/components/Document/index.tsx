import './index.scss';
import { defineComponent } from 'vue';
import formatBytes from '@/utils/formatBytes';
import Button from '@/themes/default/components/Button';
import Icon from '@/themes/default/components/Icon';
import { getIconFromFile } from '../../_utils';

import type { PropType } from 'vue';
import type { Document } from '@/stores/api/documents';

type Props = {
    /** Le document à afficher. */
    file: Document,

    /** Est-ce que la suppression du fichier doit être désactivée ? */
    readonly?: boolean,

    /**
     * Fonction appelée lorsque l'utilisateur demande la
     * suppression du document.
     *
     * @param id - L'identifiant du fichier à supprimer.
     */
    onDelete?(id: Document['id']): void,
};

/** Document du gestionnaire de fichiers. */
const FileManagerDocument = defineComponent({
    name: 'FileManagerDocument',
    props: {
        file: {
            type: Object as PropType<Required<Props>['file']>,
            required: true,
        },
        readonly: {
            type: Boolean as PropType<Required<Props>['readonly']>,
            default: false,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onDelete: {
            type: Function as PropType<Props['onDelete']>,
            default: undefined,
        },
    },
    emits: ['delete'],
    computed: {
        icon(): string {
            return getIconFromFile(this.file);
        },

        basename(): string {
            return this.file.name.split('.').slice(0, -1).join('.');
        },

        extension(): string | undefined {
            return this.file.name.indexOf('.') > 0
                ? `.${this.file.name.split('.').pop()!.toLowerCase()}`
                : undefined;
        },

        size(): string {
            return formatBytes(this.file.size);
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleClickDelete() {
            if (this.readonly) {
                return;
            }
            this.$emit('delete', this.file.id);
        },
    },
    render() {
        const {
            icon,
            size,
            basename,
            extension,
            readonly,
            file: { name, url },
            handleClickDelete,
        } = this;

        return (
            <li class="FileManagerDocument">
                <a href={url} class="FileManagerDocument__link" download={name}>
                    <Icon class="FileManagerDocument__icon" name={icon} />
                    <span class="FileManagerDocument__name">
                        <span class="FileManagerUpload__name__base">{basename}</span>
                        {undefined !== extension && (
                            <span class="FileManagerUpload__name__ext">{extension}</span>
                        )}
                    </span>
                </a>
                <div class="FileManagerDocument__size">
                    {size}
                </div>
                <div class="FileManagerDocument__actions">
                    <Button
                        type="primary"
                        icon="download"
                        to={url}
                        download={name}
                    />
                    {!readonly && (
                        <Button type="trash" onClick={handleClickDelete} />
                    )}
                </div>
            </li>
        );
    },
});

export default FileManagerDocument;
