<?php
declare(strict_types=1);

namespace Loxya\Support\Invoicing\BusinessProcessType;

/** Cadre de facturation spécifiquement français. */
enum BusinessProcessTypeFr: string implements BusinessProcessTypeInterface
{
    //
    // - Factures de biens
    //

    /** Dépôt d'une facture de bien. */
    case GOODS_INVOICE = 'B1';

    /** Dépôt d'une facture de bien déjà payée. */
    case GOODS_INVOICE_PREPAID = 'B2';

    /** Dépôt d'une facture de bien définitive (après acompte). */
    case GOODS_FINAL_INVOICE = 'B4';

    // /**
    //  * Dépôt d'une facture de bien ayant fait l'objet d'un
    //  * e-reporting (TVA déjà collectée).
    //  */
    // case GOODS_EREPORTED_INVOICE = 'B7';

    /** Dépôt d'une facture multi-vendeurs de bien. */
    case GOODS_MULTI_VENDOR_INVOICE = 'B8';

    //
    // - Factures de prestations de service
    //

    /** Dépôt d'une facture de prestation de service. */
    case SERVICES_INVOICE = 'S1';

    /** Dépôt d'une facture de prestation de service déjà payée. */
    case SERVICES_INVOICE_PREPAID = 'S2';

    /** Dépôt d'une facture de prestation de service définitive (après acompte). */
    case SERVICES_FINAL_INVOICE = 'S4';

    // /** Dépôt par un sous-traitant d'une facture de prestation de service. */
    // case SERVICES_SUBCONTRACTOR_INVOICE = 'S5';

    // /** Dépôt par un cotraitant d'une facture de prestation de service. */
    // case SERVICES_COCONTRACTOR_INVOICE = 'S6';

    // /**
    //  * Dépôt d'une facture de prestation de service ayant fait
    //  * l'objet d'un e-reporting (TVA déjà collectée).
    //  */
    // case SERVICES_EREPORTED_INVOICE = 'S7';

    /** Dépôt d'une facture multi-vendeurs de service. */
    case SERVICES_MULTI_VENDOR_INVOICE = 'S8';

    //
    // - Factures doubles (biens et services)
    //

    /**
     * Dépôt d'une facture double.
     * (livraison de biens et services qui ne sont pas accessoires l'une de l'autre)
     */
    case MIXED_INVOICE = 'M1';

    /** Dépôt d'une facture double déjà payée. */
    case MIXED_INVOICE_PREPAID = 'M2';

    /** Dépôt d'une facture double définitive (après acompte). */
    case MIXED_FINAL_INVOICE = 'M4';

    /**
     * Dépôt d'une facture multi-vendeurs double.
     * (= Contenant des factures unitaires qui ne sont pas toutes `S[x]` ou `B[x]`).
     */
    case MIXED_MULTI_VENDOR_INVOICE = 'M8';

    //
    // - Autres
    //

    /**
     * Dépôt d'une demande de paiement de sous-traitance avec paiement direct.
     * (Uniquement B2G)
     */
    case SUBCONTRACTING_DIRECT_PAYMENT_REQUEST = 'S3';
}
