import config from '@/globals/config';

export enum FileError {
    /** Le type de fichier n'est pas supporté. */
    TYPE_NOT_ALLOWED = 'type-not-allowed',

    /** La taille du fichier excède celle autorisée. */
    SIZE_EXCEEDED = 'size-exceeded',

    /** Une erreur est survenue pendant l'upload du fichier. */
    UPLOAD_ERROR = 'upload-error',
}

export const getFileError = (file: File): FileError | null => {
    if (!config.allowedFileTypes.includes(file.type)) {
        return FileError.TYPE_NOT_ALLOWED;
    }

    if (file.size > config.maxFileUploadSize) {
        return FileError.SIZE_EXCEEDED;
    }

    return null;
};
