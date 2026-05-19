/** Type d'entité légale pour une personne. */
export enum LegalEntityType {
    /**
     * Personne morale, par exemple une société ou une organisation.
     */
    COMPANY = 'company',

    /**
     * Personne physique, un particulier.
     */
    INDIVIDUAL = 'individual',
}

export default LegalEntityType;
