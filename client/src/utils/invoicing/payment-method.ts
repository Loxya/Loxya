/** Moyen de paiement. */
enum PaymentMethod
{
    /** Espèces. */
    CASH = 'cash',

    /** Carte de crédit / débit */
    CARD = 'card',

    /** Chèque. */
    CHEQUE = 'cheque',

    /** Virement bancaire. */
    TRANSFER = 'transfer',
}

export default PaymentMethod;
