<?php
declare(strict_types=1);

namespace Loxya\Support\Data\CountryMetadata;

use Loxya\Models\Invoice;
use Loxya\Support\Country;
use Loxya\Support\Data\ElectronicInvoiceFormat;
use Loxya\Support\Data\IdentifierScheme;
use Loxya\Support\Data\LegalType\LegalTypeInterface;
use Loxya\Support\Invoicing\BusinessProcessType\BusinessProcessTypeInterface;
use Loxya\Support\Invoicing\BuyerInterface;
use Loxya\Support\Invoicing\LegalMention;
use Loxya\Support\Invoicing\StrictTaxRegime;
use Loxya\Support\Invoicing\TaxRegime;
use Loxya\Support\Invoicing\UblSpecification;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeInterface;

interface CountryMetadataInterface
{
    /**
     * @return list<array{
     *     isPrecise: bool,
     *     scheme: IdentifierScheme,
     *     pattern: string,
     *     normalize: callable,
     * }>
     */
    public static function getCompanyIdentifiers(): array;

    /**
     * La forme juridique doit-elle être affichée sur les documents ?
     *
     * @return bool `true` si oui, `false` sinon.
     */
    public static function mustShowLegalType(): bool;

    /**
     * Le capital social doit-il être affiché sur les documents ?
     *
     * @return bool `true` si oui, `false` sinon.
     */
    public static function mustShowShareCapital(): bool;

    /**
     * La mention d'immatriculation au registre du commerce
     * doit-elle être affichée sur les documents ?
     *
     * @return bool `true` si oui, `false` sinon.
     */
    public static function mustShowTradeRegister(): bool;

    /**
     * Le code d'activité doit-il être affiché sur les documents ?
     *
     * @return bool `true` si oui, `false` sinon.
     */
    public static function canShowActivityCode(): bool;

    /**
     * Indique si deux pays appartiennent à la même zone de T.V.A.
     *
     * @param Country $otherCountry L'autre instance à comparer à celle-ci.
     *
     * @return bool `true` si les deux pays sont membres d'un même zone T.V.A., `false` sinon.
     */
    public static function isSameVatArea(Country $otherCountry): bool;

    /**
     * Le numéro d'enregistrement (SIRET, BCE, ...) est-il
     * requis pour un acheteur "société" dans le pays ?
     *
     * @param ?Country $buyerCountry Pays de l'acheteur.
     *                               Si non spécifié, le pays sera réputé être le pays courant.
     *
     * @return bool `true` si le numéro d'enregistrement est requis, `false` sinon.
     */
    public static function requireBuyerRegistrationId(?Country $buyerCountry = null): bool;

    /**
     * L'adresse est-elle requise pour un acheteur dans le pays ?
     *
     * @param bool $isCompany Est-ce que l'acheteur est une société ?
     *
     * @return bool `true` si l'adresse est requise, `false` sinon.
     */
    public static function requireBuyerAddress(bool $isCompany): bool;

    /**
     * Retourne les régimes de taxe applicables pour une ligne de devis ou facture.
     *
     * Les régimes sont retournés dans l'ordre de priorité, le premier étant le plus susceptible d'être utilisé.
     *
     * @param BuyerInterface $buyer     Le client lié.
     * @param bool           $isService `true` si c'est une ligne de service, `false` si c'est un bien.
     *
     * @return list<TaxRegime|StrictTaxRegime> La liste des régimes de taxes applicables.
     */
    public static function getLineAvailableTaxRegimes(BuyerInterface $buyer, bool $isService): array;

    /**
     * Retourne les formats de e-invoicing utilisés pour le pays courant.
     *
     * @return list<ElectronicInvoiceFormat> Les formats e-invoicing possibles.
     */
    public static function getElectronicInvoiceFormats(): array;

    /**
     * Retourne la spécification UBL utilisée par le pays pour les factures électroniques.
     *
     * @return UblSpecification|null La spécification UBL, ou `null` si le pays
     *                               ne supporte pas la facturation électronique UBL.
     */
    public static function getUblSpecification(): ?UblSpecification;

    /**
     * Retourne le motif regex correspondant au format de
     * l'identifiant de routage e-facturation dans le pays.
     *
     * @return string|null Le motif regex, ou `null` si le pays ne supporte
     *                     pas la facturation électronique.
     */
    public static function getInvoiceRoutingIdentifierPattern(): string|null;

    /**
     * Permet de normaliser un identifiant de routage e-facturation du pays.
     *
     * @param string $rawValue L'identifiant à normaliser.
     *
     * @return string L'identifiant de routage e-facturation, normalisé.
     */
    public static function normalizeInvoiceRoutingIdentifier(string $rawValue): string;

