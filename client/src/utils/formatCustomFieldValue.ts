import { CustomFieldType } from '@/stores/api/@types';

import type { I18nTranslate } from 'vuex-i18n';
import type { PropertyWithValue } from '@/stores/api/properties';
import type { CustomFieldWithValue } from '@/stores/api/custom-fields';

type Field = (
    | PropertyWithValue
    | CustomFieldWithValue
);

/**
 * Formate la valeur d'un champ personnalisé selon son type.
 *
 * @param __ - La fonction de traduction.
 * @param field - Le champ personnalisé dont on veut afficher la valeur.
 *
 * @returns La valeur du champ personnalisé.
 */
const formatCustomFieldValue = (__: I18nTranslate, field: Field): string | null => {
    const { type, value } = field;

    switch (type) {
        case CustomFieldType.STRING:
        case CustomFieldType.LIST:
        case CustomFieldType.TEXT: {
            return value;
        }
        case CustomFieldType.INTEGER:
        case CustomFieldType.FLOAT: {
            return [value, field.unit].join('\u00A0');
        }
        case CustomFieldType.DATE: {
            return value?.toReadable() ?? null;
        }
        case CustomFieldType.BOOLEAN: {
            return value ? __('yes') : __('no');
        }
        case CustomFieldType.PERIOD: {
            return value?.toReadable(__) ?? null;
        }
        default: {
            return null;
        }
    }
};

export default formatCustomFieldValue;
