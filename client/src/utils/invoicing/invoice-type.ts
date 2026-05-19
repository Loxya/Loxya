/** Type de facture. */
enum InvoiceType {
    /** Facture "normale". */
    INVOICE = 'invoice',

    /** Avoir. */
    CREDIT_NOTE = 'credit-note',

    /** Facture corrective. */
    CORRECTION = 'correction',

    /** Facture d'acompte. */
    PREPAYMENT_INVOICE = 'prepayment-invoice',

    /** Avoir de facture d'acompte. */
    PREPAYMENT_CREDIT_NOTE = 'prepayment-credit-note',
}

export default InvoiceType;
