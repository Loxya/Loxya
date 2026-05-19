/** Identifiants de routage e-facturation. */
enum InvoiceRoutingIdentifierScheme {
    /**
     * Adresse électronique "FRCTC".
     *
     * => Identifiant utilisé pour le routage PPF.
     */
    FR_CTC = '0225',

    /** Code BCE Belge. */
    BE_BCE = '0208',
}

export default InvoiceRoutingIdentifierScheme;
