<?php
declare(strict_types=1);

namespace Loxya\Support\Invoicing;

/** Statut d'e-reporting d'une facture. */
enum InvoiceReportingStatus: string
{
    /** Facture déposée (200). */
    case SUBMITTED = 'submitted';

    /** Facture émise par la plateforme d'envoi (201). */
    case ISSUED = 'issued';

    /** Facture reçue par la plateforme de réception (202). */
    case RECEIVED = 'received';

    /** Facture mise à disposition par la plateforme de réception (203). */
    case MADE_AVAILABLE = 'made-available';

    /** Le destinataire a accusé réception de la facture (204). */
    case IN_HAND = 'in-hand';

    /** Le destinataire a accepté la facture dans son intégralité. (205). */
    case APPROVED = 'approved';

    /** Le destinataire n'a accepté que partiellement la facture (206). */
    case PARTIALLY_APPROVED = 'partially-approved';

    /** Le destinataire est en désaccord avec tout ou partie de la facture (207). */
    case DISPUTED = 'disputed';

    /**
     * Le destinataire souhaite obtenir des pièces justificatives
     * complémentaires et suspend le traitement de la facture jusqu'à
     * leur réception (208).
     */
    case SUSPENDED = 'suspended';

    /**
     * Le fournisseur fournit des pièces justificatives complémentaires
     * attendues par le destinataire de la facture (209).
     */
    case COMPLETED = 'completed';

    /** Le destinataire refuse la facture dans son intégralité (210). */
    case REFUSED = 'refused';

    /**
     * Le destinataire informe avoir réalisé le paiement de la facture, ou le
     * fournisseur informe avoir réalisé le remboursement de la facture (211).
     */
    case PAYMENT_SENT = 'payment-sent';

    /**
     * Le fournisseur informe avoir reçu un paiement partiel ou total
     * de la facture (212).
     */
    case PAYMENT_RECEIVED = 'payment-received';

    /**
     * L'un des contrôles fonctionnels réalisés par la plateforme
     * d'émission ou de réception a détecté une anomalie
     * sur la facture (213).
     */
    case REJECTED = 'rejected';
}
