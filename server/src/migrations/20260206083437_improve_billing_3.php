<?php
declare(strict_types=1);

use Brick\Math\BigDecimal as Decimal;
use Loxya\Config\Config;
use Loxya\Support\Validation\Validator as V;
use Phinx\Migration\AbstractMigration;

final class ImproveBilling3 extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');
        $organization = Config::get('organization');
        $mainCountryCode = Config::get('mainCountry');

        $sellerData = [
            'seller_legal_name' => $organization['name'],
            'seller_registration_id' => $organization['registrationId'],
            'seller_vat_number' => (
                !$organization['isVatExempted']
                    ? $organization['vatNumber']
                    : null
            ),
            'seller_legal_type' => $organization['legalType']?->value,
            'seller_share_capital' => $organization['shareCapital'],
            'seller_activity_code' => $organization['activityCode'],
            'seller_trade_registry_city' => $organization['tradeRegistryCity'],
            'seller_street' => $organization['street'][0] ?? null,
            'seller_additional_street' => $organization['street'][1] ?? null,
            'seller_postal_code' => $organization['postalCode'],
            'seller_administrative_area' => $organization['administrativeArea'],
            'seller_locality' => $organization['locality'],
            'seller_country' => $organization['country'],
            'seller_email' => $organization['email'],
            'seller_phone' => $organization['phone'],
        ];

        //
        // - Devis
        //

        $estimates = $this->table('estimates');

        //
        // -- Vendeur
        //

        $estimates
            ->addColumn('seller_legal_name', 'string', [
                'length' => 100,
                'null' => true, // => `false`
                'after' => 'due_date',
            ])
            ->addColumn('seller_registration_id', 'string', [
                'length' => 50,
                'null' => true, // => `false`
                'after' => 'seller_legal_name',
            ])
            ->addColumn('seller_vat_number', 'string', [
                'length' => 50,
                'null' => true,
                'after' => 'seller_registration_id',
            ])
            ->addColumn('seller_legal_type', 'string', [
                'length' => 20,
                'null' => true,
                'default' => null,
                'comment' => 'LegalType Enum Value',
                'after' => 'seller_vat_number',
            ])
            ->addColumn('seller_share_capital', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'seller_legal_type',
            ])
            ->addColumn('seller_activity_code', 'string', [
                'length' => 30,
                'null' => true,
                'default' => null,
                'comment' => 'APE / NACE / etc. Code',
                'after' => 'seller_share_capital',
            ])
            ->addColumn('seller_trade_registry_city', 'string', [
                'length' => 50,
                'null' => true,
                'default' => null,
                'after' => 'seller_activity_code',
            ])
            ->addColumn('seller_street', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'seller_trade_registry_city',
            ])
            ->addColumn('seller_additional_street', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'seller_street',
            ])
            ->addColumn('seller_postal_code', 'string', [
                'length' => 10,
                'null' => true,
                'after' => 'seller_additional_street',
            ])
            ->addColumn('seller_administrative_area', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'seller_postal_code',
            ])
            ->addColumn('seller_locality', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'seller_administrative_area',
            ])
            ->addColumn('seller_country', 'char', [
                'length' => 2,
                'null' => true, // => `false`,
                'after' => 'seller_locality',
            ])
            ->addColumn('seller_email', 'string', [
                'length' => 191,
                'null' => true,
                'default' => null,
                'after' => 'seller_country',
            ])
            ->addColumn('seller_phone', 'string', [
                'length' => 24,
                'null' => true,
                'default' => null,
                'after' => 'seller_email',
            ])
            ->update();

        //
        // -- Acheteur
        //

        $estimates
            ->renameColumn('beneficiary_id', 'buyer_id')
            ->changeColumn('buyer_id', 'integer', [
                'signed' => true,
                'null' => false,
                'after' => 'seller_phone',
            ])
            ->update();

        $estimates
            ->addColumn('buyer_type', 'enum', [
                'values' => ['company', 'individual'],
                'null' => true, // => `false`
                'after' => 'buyer_id',
            ])
            ->addColumn('buyer_reference', 'string', [
                'length' => 96,
                'null' => true,
                'default' => null,
                'after' => 'buyer_type',
            ])
            ->addColumn('buyer_legal_name', 'string', [
                'length' => 191,
                'null' => true,
                'default' => null,
                'after' => 'buyer_reference',
            ])
            ->addColumn('buyer_registration_id', 'string', [
                'length' => 50,
                'null' => true,
                'default' => null,
                'after' => 'buyer_legal_name',
            ])
            ->addColumn('buyer_vat_number', 'string', [
                'length' => 50,
                'null' => true,
                'after' => 'buyer_registration_id',
            ])
            ->addColumn('buyer_first_name', 'string', [
                'length' => 35,
                'null' => true,
                'default' => null,
                'comment' => 'Contact last name if the buyer is a company',
                'after' => 'buyer_vat_number',
            ])
            ->addColumn('buyer_last_name', 'string', [
                'length' => 35,
                'null' => true,
                'default' => null,
                'comment' => 'Contact last name if the buyer is a company',
                'after' => 'buyer_first_name',
            ])
            ->addColumn('buyer_street', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'buyer_last_name',
            ])
            ->addColumn('buyer_additional_street', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'buyer_street',
            ])
            ->addColumn('buyer_postal_code', 'string', [
                'length' => 10,
                'null' => true,
                'after' => 'buyer_additional_street',
            ])
            ->addColumn('buyer_administrative_area', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'buyer_postal_code',
            ])
            ->addColumn('buyer_locality', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'buyer_administrative_area',
            ])
            ->addColumn('buyer_country', 'char', [
                'length' => 2,
                'null' => true, // => `false`,
                'after' => 'buyer_locality',
            ])
            ->addColumn('buyer_email', 'string', [
                'length' => 191,
                'null' => true,
                'default' => null,
                'after' => 'buyer_country',
            ])
            ->addColumn('buyer_phone', 'string', [
                'length' => 24,
                'null' => true,
                'default' => null,
                'after' => 'buyer_email',
            ])

            //
            // -- Autres
            //

            ->addColumn('is_vat_due_on_invoice', 'boolean', [
                'null' => false,
                'default' => false,
                'after' => 'is_legacy',
            ])
            ->addColumn('special_mentions', 'text', [
                'null' => true,
                'default' => null,
                'after' => 'total_replacement',
            ])
            ->update();

        $estimatesData = $this->getSelectBuilder()
            ->select([
                'estimate.id',
                'buyer.company_id',
                'buyer_reference' => 'buyer.reference',
                'person.first_name',
                'person.last_name',
                'person.email',
                'person.phone',
                'person.street',
                'person.additional_street',
                'person.postal_code',
                'person.administrative_area',
                'person.locality',
                'person.country',
                'company_legal_name' => 'company.legal_name',
                'company_registration_id' => 'company.registration_id',
                'company_vat_number' => 'company.vat_number',
                'company_phone' => 'company.phone',
                'company_street' => 'company.street',
                'company_additional_street' => 'company.additional_street',
                'company_postal_code' => 'company.postal_code',
                'company_administrative_area' => 'company.administrative_area',
                'company_locality' => 'company.locality',
                'company_country' => 'company.country',
            ])
            ->from(['estimate' => sprintf('%sestimates', $prefix)])
            ->innerJoin(
                ['buyer' => sprintf('%sbeneficiaries', $prefix)],
                'estimate.buyer_id = buyer.id',
            )
            ->innerJoin(
                ['person' => sprintf('%spersons', $prefix)],
                'buyer.person_id = person.id',
            )
            ->leftJoin(
                ['company' => sprintf('%scompanies', $prefix)],
                'buyer.company_id = company.id',
            )
            ->execute()->fetchAll('assoc');

        foreach ($estimatesData as $estimateDatum) {
            $isCompany = $estimateDatum['company_id'] !== null;

            $buyerCountryCode = $isCompany
                ? $estimateDatum['company_country']
                : $estimateDatum['country'];

            $buyerPhone = $isCompany
                ? $estimateDatum['company_phone']
                : $estimateDatum['phone'];

            $isValidBuyerPhone = (
                V::phone($mainCountryCode)->validate($buyerPhone) ||
                V::phone($buyerCountryCode ?? $mainCountryCode)->validate($buyerPhone)
            );
            if (!$isValidBuyerPhone) {
                $buyerPhone = null;
            }

            $this->getUpdateBuilder()
                ->update(sprintf('%sestimates', $prefix))
                ->set($sellerData)
                ->set([
                    'buyer_type' => $isCompany ? 'company' : 'individual',
                    'buyer_reference' => $estimateDatum['buyer_reference'],
                    'buyer_legal_name' => $isCompany ? $estimateDatum['company_legal_name'] : null,
                    'buyer_registration_id' => $isCompany ? $estimateDatum['company_registration_id'] : null,
                    'buyer_vat_number' => $isCompany ? $estimateDatum['company_vat_number'] : null,
                    'buyer_first_name' => $estimateDatum['first_name'],
                    'buyer_last_name' => $estimateDatum['last_name'],
                    'buyer_street' => (
                        $isCompany
                            ? $estimateDatum['company_street']
                            : $estimateDatum['street']
                    ),
                    'buyer_additional_street' => (
                        $isCompany
                            ? $estimateDatum['company_additional_street']
                            : $estimateDatum['additional_street']
                    ),
                    'buyer_postal_code' => (
                        $isCompany
                            ? $estimateDatum['company_postal_code']
                            : $estimateDatum['postal_code']
                    ),
                    'buyer_administrative_area' => (
                        $isCompany
                            ? $estimateDatum['company_administrative_area']
                            : $estimateDatum['administrative_area']
                    ),
                    'buyer_locality' => (
                        $isCompany
                            ? $estimateDatum['company_locality']
                            : $estimateDatum['locality']
                    ),
                    'buyer_country' => $buyerCountryCode,
                    'buyer_email' => $estimateDatum['email'],
                    'buyer_phone' => $buyerPhone,
                ])
                ->where(['id' => $estimateDatum['id']])
                ->execute();
        }

        $estimates
            //
            // -- Vendeur
            //

            ->changeColumn('seller_legal_name', 'string', [
                'length' => 50,
                'null' => false,
            ])
            ->changeColumn('seller_registration_id', 'string', [
                'length' => 50,
                'null' => false,
            ])
            ->changeColumn('seller_country', 'char', [
                'length' => 2,
                'null' => false,
            ])

            //
            // -- Acheteur
            //

            ->changeColumn('buyer_type', 'enum', [
                'values' => ['company', 'individual'],
                'null' => false,
            ])
            ->changeColumn('buyer_country', 'char', [
                'length' => 2,
                'null' => false,
            ])

            //
            // -- Autres
            //

            ->changeColumn('is_vat_due_on_invoice', 'boolean', [
                'null' => false,
            ])
            ->update();

        //
        // - Factures
        //

        $invoices = $this->table('invoices');

        //
        // -- Vendeur
        //

        $invoices
            ->addColumn('seller_legal_name', 'string', [
                'length' => 50,
                'null' => true, // => `false`
                'after' => 'due_date',
            ])
            ->addColumn('seller_registration_id', 'string', [
                'length' => 50,
                'null' => true, // => `false`
                'after' => 'seller_legal_name',
            ])
            ->addColumn('seller_vat_number', 'string', [
                'length' => 50,
                'null' => true,
                'after' => 'seller_registration_id',
            ])
            ->addColumn('seller_legal_type', 'string', [
                'length' => 20,
                'null' => true,
                'default' => null,
                'comment' => 'LegalType Enum Value',
                'after' => 'seller_vat_number',
            ])
            ->addColumn('seller_share_capital', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'seller_legal_type',
            ])
            ->addColumn('seller_activity_code', 'string', [
                'length' => 30,
                'null' => true,
                'default' => null,
                'comment' => 'APE / NACE / etc. Code',
                'after' => 'seller_share_capital',
            ])
            ->addColumn('seller_trade_registry_city', 'string', [
                'length' => 50,
                'null' => true,
                'default' => null,
                'after' => 'seller_activity_code',
            ])
            ->addColumn('seller_street', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'seller_trade_registry_city',
            ])
            ->addColumn('seller_additional_street', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'seller_street',
            ])
            ->addColumn('seller_postal_code', 'string', [
                'length' => 10,
                'null' => true,
                'after' => 'seller_additional_street',
            ])
            ->addColumn('seller_administrative_area', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'seller_postal_code',
            ])
            ->addColumn('seller_locality', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'seller_administrative_area',
            ])
            ->addColumn('seller_country', 'char', [
                'length' => 2,
                'null' => true, // => `false`,
                'after' => 'seller_locality',
            ])
            ->addColumn('seller_email', 'string', [
                'length' => 191,
                'null' => true,
                'default' => null,
                'after' => 'seller_country',
            ])
            ->addColumn('seller_phone', 'string', [
                'length' => 24,
                'null' => true,
                'default' => null,
                'after' => 'seller_email',
            ])
            ->update();

        //
        // -- Acheteur
        //

        $invoices
            ->renameColumn('beneficiary_id', 'buyer_id')
            ->changeColumn('buyer_id', 'integer', [
                'signed' => true,
                'null' => false,
                'after' => 'seller_phone',
            ])
            ->update();

        $invoices
            ->addColumn('buyer_type', 'enum', [
                'values' => ['company', 'individual'],
                'null' => true, // => `false`
                'after' => 'buyer_id',
            ])
            ->addColumn('buyer_reference', 'string', [
                'length' => 96,
                'null' => true,
                'default' => null,
                'after' => 'buyer_type',
            ])
            ->addColumn('buyer_legal_name', 'string', [
                'length' => 191,
                'null' => true,
                'default' => null,
                'after' => 'buyer_reference',
            ])
            ->addColumn('buyer_registration_id', 'string', [
                'length' => 50,
                'null' => true,
                'default' => null,
                'after' => 'buyer_legal_name',
            ])
            ->addColumn('buyer_vat_number', 'string', [
                'length' => 50,
                'null' => true,
                'after' => 'buyer_registration_id',
            ])
            ->addColumn('buyer_first_name', 'string', [
                'length' => 35,
                'null' => true,
                'default' => null,
                'comment' => 'Contact last name if the buyer is a company',
                'after' => 'buyer_vat_number',
            ])
            ->addColumn('buyer_last_name', 'string', [
                'length' => 35,
                'null' => true,
                'default' => null,
                'comment' => 'Contact last name if the buyer is a company',
                'after' => 'buyer_first_name',
            ])
            ->addColumn('buyer_street', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'buyer_last_name',
            ])
            ->addColumn('buyer_additional_street', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'buyer_street',
            ])
            ->addColumn('buyer_postal_code', 'string', [
                'length' => 10,
                'null' => true,
                'after' => 'buyer_additional_street',
            ])
            ->addColumn('buyer_administrative_area', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'buyer_postal_code',
            ])
            ->addColumn('buyer_locality', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'buyer_administrative_area',
            ])
            ->addColumn('buyer_country', 'char', [
                'length' => 2,
                'null' => true, // => `false`,
                'after' => 'buyer_locality',
            ])
            ->addColumn('buyer_email', 'string', [
                'length' => 191,
                'null' => true,
                'default' => null,
                'after' => 'buyer_country',
            ])
            ->addColumn('buyer_phone', 'string', [
                'length' => 24,
                'null' => true,
                'default' => null,
                'after' => 'buyer_email',
            ])

            //
            // -- Autres
            //

            ->addColumn('order_number', 'string', [
                'length' => 50,
                'null' => true,
                'default' => null,
                'after' => 'number',
            ])
            ->addColumn('is_electronic', 'boolean', [
                'null' => false,
                'default' => false,
                'after' => 'is_legacy',
            ])
            ->addColumn('is_prepayment', 'boolean', [
                'null' => false,
                'default' => false,
                'after' => 'is_electronic',
            ])
            ->addColumn('is_credit_note', 'boolean', [
                'null' => false,
                'default' => false,
                'after' => 'is_prepayment',
            ])
            ->addColumn('is_vat_due_on_invoice', 'boolean', [
                'null' => false,
                'default' => false,
                'after' => 'is_credit_note',
            ])
            ->addColumn('parent_estimate_id', 'integer', [
                'signed' => true,
                'null' => true,
                'after' => 'is_vat_due_on_invoice',
            ])
            ->addColumn('parent_invoice_id', 'integer', [
                'signed' => true,
                'null' => true,
                'after' => 'parent_estimate_id',
            ])
            ->addColumn('special_mentions', 'text', [
                'null' => true,
                'default' => null,
                'after' => 'total_replacement',
            ])
            ->addIndex(['parent_estimate_id'])
            ->addIndex(['parent_invoice_id'])
            ->addForeignKey('parent_estimate_id', 'estimates', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__invoices__parent_estimate',
            ])
            ->addForeignKey('parent_invoice_id', 'invoices', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__invoices__parent_invoice',
            ])
            ->update();

        // - Migration des données des invoices.
        $invoicesData = $this->getSelectBuilder()
            ->select([
                'invoice.id',
                'invoice.total_with_taxes',
                'buyer.company_id',
                'buyer_reference' => 'buyer.reference',
                'person.first_name',
                'person.last_name',
                'person.email',
                'person.phone',
                'person.street',
                'person.additional_street',
                'person.postal_code',
                'person.administrative_area',
                'person.locality',
                'person.country',
                'company_legal_name' => 'company.legal_name',
                'company_registration_id' => 'company.registration_id',
                'company_vat_number' => 'company.vat_number',
                'company_phone' => 'company.phone',
                'company_street' => 'company.street',
                'company_additional_street' => 'company.additional_street',
                'company_postal_code' => 'company.postal_code',
                'company_administrative_area' => 'company.administrative_area',
                'company_locality' => 'company.locality',
                'company_country' => 'company.country',
            ])
            ->from(['invoice' => sprintf('%sinvoices', $prefix)])
            ->innerJoin(
                ['buyer' => sprintf('%sbeneficiaries', $prefix)],
                'invoice.buyer_id = buyer.id',
            )
            ->innerJoin(
                ['person' => sprintf('%spersons', $prefix)],
                'buyer.person_id = person.id',
            )
            ->leftJoin(
                ['company' => sprintf('%scompanies', $prefix)],
                'buyer.company_id = company.id',
            )
            ->execute()->fetchAll('assoc');

        foreach ($invoicesData as $invoiceDatum) {
            $isCompany = $invoiceDatum['company_id'] !== null;

            $buyerCountryCode = $isCompany
                ? $invoiceDatum['company_country']
                : $invoiceDatum['country'];

            $buyerPhone = $isCompany
                ? $invoiceDatum['company_phone']
                : $invoiceDatum['phone'];

            $isValidBuyerPhone = (
                V::phone($mainCountryCode)->validate($buyerPhone) ||
                V::phone($buyerCountryCode ?? $mainCountryCode)->validate($buyerPhone)
            );
            if (!$isValidBuyerPhone) {
                $buyerPhone = null;
            }

            $this->getUpdateBuilder()
                ->update(sprintf('%sinvoices', $prefix))
                ->set($sellerData)
                ->set([
                    'buyer_type' => $isCompany ? 'company' : 'individual',
                    'buyer_reference' => $invoiceDatum['buyer_reference'],
                    'buyer_legal_name' => $isCompany ? $invoiceDatum['company_legal_name'] : null,
                    'buyer_registration_id' => $isCompany ? $invoiceDatum['company_registration_id'] : null,
                    'buyer_vat_number' => $isCompany ? $invoiceDatum['company_vat_number'] : null,
                    'buyer_first_name' => $invoiceDatum['first_name'],
                    'buyer_last_name' => $invoiceDatum['last_name'],
                    'buyer_street' => (
                        $isCompany
                            ? $invoiceDatum['company_street']
                            : $invoiceDatum['street']
                    ),
                    'buyer_additional_street' => (
                        $isCompany
                            ? $invoiceDatum['company_additional_street']
                            : $invoiceDatum['additional_street']
                    ),
                    'buyer_postal_code' => (
                        $isCompany
                            ? $invoiceDatum['company_postal_code']
                            : $invoiceDatum['postal_code']
                    ),
                    'buyer_administrative_area' => (
                        $isCompany
                            ? $invoiceDatum['company_administrative_area']
                            : $invoiceDatum['administrative_area']
                    ),
                    'buyer_locality' => (
                        $isCompany
                            ? $invoiceDatum['company_locality']
                            : $invoiceDatum['locality']
                    ),
                    'buyer_country' => $buyerCountryCode,
                    'buyer_email' => $invoiceDatum['email'],
                    'buyer_phone' => $buyerPhone,
                    'is_credit_note' => (
                        Decimal::of($invoiceDatum['total_with_taxes'])
                            ->isNegative() ? 1 : 0
                    ),
                ])
                ->where(['id' => $invoiceDatum['id']])
                ->execute();
        }

        $invoices
            //
            // -- Vendeur
            //

            ->changeColumn('seller_legal_name', 'string', [
                'length' => 50,
                'null' => false,
            ])
            ->changeColumn('seller_registration_id', 'string', [
                'length' => 50,
                'null' => false,
            ])
            ->changeColumn('seller_country', 'char', [
                'length' => 2,
                'null' => false,
            ])

            //
            // -- Acheteur
            //

            ->changeColumn('buyer_type', 'enum', [
                'values' => ['company', 'individual'],
                'null' => false,
            ])
            ->changeColumn('buyer_country', 'char', [
                'length' => 2,
                'null' => false,
            ])

            //
            // -- Autres
            //

            ->changeColumn('is_electronic', 'boolean', [
                'null' => false,
            ])
            ->changeColumn('is_vat_due_on_invoice', 'boolean', [
                'null' => false,
            ])
            ->update();

        //
        // - Autres
        //

        $pending_users = $this->table('pending_users');
        $pending_users
            ->changeColumn('company_legal_name', 'string', [
                'length' => 50,
                'null' => true,
            ])
            ->update();
    }

    public function down(): void
    {
        //
        // - Devis
        //

        $estimates = $this->table('estimates');
        $estimates
            //
            // -- Vendeur
            //

            ->removeColumn('seller_legal_name')
            ->removeColumn('seller_registration_id')
            ->removeColumn('seller_vat_number')
            ->removeColumn('seller_legal_type')
            ->removeColumn('seller_share_capital')
            ->removeColumn('seller_activity_code')
            ->removeColumn('seller_trade_registry_city')
            ->removeColumn('seller_street')
            ->removeColumn('seller_additional_street')
            ->removeColumn('seller_postal_code')
            ->removeColumn('seller_administrative_area')
            ->removeColumn('seller_locality')
            ->removeColumn('seller_country')
            ->removeColumn('seller_email')
            ->removeColumn('seller_phone')

            //
            // -- Acheteur
            //

            ->renameColumn('buyer_id', 'beneficiary_id')
            ->changeColumn('beneficiary_id', 'integer', [
                'signed' => true,
                'null' => false,
                'after' => 'booking_is_full_days',
            ])
            ->removeColumn('buyer_type')
            ->removeColumn('buyer_reference')
            ->removeColumn('buyer_legal_name')
            ->removeColumn('buyer_registration_id')
            ->removeColumn('buyer_vat_number')
            ->removeColumn('buyer_first_name')
            ->removeColumn('buyer_last_name')
            ->removeColumn('buyer_street')
            ->removeColumn('buyer_additional_street')
            ->removeColumn('buyer_postal_code')
            ->removeColumn('buyer_administrative_area')
            ->removeColumn('buyer_locality')
            ->removeColumn('buyer_country')
            ->removeColumn('buyer_email')
            ->removeColumn('buyer_phone')

            //
            // -- Autres
            //

            ->removeColumn('is_vat_due_on_invoice')
            ->removeColumn('special_mentions')
            ->update();

        //
        // - Factures
        //

        $invoices = $this->table('invoices');
        $invoices
            ->dropForeignKey('parent_estimate_id')
            ->removeIndex(['parent_estimate_id'])
            ->dropForeignKey('parent_invoice_id')
            ->removeIndex(['parent_invoice_id'])
            ->update();

        $invoices
            //
            // -- Vendeur
            //

            ->removeColumn('seller_legal_name')
            ->removeColumn('seller_registration_id')
            ->removeColumn('seller_vat_number')
            ->removeColumn('seller_legal_type')
            ->removeColumn('seller_share_capital')
            ->removeColumn('seller_activity_code')
            ->removeColumn('seller_trade_registry_city')
            ->removeColumn('seller_street')
            ->removeColumn('seller_additional_street')
            ->removeColumn('seller_postal_code')
            ->removeColumn('seller_administrative_area')
            ->removeColumn('seller_locality')
            ->removeColumn('seller_country')
            ->removeColumn('seller_email')
            ->removeColumn('seller_phone')

            //
            // -- Acheteur
            //

            ->renameColumn('buyer_id', 'beneficiary_id')
            ->changeColumn('beneficiary_id', 'integer', [
                'signed' => true,
                'null' => false,
                'after' => 'booking_is_full_days',
            ])
            ->removeColumn('buyer_type')
            ->removeColumn('buyer_reference')
            ->removeColumn('buyer_legal_name')
            ->removeColumn('buyer_registration_id')
            ->removeColumn('buyer_vat_number')
            ->removeColumn('buyer_first_name')
            ->removeColumn('buyer_last_name')
            ->removeColumn('buyer_street')
            ->removeColumn('buyer_additional_street')
            ->removeColumn('buyer_postal_code')
            ->removeColumn('buyer_administrative_area')
            ->removeColumn('buyer_locality')
            ->removeColumn('buyer_country')
            ->removeColumn('buyer_email')
            ->removeColumn('buyer_phone')

            //
            // -- Autres
            //

            ->removeColumn('order_number')
            ->removeColumn('is_electronic')
            ->removeColumn('is_prepayment')
            ->removeColumn('is_credit_note')
            ->removeColumn('is_vat_due_on_invoice')
            ->removeColumn('special_mentions')
            ->removeColumn('parent_estimate_id')
            ->removeColumn('parent_invoice_id')
            ->update();

        //
        // - Autres
        //

        $pending_users = $this->table('pending_users');
        $pending_users
            ->changeColumn('company_legal_name', 'string', [
                'length' => 191,
                'null' => true,
            ])
            ->update();
    }
}
