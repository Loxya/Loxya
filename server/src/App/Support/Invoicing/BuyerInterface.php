<?php
declare(strict_types=1);

namespace Loxya\Support\Invoicing;

use Loxya\Models\Enums\LegalEntityType;
use Loxya\Support\Address;

/**
 * Interface représentant un acheteur dans le contexte de la facturation.
 */
interface BuyerInterface
{
    /**
     * Retourne le type d'entité juridique (particulier ou entreprise) de l'acheteur.
     *
     * @return LegalEntityType|null Le type d'entité juridique, ou `null` si elle n'est pas définie.
     */
    public function getBuyerType(): LegalEntityType|null;

    /**
     * L'acheteur est-il une entité publique ?
     *
     * @return bool `true` si l'acheteur est une entité publique, `false` sinon.
     */
    public function isBuyerPublicEntity(): bool;

    /**
     * Retourne le prénom de l'acheteur ou du contact dans une entreprise acheteuse.
     *
     * @return string|null Le prénom, ou `null` s'il n'est pas défini.
     */
    public function getBuyerFirstName(): string|null;

    /**
     * Retourne le nom de l'acheteur ou du contact dans une entreprise acheteuse.
     *
     * @return string|null Le nom, ou `null` s'il n'est pas défini.
     */
    public function getBuyerLastName(): string|null;

    /**
     * Retourne la raison sociale de l'entreprise acheteuse.
     *
     * @return string|null La raison sociale, ou `null` si elle n'est pas définie.
     */
    public function getBuyerLegalName(): string|null;

    /**
     * Retourne le numéro d'enregistrement (SIRET, BCE, ...) de l'acheteur, uniquement si c'est une entreprise.
     *
     * @return string|null Le numéro d'enregistrement (SIRET, BCE, ...), ou `null` s'il n'est pas défini.
     */
    public function getBuyerRegistrationId(): string|null;

    /**
     * Retourne le numéro de T.V.A. de l'acheteur, uniquement si c'est une entreprise.
     *
     * @return string|null Le numéro de T.V.A., ou `null` s'il n'est pas défini.
     */
    public function getBuyerVatNumber(): string|null;

    /**
     * Retourne le code du service de l'acheteur, uniquement si c'est une entreprise.
     *
     * @return string|null Le code du service, ou `null` s'il n'est pas défini.
     */
    public function getBuyerServiceCode(): string|null;

    /**
     * Retourne l'identifiant de routing e-invoicing de l'acheteur, uniquement si c'est une entreprise.
     *
     * @return string|null L'identifiant de routing, ou `null` s'il n'est pas défini.
     */
    public function getBuyerInvoiceIdentifier(): string|null;

    /**
     * Retourne l'adresse de l'acheteur.
     *
     * @return Address|null L'adresse de l'acheteur, ou `null` si elle n'est pas définie.
     */
    public function getBuyerAddress(): Address|null;

    /**
     * Retourne le numéro de téléphone de l'acheteur.
     *
     * @return string|null Le numéro de téléphone, ou `null` s'il n'est pas défini.
     */
    public function getBuyerPhone(): string|null;

    /**
     * Retourne l'adresse e-mail de l'acheteur.
     *
     * @return string|null L'adresse e-mail, ou `null` si elle n'est pas définie.
     */
    public function getBuyerEmail(): string|null;
}