    /**
     * Indique si l'identifiant de routage e-facturation par défaut peut être
     * déduit automatiquement depuis un identifiant de société.
     *
     * @return bool `true` si l'identifiant peut être déduit, `false` sinon.
     */
    public static function canInferDefaultInvoiceRoutingIdentifier(): bool;

    /**
     * Tente de déduire l'identifiant de routage e-facturation
     * par défaut via un identifiant de société.
     *
     * @param string $companyIdentifier Un identifiant de société, principal ou non.
     *
     * @return string|null L'identifiant de routage déduit, ou `null` s'il n'a pas pu être déduit.
     */
    public static function inferDefaultInvoiceRoutingIdentifier(string $companyIdentifier): string|null;

    /**
     * Retourne les mentions légales obligatoires (ou habituellement
     * attendues) pour les factures émises dans ce pays.
     *
     * @return list<LegalMention> Les mentions applicables pour ce pays.
     */
    public static function getInvoiceLegalMentions(): array;

    /**
     * Retourne le motif regex correspondant au format
     * du code d'activité dans le pays.
     *
     * @return string Le motif regex correspondant au format du
     *                code d'activité dans le pays.
     */
    public static function getActivityCodePattern(): string;

    /**
     * Permet de normaliser un code d'activité du pays.
     *
     * @return string Le code d'activité, normalisé.
     */
    public static function normalizeActivityCode(string $rawValue): string;

    /**
     * Tente de déduire (si possible) le numéro de T.V.A depuis un identifiant de société.
     *
     * @param string $companyIdentifier Un identifiant de société, principal ou non.
     *
     * @return string|null Le numéro de T.V.A. s'il a pû être déduit, `null` sinon.
     */
    public static function inferVatNumberFromCompanyIdentifier(string $companyIdentifier): string|null;

    /**
     * Permet de normaliser un numéro de T.V.A. du pays.
     *
     * @return string Le numéro de T.V.A., normalisé.
     */
    public static function normalizeVatNumber(string $rawValue): string;

    /**
     * Retourne le motif regex correspondant au format
     * du numéro de T.V.A dans le pays.
     *
     * @return string Le motif regex correspondant au format du
     *                numéro de T.V.A dans le pays.
     */
    public static function getVatNumberPattern(): string;

    /**
     * Permet de récupérer les formes juridiques liées au pays.
     *
     * @return list<LegalTypeInterface> La liste des formes juridiques.
     */
    public static function getLegalTypes(): array;

    /**
     * Permet de récupérer les codes d'exemption de T.V.A globaux pour le pays.
     *
     * On entends par "global" un code qui s'applique à une organisation entière
     * (e.g. la franchise en base en France ou en Belgique).
     *
     * @return list<VatExemptionCodeInterface> La liste des codes d'exemption de T.V.A. globaux.
     */
    public static function getGlobalVatExemptionCodes(): array;

    /**
     * Permet de récupérer les codes d'exemption de T.V.A. applicable aux lignes de facture pour le pays.
     *
     * @param TaxRegime $regime Le régime pour lequel on veut récupérer les codes d'exemption.
     *
     * @return list<VatExemptionCodeInterface> La liste des codes d'exemption de T.V.A. de ligne.
     */
    public static function getLineVatExemptionCodes(TaxRegime $regime): array;

    /**
     * Retourne le cadre de facturation / type de processus métier à utiliser pour
     * une facture dans le cadre de la facturation électronique.
     *
     * @param Invoice $invoice La facture dont on veut récupérer le cadre de facturation.
     *
     * @return ?BusinessProcessTypeInterface Le type de processus métier déduit, ou `null` si on a pas l'information.
     */
    public static function inferBusinessProcessType(Invoice $invoice): ?BusinessProcessTypeInterface;

    /**
     * Le pays a-t-il un système de T.V.A. simple ?
     *
     * Un système de T.V.A. simple implique qu'un seul taux de
     * T.V.A est appliqué à la fois (à l'inverse d'un système comme
     * celui en vigueur au Québec par exemple).
     *
     * @return bool `true` si le pays a un système de T.V.A. simple, `false`.
     */
    public static function hasSimpleVatSystem(): bool;

    /**
     * Retourne les taux de T.V.A. autorisés pour le pays.
     *
     * @param ?bool $extended Dois-t'on retourner la liste étendue des taxes ?
     *
     * @return list<float> Liste des taux de T.V.A. autorisés.
     */
    public static function getVatRates(?bool $extended = true): array;
}
