<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class ImproveBillsTable extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        //
        // - Factures
        //

        $invoicesData = [];
        $rawInvoicesData = $this->fetchAll(sprintf(
            'SELECT
                `bill`.*,
                `event`.`title` as `booking_title`,
                `event`.`start_date` as `booking_start_date`,
                `event`.`end_date` as `booking_end_date`
             FROM `%1$sbills` as `bill`
             INNER JOIN `%1$sevents` as `event`
                ON `bill`.`event_id` = `event`.`id`',
            $prefix,
        ));
        foreach ($rawInvoicesData as $rawInvoice) {
            $rawMaterials = $this->fetchAll(vsprintf(
                'SELECT
                    `material`.`id` as `material_id`,
                    `material`.`name`,
                    `material`.`reference`,
                    `material`.`rental_price`,
                    `material`.`is_discountable`,
                    `material`.`is_hidden_on_bill`,
                    `material`.`replacement_price`,
                    `event_material`.`quantity`
                 FROM `%1$sevent_materials` AS `event_material`
                 INNER JOIN `%1$smaterials` AS `material`
                    ON `material`.`id` = `event_material`.`material_id`
                 WHERE `event_material`.`event_id` = %2$d',
                [$prefix, $rawInvoice['event_id']],
            ));

            $invoiceMaterials = [];
            foreach ($rawMaterials as $index => $rawMaterial) {
                $invoiceMaterials[$index] = [
                    'invoice_id' => $rawInvoice['id'],
                    'material_id' => $rawMaterial['material_id'],
                    'name' => $rawMaterial['name'],
                    'reference' => $rawMaterial['reference'],
                    'quantity' => $rawMaterial['quantity'],
                    'unit_price' => $rawMaterial['rental_price'],
                    'total_price' => ((float) $rawMaterial['rental_price']) * ((int) $rawMaterial['quantity']),
                    'replacement_price' => $rawMaterial['replacement_price'],
                    'is_hidden_on_bill' => $rawMaterial['is_hidden_on_bill'],
                    'is_discountable' => $rawMaterial['is_discountable'],
                ];
            }

            $dailyTotalWithoutDiscount = array_reduce(
                $invoiceMaterials,
                static fn ($total, $invoiceMaterial) => (
                    $total + $invoiceMaterial['total_price']
                ),
                0,
            );

            // - Remise.
            $dailyTotalDiscountable = array_reduce(
                $invoiceMaterials,
                static function ($total, $invoiceMaterial) {
                    if ((bool) $invoiceMaterial['is_discountable']) {
                        return $total + $invoiceMaterial['total_price'];
                    }
                    return $total;
                },
                0.0,
            );
            $discountRate = ((float) $rawInvoice['discount_rate']) / 100;
            $dailyTotalDiscount = $dailyTotalDiscountable * $discountRate;
            $dailyTotalWithoutTaxes = $dailyTotalWithoutDiscount - $dailyTotalDiscount;

            // - Taxes.
            $vatPercent = Config::get('legacy.companyData.vatRate');
            $vatRate = ((float) $vatPercent) / 100;
            $dailyTotalTaxes = $dailyTotalWithoutTaxes * $vatRate;
            $dailyTotalWithTaxes = $dailyTotalWithoutTaxes + $dailyTotalTaxes;

            // - Totals.
            $degressiveRate = (float) $rawInvoice['degressive_rate'];
            $totalWithoutTaxes = round($dailyTotalWithoutTaxes * $degressiveRate, 2);
            $totalTaxes = round($totalWithoutTaxes * $vatRate, 2);
            $totalWithTaxes = round($dailyTotalWithTaxes * $degressiveRate, 2);

            $totalReplacement = array_reduce(
                $invoiceMaterials,
                static function ($total, $invoiceMaterial) {
                    $replacementPrice = (
                        ((float) $invoiceMaterial['replacement_price'])
                        *
                        ((int) $invoiceMaterial['quantity'])
                    );
                    return $total + $replacementPrice;
                },
                0.0,
            );

            $invoicesData[$rawInvoice['id']] = [
                'materials' => $invoiceMaterials,

                'booking_title' => $rawInvoice['booking_title'],
                'booking_start_date' => $rawInvoice['booking_start_date'],
                'booking_end_date' => $rawInvoice['booking_end_date'],

                'vat_rate' => $vatPercent,

                'daily_total_without_discount' => $dailyTotalWithoutDiscount,
                'daily_total_discountable' => $dailyTotalDiscountable,
                'daily_total_discount' => $dailyTotalDiscount,
                'daily_total_without_taxes' => round($dailyTotalWithoutTaxes, 2),

                'daily_total_taxes' => round($dailyTotalTaxes, 2),
                'daily_total_with_taxes' => round($dailyTotalWithTaxes, 2),

                'total_without_taxes' => $totalWithoutTaxes,
                'total_taxes' => $totalTaxes,
                'total_with_taxes' => $totalWithTaxes,

                'total_replacement' => $totalReplacement,
            ];
        }

        $bills = $this->table('bills');
        $bills
            ->rename('invoices')
            ->dropForeignKey('event_id')
            ->removeIndex(['event_id'])
            ->dropForeignKey('user_id')
            ->removeIndex(['user_id'])
            ->update();

        $invoice_materials = $this->table('invoice_materials', ['signed' => true]);
        $invoice_materials
            ->addColumn('invoice_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('material_id', 'integer', ['signed' => true, 'null' => true])
            ->addColumn('name', 'string', ['length' => 191, 'null' => false])
            ->addColumn('reference', 'string', ['length' => 64, 'null' => false])
            ->addColumn('quantity', 'smallinteger', [
                'signed' => false,
                'length' => 5,
                'null' => false,
            ])
            ->addColumn('unit_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->addColumn('total_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->addColumn('replacement_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
            ])
            ->addColumn('is_hidden_on_bill', 'boolean', [
                'null' => false,
            ])
            ->addColumn('is_discountable', 'boolean', [
                'null' => false,
            ])
            ->addIndex(['invoice_id'])
            ->addForeignKey('invoice_id', 'invoices', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__invoice_material__invoice',
            ])
            ->addIndex(['material_id'])
            ->addForeignKey('material_id', 'materials', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__invoice_material__material',
            ])
            ->create();

        $invoices = $this->table('invoices');
        $invoices
            ->renameColumn('event_id', 'booking_id')
            ->addColumn('booking_type', 'enum', [
                'values' => ['event', 'reservation'],
                'after' => 'date',
                'default' => 'event',
                'null' => false,
            ])
            ->addColumn('booking_title', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'booking_id',
            ])
            ->addColumn('booking_start_date', 'datetime', [
                'null' => true,
                'after' => 'booking_title',
            ])
            ->addColumn('booking_end_date', 'datetime', [
                'null' => true,
                'after' => 'booking_start_date',
            ])
            ->removeColumn('materials')
            ->renameColumn('user_id', 'author_id')
            ->renameColumn('replacement_amount', 'total_replacement')
            ->changeColumn('discount_rate', 'decimal', [
                'precision' => 6,
                'scale' => 4,
                'null' => false,
                'default' => 0,
            ])
            ->changeColumn('vat_rate', 'decimal', [
                'precision' => 4,
                'scale' => 2,
                'null' => false,
                'default' => 0,
            ])
            ->addColumn('daily_total_without_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'vat_rate',
            ])
            ->addColumn('daily_total_discountable', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'daily_total_without_discount',
            ])
            ->addColumn('daily_total_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'daily_total_discountable',
            ])
            ->addColumn('daily_total_without_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'daily_total_discount',
            ])
            ->addColumn('daily_total_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'daily_total_without_taxes',
            ])
            ->addColumn('daily_total_with_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'daily_total_taxes',
            ])
            ->renameColumn('due_amount', 'total_without_taxes')
            ->addColumn('total_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'total_without_taxes',
            ])
            ->addColumn('total_with_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'total_taxes',
            ])
            ->addIndex(['booking_type', 'booking_id'])
            ->addIndex(['author_id'])
            ->addForeignKey('author_id', 'users', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__invoice__author',
            ])
            ->update();

        foreach ($invoicesData as $invoiceId => $invoiceData) {
            $materialsData = $invoiceData['materials'];
            unset($invoiceData['materials']);

            // - Factures.
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sinvoices', $prefix))
                ->set($invoiceData)
                ->where(['id' => $invoiceId])
                ->execute();

            // - Matériels de la facture.
            $invoice_materials
                ->insert($materialsData)
                ->saveData();
        }

        // - On enlève les `default` non désirés...
        //   (après a voir mis les colonnes existantes `null` avec la bonne valeur)
        $invoices
            ->changeColumn('booking_type', 'enum', [
                'values' => ['event', 'reservation'],
                'null' => false,
            ])
            ->changeColumn('booking_start_date', 'datetime', ['null' => false])
            ->changeColumn('booking_end_date', 'datetime', ['null' => false])
            ->changeColumn('vat_rate', 'decimal', [
                'precision' => 4,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('discount_rate', 'decimal', [
                'precision' => 6,
                'scale' => 4,
                'null' => false,
            ])
            ->changeColumn('daily_total_without_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('daily_total_discountable', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('daily_total_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('daily_total_without_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('daily_total_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('daily_total_with_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('total_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('total_with_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->update();

        //
        // - Devis
        //

        $estimatesData = [];
        $rawEstimatesData = $this->fetchAll(sprintf(
            'SELECT
                `estimate`.*,
                `event`.`title` as `booking_title`,
                `event`.`start_date` as `booking_start_date`,
                `event`.`end_date` as `booking_end_date`
             FROM `%1$sestimates` as `estimate`
             INNER JOIN `%1$sevents` as `event`
                ON `estimate`.`event_id` = `event`.`id`',
            $prefix,
        ));
        foreach ($rawEstimatesData as $rawEstimate) {
            $rawMaterials = $this->fetchAll(vsprintf(
                'SELECT
                    `material`.`id` as `material_id`,
                    `material`.`name`,
                    `material`.`reference`,
                    `material`.`rental_price`,
                    `material`.`is_discountable`,
                    `material`.`is_hidden_on_bill`,
                    `material`.`replacement_price`,
                    `event_material`.`quantity`
                 FROM `%1$sevent_materials` AS `event_material`
                 INNER JOIN `%1$smaterials` AS `material`
                    ON `material`.`id` = `event_material`.`material_id`
                 WHERE `event_material`.`event_id` = %2$d',
                [$prefix, $rawEstimate['event_id']],
            ));

            $estimateMaterials = [];
            foreach ($rawMaterials as $index => $rawMaterial) {
                $estimateMaterials[$index] = [
                    'estimate_id' => $rawEstimate['id'],
                    'material_id' => $rawMaterial['material_id'],
                    'name' => $rawMaterial['name'],
                    'reference' => $rawMaterial['reference'],
                    'quantity' => $rawMaterial['quantity'],
                    'unit_price' => $rawMaterial['rental_price'],
                    'total_price' => ((float) $rawMaterial['rental_price']) * ((int) $rawMaterial['quantity']),
                    'replacement_price' => $rawMaterial['replacement_price'],
                    'is_hidden_on_bill' => $rawMaterial['is_hidden_on_bill'],
                    'is_discountable' => $rawMaterial['is_discountable'],
                ];
            }

            $dailyTotalWithoutDiscount = array_reduce(
                $estimateMaterials,
                static fn ($total, $estimateMaterial) => (
                    $total + $estimateMaterial['total_price']
                ),
                0,
            );

            // - Remise.
            $dailyTotalDiscountable = array_reduce(
                $estimateMaterials,
                static function ($total, $estimateMaterial) {
                    if ((bool) $estimateMaterial['is_discountable']) {
                        return $total + $estimateMaterial['total_price'];
                    }
                    return $total;
                },
                0.0,
            );
            $discountRate = ((float) $rawEstimate['discount_rate']) / 100;
            $dailyTotalDiscount = $dailyTotalDiscountable * $discountRate;
            $dailyTotalWithoutTaxes = $dailyTotalWithoutDiscount - $dailyTotalDiscount;

            // - Taxes.
            $vatPercent = Config::get('legacy.companyData.vatRate');
            $vatRate = ((float) $vatPercent) / 100;
            $dailyTotalTaxes = $dailyTotalWithoutTaxes * $vatRate;
            $dailyTotalWithTaxes = $dailyTotalWithoutTaxes + $dailyTotalTaxes;

            // - Totals.
            $degressiveRate = (float) $rawEstimate['degressive_rate'];
            $totalWithoutTaxes = round($dailyTotalWithoutTaxes * $degressiveRate, 2);
            $totalTaxes = round($totalWithoutTaxes * $vatRate, 2);
            $totalWithTaxes = round($dailyTotalWithTaxes * $degressiveRate, 2);

            $totalReplacement = array_reduce(
                $estimateMaterials,
                static function ($total, $estimateMaterial) {
                    $replacementPrice = (
                        ((float) $estimateMaterial['replacement_price'])
                        *
                        ((int) $estimateMaterial['quantity'])
                    );
                    return $total + $replacementPrice;
                },
                0.0,
            );

            $estimatesData[$rawEstimate['id']] = [
                'materials' => $estimateMaterials,

                'booking_title' => $rawEstimate['booking_title'],
                'booking_start_date' => $rawEstimate['booking_start_date'],
                'booking_end_date' => $rawEstimate['booking_end_date'],

                'vat_rate' => $vatPercent,

                'daily_total_without_discount' => $dailyTotalWithoutDiscount,
                'daily_total_discountable' => $dailyTotalDiscountable,
                'daily_total_discount' => $dailyTotalDiscount,
                'daily_total_without_taxes' => round($dailyTotalWithoutTaxes, 2),

                'daily_total_taxes' => round($dailyTotalTaxes, 2),
                'daily_total_with_taxes' => round($dailyTotalWithTaxes, 2),

                'total_without_taxes' => $totalWithoutTaxes,
                'total_taxes' => $totalTaxes,
                'total_with_taxes' => $totalWithTaxes,

                'total_replacement' => $totalReplacement,
            ];
        }

        $estimate_materials = $this->table('estimate_materials', ['signed' => true]);
        $estimate_materials
            ->addColumn('estimate_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('material_id', 'integer', ['signed' => true, 'null' => true])
            ->addColumn('name', 'string', ['length' => 191, 'null' => false])
            ->addColumn('reference', 'string', ['length' => 64, 'null' => false])
            ->addColumn('quantity', 'smallinteger', [
                'signed' => false,
                'length' => 5,
                'null' => false,
            ])
            ->addColumn('unit_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->addColumn('total_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->addColumn('replacement_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
            ])
            ->addColumn('is_hidden_on_bill', 'boolean', [
                'null' => false,
            ])
            ->addColumn('is_discountable', 'boolean', [
                'null' => false,
            ])
            ->addIndex(['estimate_id'])
            ->addForeignKey('estimate_id', 'estimates', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__estimate_material__estimate',
            ])
            ->addIndex(['material_id'])
            ->addForeignKey('material_id', 'materials', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__estimate_material__material',
            ])
            ->create();

        $estimates = $this->table('estimates');
        $estimates
            ->dropForeignKey('event_id')
            ->removeIndex(['event_id'])
            ->dropForeignKey('user_id')
            ->removeIndex(['user_id'])
            ->update();

        $estimates
            ->renameColumn('event_id', 'booking_id')
            ->addColumn('booking_type', 'enum', [
                'values' => ['event', 'reservation'],
                'after' => 'date',
                'default' => 'event',
                'null' => false,
            ])
            ->addColumn('booking_title', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'booking_id',
            ])
            ->addColumn('booking_start_date', 'datetime', [
                'null' => true,
                'after' => 'booking_title',
            ])
            ->addColumn('booking_end_date', 'datetime', [
                'null' => true,
                'after' => 'booking_start_date',
            ])
            ->removeColumn('materials')
            ->renameColumn('user_id', 'author_id')
            ->renameColumn('replacement_amount', 'total_replacement')
            ->changeColumn('discount_rate', 'decimal', [
                'precision' => 6,
                'scale' => 4,
                'null' => false,
                'default' => 0,
            ])
            ->changeColumn('vat_rate', 'decimal', [
                'precision' => 4,
                'scale' => 2,
                'null' => false,
                'default' => 0,
            ])
            ->addColumn('daily_total_without_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'vat_rate',
            ])
            ->addColumn('daily_total_discountable', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'daily_total_without_discount',
            ])
            ->addColumn('daily_total_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'daily_total_discountable',
            ])
            ->addColumn('daily_total_without_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'daily_total_discount',
            ])
            ->addColumn('daily_total_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'daily_total_without_taxes',
            ])
            ->addColumn('daily_total_with_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'daily_total_taxes',
            ])
            ->renameColumn('due_amount', 'total_without_taxes')
            ->addColumn('total_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'total_without_taxes',
            ])
            ->addColumn('total_with_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'after' => 'total_taxes',
            ])
            ->addIndex(['booking_type', 'booking_id'])
            ->addIndex(['author_id'])
            ->addForeignKey('author_id', 'users', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__estimate__author',
            ])
            ->update();

        foreach ($estimatesData as $estimateId => $estimateData) {
            $materialsData = $estimateData['materials'];
            unset($estimateData['materials']);

            // - Devis.
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sestimates', $prefix))
                ->set($estimateData)
                ->where(['id' => $estimateId])
                ->execute();

            // - Matériels du devis.
            $estimate_materials
                ->insert($materialsData)
                ->saveData();
        }

        // - On enlève les `default` non désirés...
        //   (après a voir mis les colonnes existantes `null` avec la bonne valeur)
        $estimates
            ->changeColumn('booking_type', 'enum', [
                'values' => ['event', 'reservation'],
                'null' => false,
            ])
            ->changeColumn('booking_start_date', 'datetime', ['null' => false])
            ->changeColumn('booking_end_date', 'datetime', ['null' => false])
            ->changeColumn('vat_rate', 'decimal', [
                'precision' => 4,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('discount_rate', 'decimal', [
                'precision' => 6,
                'scale' => 4,
                'null' => false,
            ])
            ->changeColumn('daily_total_without_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('daily_total_discountable', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('daily_total_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('daily_total_without_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('daily_total_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('daily_total_with_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('total_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('total_with_taxes', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->update();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $incompatibleInvoices = $this->fetchAll(
            sprintf("SELECT * FROM `%sinvoices` WHERE `booking_type` <> 'event'", $prefix),
        );
        $incompatibleEstimates = $this->fetchAll(
            sprintf("SELECT * FROM `%sestimates` WHERE `booking_type` <> 'event'", $prefix),
        );
        if (count($incompatibleInvoices) > 0 || count($incompatibleEstimates) > 0) {
            throw new \RuntimeException(
                "Unable to rollback the migration, this would cause the " .
                "loss of all reservation's invoices / estimates.",
            );
        }

        //
        // - Factures
        //

        $billsMaterialsData = [];
        $rawInvoicesData = $this->fetchAll(sprintf("SELECT * FROM `%sinvoices`", $prefix));
        foreach ($rawInvoicesData as $rawInvoice) {
            $rawInvoiceMaterials = $this->fetchAll(vsprintf(
                'SELECT
                    `invoice_material`.*,
                    `material`.`park_id`,
                    `material`.`category_id`,
                    `material`.`sub_category_id`
                 FROM `%1$sinvoice_materials` AS `invoice_material`
                 LEFT JOIN `%1$smaterials` AS `material`
                    ON `material`.`id` = `invoice_material`.`material_id`
                 WHERE `invoice_material`.`invoice_id` = %2$d',
                [$prefix, $rawInvoice['id']],
            ));

            $billsMaterialsData[$rawInvoice['id']] = json_encode(array_map(
                static fn ($rawInvoiceMaterial) => [
                    'id' => $rawInvoiceMaterial['material_id'],
                    'name' => $rawInvoiceMaterial['name'],
                    'reference' => $rawInvoiceMaterial['reference'],
                    'park_id' => $rawInvoiceMaterial['park_id'] ?? null,
                    'category_id' => $rawInvoiceMaterial['category_id'] ?? null,
                    'sub_category_id' => $rawInvoiceMaterial['sub_category_id'] ?? null,
                    'quantity' => $rawInvoiceMaterial['quantity'],
                    'rental_price' => $rawInvoiceMaterial['unit_price'],
                    'replacement_price' => $rawInvoiceMaterial['replacement_price'],
                    'is_hidden_on_bill' => $rawInvoiceMaterial['is_hidden_on_bill'],
                    'is_discountable' => $rawInvoiceMaterial['is_discountable'],
                ],
                $rawInvoiceMaterials,
            ));
        }

        $this->table('invoice_materials')->drop()->save();

        $invoices = $this->table('invoices');
        $invoices
            ->rename('bills')
            ->removeIndex(['booking_type', 'booking_id'])
            ->dropForeignKey('author_id')
            ->removeIndex(['author_id'])
            ->update();

        $bills = $this->table('bills');
        $bills
            ->removeColumn('booking_type')
            ->removeColumn('booking_title')
            ->removeColumn('booking_start_date')
            ->removeColumn('booking_end_date')
            ->renameColumn('booking_id', 'event_id')
            ->renameColumn('author_id', 'user_id')
            ->renameColumn('total_replacement', 'replacement_amount')
            ->addColumn('materials', 'json', [
                'null' => true,
                'after' => 'beneficiary_id',
            ])
            ->changeColumn('discount_rate', 'decimal', [
                'precision' => 6,
                'scale' => 4,
                'null' => true,
            ])
            ->changeColumn('vat_rate', 'decimal', [
                'precision' => 4,
                'scale' => 2,
                'null' => true,
            ])
            ->removeColumn('daily_total_without_discount')
            ->removeColumn('daily_total_discountable')
            ->removeColumn('daily_total_discount')
            ->removeColumn('daily_total_without_taxes')
            ->removeColumn('daily_total_taxes')
            ->removeColumn('daily_total_with_taxes')
            ->renameColumn('total_without_taxes', 'due_amount')
            ->removeColumn('total_taxes')
            ->removeColumn('total_with_taxes')
            ->addIndex(['event_id'])
            ->addForeignKey('event_id', 'events', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__invoice_event',
            ])
            ->addIndex(['user_id'])
            ->addForeignKey('user_id', 'users', 'id', [
                'delete' => 'NO_ACTION',
                'update' => 'NO_ACTION',
                'constraint' => 'fk_bill_user',
            ])
            ->update();

        foreach ($billsMaterialsData as $billId => $materialsData) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sbills', $prefix))
                ->set('materials', $materialsData)
                ->where(['id' => $billId])
                ->execute();
        }

        $bills
            ->changeColumn('materials', 'json', ['null' => false])
            ->update();

        //
        // - Devis
        //

        $estimatesMaterialsData = [];
        $rawEstimatesData = $this->fetchAll(sprintf("SELECT * FROM `%sestimates`", $prefix));
        foreach ($rawEstimatesData as $rawEstimate) {
            $rawEstimateMaterials = $this->fetchAll(vsprintf(
                'SELECT
                    `estimate_material`.*,
                    `material`.`park_id`,
                    `material`.`category_id`,
                    `material`.`sub_category_id`
                 FROM `%1$sestimate_materials` AS `estimate_material`
                 LEFT JOIN `%1$smaterials` AS `material`
                    ON `material`.`id` = `estimate_material`.`material_id`
                 WHERE `estimate_material`.`estimate_id` = %2$d',
                [$prefix, $rawEstimate['id']],
            ));

            $estimatesMaterialsData[$rawEstimate['id']] = json_encode(array_map(
                static fn ($rawEstimateMaterial) => [
                    'id' => $rawEstimateMaterial['material_id'],
                    'name' => $rawEstimateMaterial['name'],
                    'reference' => $rawEstimateMaterial['reference'],
                    'park_id' => $rawEstimateMaterial['park_id'] ?? null,
                    'category_id' => $rawEstimateMaterial['category_id'] ?? null,
                    'sub_category_id' => $rawEstimateMaterial['sub_category_id'] ?? null,
                    'quantity' => $rawEstimateMaterial['quantity'],
                    'rental_price' => $rawEstimateMaterial['unit_price'],
                    'replacement_price' => $rawEstimateMaterial['replacement_price'],
                    'is_hidden_on_bill' => $rawEstimateMaterial['is_hidden_on_bill'],
                    'is_discountable' => $rawEstimateMaterial['is_discountable'],
                ],
                $rawEstimateMaterials,
            ));
        }

        $this->table('estimate_materials')->drop()->save();

        $estimates = $this->table('estimates');
        $estimates
            ->removeIndex(['booking_type', 'booking_id'])
            ->dropForeignKey('author_id')
            ->removeIndex(['author_id'])
            ->update();

        $estimates
            ->removeColumn('booking_type')
            ->removeColumn('booking_title')
            ->removeColumn('booking_start_date')
            ->removeColumn('booking_end_date')
            ->renameColumn('booking_id', 'event_id')
            ->renameColumn('author_id', 'user_id')
            ->renameColumn('total_replacement', 'replacement_amount')
            ->addColumn('materials', 'json', [
                'null' => true,
                'after' => 'beneficiary_id',
            ])
            ->changeColumn('discount_rate', 'decimal', [
                'precision' => 6,
                'scale' => 4,
                'null' => true,
            ])
            ->changeColumn('vat_rate', 'decimal', [
                'precision' => 4,
                'scale' => 2,
                'null' => true,
            ])
            ->removeColumn('daily_total_without_discount')
            ->removeColumn('daily_total_discountable')
            ->removeColumn('daily_total_discount')
            ->removeColumn('daily_total_without_taxes')
            ->removeColumn('daily_total_taxes')
            ->removeColumn('daily_total_with_taxes')
            ->renameColumn('total_without_taxes', 'due_amount')
            ->removeColumn('total_taxes')
            ->removeColumn('total_with_taxes')
            ->addIndex(['event_id'])
            ->addForeignKey('event_id', 'events', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__estimate_event',
            ])
            ->addIndex(['user_id'])
            ->addForeignKey('user_id', 'users', 'id', [
                'delete' => 'NO_ACTION',
                'update' => 'NO_ACTION',
                'constraint' => 'fk_estimate_user',
            ])
            ->update();

        foreach ($estimatesMaterialsData as $estimateId => $materialsData) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sestimates', $prefix))
                ->set('materials', $materialsData)
                ->where(['id' => $estimateId])
                ->execute();
        }

        $estimates
            ->changeColumn('materials', 'json', ['null' => false])
            ->update();
    }
}
