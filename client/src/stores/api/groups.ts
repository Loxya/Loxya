import Vue from 'vue';

// ------------------------------------------------------
// -
// -    Schema / Enums
// -
// ------------------------------------------------------

export enum Group {
    /** Représente le groupe des administrateurs. */
    ADMINISTRATION = 'administration',

    /** Représente le groupe des superviseurs. */
    SUPERVISION = 'supervision',

    /** Représente le groupe des opérateurs, membres de l'équipe. */
    OPERATION = 'operation',

    /**
     * Représente le groupe des utilisateurs ayant accès au
     * planning général, en lecture seule.
     */
    READONLY_PLANNING_GENERAL = 'readonly-planning-general',
}

// ------------------------------------------------------
// -
// -    Types
// -
// ------------------------------------------------------

export type GroupDetails = {
    id: Group,
    name: string,
};

// ------------------------------------------------------
// -
// -    Fonctions
// -
// ------------------------------------------------------

const all = (): GroupDetails[] => {
    const { translate: __ } = (Vue as any).i18n;

    return [
        { id: Group.ADMINISTRATION, name: __('groups.administration') },
        { id: Group.SUPERVISION, name: __('groups.supervision') },
        { id: Group.OPERATION, name: __('groups.operation') },
        { id: Group.READONLY_PLANNING_GENERAL, name: __('groups.readonly-planning-general') },
    ];
};

export default { all };
