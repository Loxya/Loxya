<?php
declare(strict_types=1);

namespace NumNum\UBL;

use Sabre\Xml\Service;
use function Sabre\Xml\Deserializer\keyValue;

class Reader
{
    public static $currencyID;

    public static function ubl($currencyId = 'EUR'): Service
    {
        self::$currencyID = $currencyId;

        $xmlService = new Service();
        $xmlService->options = LIBXML_PARSEHUGE;

        $xmlService->namespaceMap = [
            Schema::INVOICE => '',
            Schema::CBC => 'cbc',
            Schema::CAC => 'cac',
        ];

        $xmlService->elementMap = [
            Schema::INVOICE . 'Invoice' => Invoice::xmlDeserialize(...),
            Schema::CREDITNOTE . 'CreditNote' => CreditNote::xmlDeserialize(...),
            Schema::DEBITNOTE . 'DebitNote' => DebitNote::xmlDeserialize(...),
            Schema::CAC . 'AccountingCustomerParty' => AccountingParty::xmlDeserialize(...),
            Schema::CAC . 'AccountingSupplierParty' => AccountingParty::xmlDeserialize(...),
            Schema::CAC . 'AdditionalDocumentReference' => AdditionalDocumentReference::xmlDeserialize(...),
            Schema::CAC . 'Address' => Address::xmlDeserialize(...),
            Schema::CAC . 'AddressLine' => AddressLine::xmlDeserialize(...),
            Schema::CAC . 'AllowanceCharge' => AllowanceCharge::xmlDeserialize(...),
            Schema::CAC . 'Attachment' => Attachment::xmlDeserialize(...),
            Schema::CAC . 'BillingReference' => BillingReference::xmlDeserialize(...),
            Schema::CAC . 'BillingReferenceLine' => static fn ($reader)
                => keyValue($reader)[Schema::CBC . 'ID'] ?? null,
            Schema::CAC . 'ClassifiedTaxCategory' => ClassifiedTaxCategory::xmlDeserialize(...),
            Schema::CAC . 'CommodityClassification' => CommodityClassification::xmlDeserialize(...),
            Schema::CAC . 'Contact' => Contact::xmlDeserialize(...),
            Schema::CAC . 'ContractDocumentReference' => ContractDocumentReference::xmlDeserialize(...),
            Schema::CAC . 'Country' => Country::xmlDeserialize(...),
            Schema::CAC . 'DespatchDocumentReference' => DespatchDocumentReference::xmlDeserialize(...),
            Schema::CAC . 'CreditNoteLine' => CreditNoteLine::xmlDeserialize(...),
            Schema::CAC . 'DebitNoteLine' => DebitNoteLine::xmlDeserialize(...),
            Schema::CAC . 'Delivery' => Delivery::xmlDeserialize(...),
            Schema::CAC . 'FinancialInstitutionBranch' => FinancialInstitutionBranch::xmlDeserialize(...),
            Schema::CAC . 'InvoiceDocumentReference' => InvoiceDocumentReference::xmlDeserialize(...),
            Schema::CAC . 'InvoiceLine' => InvoiceLine::xmlDeserialize(...),
            Schema::CAC . 'InvoicePeriod' => InvoicePeriod::xmlDeserialize(...),
            Schema::CAC . 'Item' => Item::xmlDeserialize(...),
            Schema::CAC . 'LegalMonetaryTotal' => LegalMonetaryTotal::xmlDeserialize(...),
            Schema::CAC . 'OrderLineReference' => OrderLineReference::xmlDeserialize(...),
            Schema::CAC . 'OrderReference' => OrderReference::xmlDeserialize(...),
            Schema::CAC . 'OriginCountry' => Country::xmlDeserialize(...),
            Schema::CAC . 'Party' => Party::xmlDeserialize(...),
            Schema::CAC . 'PartyIdentification' => PartyIdentification::xmlDeserialize(...),
            Schema::CAC . 'PartyLegalEntity' => LegalEntity::xmlDeserialize(...),
            Schema::CAC . 'PartyTaxScheme' => PartyTaxScheme::xmlDeserialize(...),
            Schema::CAC . 'OriginatorDocumentReference' => OriginatorDocumentReference::xmlDeserialize(...),
            Schema::CAC . 'PayeeFinancialAccount' => PayeeFinancialAccount::xmlDeserialize(...),
            Schema::CAC . 'PayeeParty' => PayeeParty::xmlDeserialize(...),
            Schema::CAC . 'PaymentMandate' => PaymentMandate::xmlDeserialize(...),
            Schema::CAC . 'PaymentMeans' => PaymentMeans::xmlDeserialize(...),
            Schema::CAC . 'PaymentTerms' => PaymentTerms::xmlDeserialize(...),
            Schema::CAC . 'ReceiptDocumentReference' => ReceiptDocumentReference::xmlDeserialize(...),
            Schema::CAC . 'PostalAddress' => Address::xmlDeserialize(...),
            Schema::CAC . 'Price' => Price::xmlDeserialize(...),
            Schema::CAC . 'ProjectReference' => ProjectReference::xmlDeserialize(...),
            Schema::CAC . 'SettlementPeriod' => SettlementPeriod::xmlDeserialize(...),
            Schema::CAC . 'TaxCategory' => TaxCategory::xmlDeserialize(...),
            Schema::CAC . 'TaxScheme' => TaxScheme::xmlDeserialize(...),
            Schema::CAC . 'TaxSubtotal' => TaxSubTotal::xmlDeserialize(...),
            Schema::CAC . 'TaxTotal' => TaxTotal::xmlDeserialize(...),
        ];

        return $xmlService;
    }
}
