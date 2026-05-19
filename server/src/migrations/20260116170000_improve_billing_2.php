<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class ImproveBilling2 extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        // See https://unece.org/fileadmin/DAM/trade/untdid/d16b/tred/tred5305.htm
        $taxRegimeValues = [
            'S', // - Standard
            'AE', // - Auto-liquidation
            'K', // - Auto-liquidation pour cause de livraison intra-communautaire.
            'G', // - Export
            'E', // - Non applicable, exempté de taxe.
        ];

        // See https://unece.org/fileadmin/DAM/trade/untdid/d16b/tred/tred5305.htm
        $globalTaxRegimeValues = [
            'E', // - Non applicable, exempté de taxe.
            'O', // - Hors du périmètre d'application de la TVA
        ];

        //
        // - Événements
        //

        $event_materials = $this->table('event_materials');
        $event_materials
            // Note: Un regime standard (explicite ou déduit) + une TVA à zero équivaut à un régime `Z` (Zero rated goods).
            ->addColumn('tax_regime', 'enum', [
                'values' => $taxRegimeValues,
                'null' => true, // `null`: Exemption globale.
                'default' => null,
                'comment' => 'UNTDID 5305 Code',
                'after' => 'discount_rate',
            ])
            ->addColumn('tax_exemption_code', 'string', [
                'length' => 50,
                'null' => true,
                'default' => null,
                'after' => 'tax_regime',
            ])
            ->addColumn('tax_id', 'integer', [
                'signed' => true,
                'null' => true,
                'default' => null,
                'after' => 'tax_exemption_code',
            ])
            ->addIndex(['tax_id'])
            ->addForeignKey('tax_id', 'taxes', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__event_material__tax',
            ])
            ->update();

        // - Freezing du régime de taxe et de l'identifiant de taxe pour les matériels d'événements facturables.
        $this->execute(sprintf(
            'UPDATE `%1$sevent_materials`
            INNER JOIN `%1$sevents` ON `%1$sevent_materials`.`event_id` = `%1$sevents`.`id`
            SET `%1$sevent_materials`.`tax_regime` = \'S\'
            WHERE `%1$sevents`.`is_billable` = 1',
            $prefix,
        ));
        $this->execute(sprintf(
            'UPDATE `%1$sevent_materials`
            INNER JOIN `%1$sevents` ON `%1$sevent_materials`.`event_id` = `%1$sevents`.`id`
            INNER JOIN `%1$smaterials` ON `%1$sevent_materials`.`material_id` = `%1$smaterials`.`id`
            SET `%1$sevent_materials`.`tax_id` = `%1$smaterials`.`tax_id`
            WHERE `%1$sevents`.`is_billable` = 1
            AND `%1$sevent_materials`.`taxes` IS NOT NULL
            AND `%1$smaterials`.`tax_id` IS NOT NULL',
            $prefix,
        ));

        $event_extras = $this->table('event_extras');
        $event_extras
            ->addColumn('is_service', 'boolean', [
                'null' => false,
                'default' => true,
                'after' => 'event_id',
            ])
            ->addColumn('discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => false,
                'default' => 0,
                'after' => 'quantity',
            ])
            // Note: Un regime standard (explicite ou déduit) + une TVA à zero équivaut à un régime `Z` (Zero rated goods).
            ->addColumn('tax_regime', 'enum', [
                'values' => $taxRegimeValues,
                'null' => true, // `null`: Exemption globale.
                'default' => 'S',
                'comment' => 'UNTDID 5305 Code',
                'after' => 'discount_rate',
            ])
            ->addColumn('tax_exemption_code', 'string', [
                'length' => 50,
                'null' => true,
                'default' => null,
                'after' => 'tax_regime',
            ])
            ->update();

        $event_extras
            ->changeColumn('is_service', 'boolean', [
                'null' => false,
            ])
            ->changeColumn('discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => false,
            ])
            ->update();

        //
        // - Réservations
        //

        $reservation_materials = $this->table('reservation_materials');
        $reservation_materials
            // Note: Un regime standard (explicite ou déduit) + une TVA à zero équivaut à un régime `Z` (Zero rated goods).
            ->addColumn('tax_regime', 'enum', [
                'values' => $taxRegimeValues,
                'null' => true, // `null`: Exemption globale.
                'default' => null,
                'comment' => 'UNTDID 5305 Code',
                'after' => 'discount_rate',
            ])
            ->addColumn('tax_exemption_code', 'string', [
                'length' => 50,
                'null' => true,
                'default' => null,
                'after' => 'tax_regime',
            ])
            ->addColumn('tax_id', 'integer', [
                'signed' => true,
                'null' => true,
                'default' => null,
                'after' => 'tax_exemption_code',
            ])
            ->addIndex(['tax_id'])
            ->addForeignKey('tax_id', 'taxes', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__reservation_material__tax',
            ])
            ->update();

        // - Freezing du régime de taxe et de l'identifiant de taxe pour les matériels de réservations facturables.
        $this->execute(sprintf(
            'UPDATE `%1$sreservation_materials`
            INNER JOIN `%1$sreservations` ON `%1$sreservation_materials`.`reservation_id` = `%1$sreservations`.`id`
            SET `%1$sreservation_materials`.`tax_regime` = \'S\'
            WHERE `%1$sreservations`.`is_billable` = 1',
            $prefix,
        ));
        $this->execute(sprintf(
            'UPDATE `%1$sreservation_materials`
            INNER JOIN `%1$sreservations` ON `%1$sreservation_materials`.`reservation_id` = `%1$sreservations`.`id`
            INNER JOIN `%1$smaterials` ON `%1$sreservation_materials`.`material_id` = `%1$smaterials`.`id`
            SET `%1$sreservation_materials`.`tax_id` = `%1$smaterials`.`tax_id`
            WHERE `%1$sreservations`.`is_billable` = 1
            AND `%1$sreservation_materials`.`taxes` IS NOT NULL
            AND `%1$smaterials`.`tax_id` IS NOT NULL',
            $prefix,
        ));

        $reservation_extras = $this->table('reservation_extras');
        $reservation_extras
            ->addColumn('is_service', 'boolean', [
                'null' => false,
                'default' => true,
                'after' => 'reservation_id',
            ])
            ->addColumn('discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => false,
                'default' => 0,
                'after' => 'quantity',
            ])
            // Note: Un regime standard (explicite ou déduit) + une TVA à zero équivaut à un régime `Z` (Zero rated goods).
            ->addColumn('tax_regime', 'enum', [
                'values' => $taxRegimeValues,
                'null' => true, // `null`: Exemption globale.
                'default' => 'S',
                'comment' => 'UNTDID 5305 Code',
                'after' => 'discount_rate',
            ])
            ->addColumn('tax_exemption_code', 'string', [
                'length' => 50,
                'null' => true,
                'default' => null,
                'after' => 'tax_regime',
            ])
            ->update();

        $reservation_extras
            ->changeColumn('is_service', 'boolean', [
                'null' => false,
            ])
            ->changeColumn('discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => false,
            ])
            ->update();

        //
        // - Devis
        //

        $estimates = $this->table('estimates');
        $estimates
            ->addColumn('global_tax_regime', 'enum', [
                'values' => $globalTaxRegimeValues,
                'null' => true, // `null`: Pas de régime de taxe global.
                'default' => null,
                'comment' => 'UNTDID 5305 Code',
                'after' => 'total_without_taxes',
            ])
            // Note: Obligatoire si `global_tax_regime` = `E` notamment (et que le pays a des codes d'exemption).
            ->addColumn('global_tax_exemption_code', 'string', [
                'length' => 50,
                'null' => true,
                'default' => null,
                'after' => 'global_tax_regime',
            ])
            ->addColumn('global_tax_exemption_reason', 'text', [
                'null' => true,
                'default' => null,
                'after' => 'global_tax_exemption_code',
            ])
            ->update();

        $estimate_materials = $this->table('estimate_materials');
        $estimate_materials
            // Note: Un regime standard (explicite ou déduit) + une TVA à zero équivaut à un régime `Z` (Zero rated goods).
            ->addColumn('tax_regime', 'enum', [
                'values' => $taxRegimeValues,
                'null' => false,
                'default' => 'S',
                'comment' => 'UNTDID 5305 Code',
                'after' => 'total_without_taxes',
            ])
            ->addColumn('tax_exemption_code', 'string', [
                'length' => 50,
                'null' => true,
                'default' => null,
                'after' => 'tax_regime',
            ])
            ->changeColumn('taxes', 'json', [
                'null' => true,
                'default' => null,
                'after' => 'tax_exemption_code',
            ])
            ->update();

        $estimate_materials
            ->changeColumn('tax_regime', 'enum', [
                'values' => $taxRegimeValues,
                'null' => true,
                'default' => null,
                'comment' => 'UNTDID 5305 Code',
            ])
            ->update();

        $estimate_extras = $this->table('estimate_extras');
        $estimate_extras
            ->addColumn('is_service', 'boolean', [
                'null' => false,
                'default' => true,
                'after' => 'estimate_id',
            ])
            ->addColumn('discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => false,
                'default' => 0,
                'after' => 'quantity',
            ])
            ->addColumn('total_without_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'discount_rate',
            ])
            ->addColumn('total_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
                'default' => 0,
                'after' => 'total_without_discount',
            ])
            ->addColumn('tax_regime', 'enum', [
                'values' => $taxRegimeValues,
                'null' => false,
                'default' => 'S',
                'comment' => 'UNTDID 5305 Code',
                'after' => 'total_without_taxes',
            ])
            ->addColumn('tax_exemption_code', 'string', [
                'length' => 50,
                'null' => true,
                'default' => null,
                'after' => 'tax_regime',
            ])
            ->update();

        $this->execute(sprintf(
            'UPDATE `%sestimate_extras` SET `total_without_discount` = `total_without_taxes`',
            $prefix,
        ));

        $estimate_extras
            ->changeColumn('is_service', 'boolean', [
                'null' => false,
            ])
            ->changeColumn('discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => false,
            ])
            ->changeColumn('tax_regime', 'enum', [
                'values' => $taxRegimeValues,
                'null' => true,
                'default' => null,
                'comment' => 'UNTDID 5305 Code',
            ])
            ->changeColumn('total_without_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('total_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->update();

        //
        // - Factures
        //

        $invoices = $this->table('invoices');
        $invoices
            ->addColumn('global_tax_regime', 'enum', [
                'values' => $globalTaxRegimeValues,
                'null' => true, // `null`: Pas de régime de taxe global.
                'default' => null,
                'comment' => 'UNTDID 5305 Code',
                'after' => 'total_without_taxes',
            ])
            // Note: Obligatoire si `global_tax_regime` = `E` notamment (et que le pays a des codes d'exemption).
            ->addColumn('global_tax_exemption_code', 'string', [
                'length' => 50,
                'null' => true,
                'default' => null,
                'after' => 'global_tax_regime',
            ])
            ->addColumn('global_tax_exemption_reason', 'text', [
                'null' => true,
                'default' => null,
                'after' => 'global_tax_exemption_code',
            ])
            ->update();

        $invoice_materials = $this->table('invoice_materials');
        $invoice_materials
            // Note: Un regime standard (explicite ou déduit) + une TVA à zero équivaut à un régime `Z` (Zero rated goods).
            ->addColumn('tax_regime', 'enum', [
                'values' => $taxRegimeValues,
                'null' => false,
                'default' => 'S',
                'comment' => 'UNTDID 5305 Code',
                'after' => 'total_without_taxes',
            ])
            ->addColumn('tax_exemption_code', 'string', [
                'length' => 50,
                'null' => true,
                'default' => null,
                'after' => 'tax_regime',
            ])
            ->changeColumn('taxes', 'json', [
                'null' => true,
                'default' => null,
                'after' => 'tax_exemption_code',
            ])
            ->update();

        $invoice_materials
            ->changeColumn('tax_regime', 'enum', [
                'values' => $taxRegimeValues,
                'null' => true,
                'default' => null,
                'comment' => 'UNTDID 5305 Code',
            ])
            ->update();

        $invoice_extras = $this->table('invoice_extras');
        $invoice_extras
            ->addColumn('is_service', 'boolean', [
                'null' => false,
                'default' => true,
                'after' => 'invoice_id',
            ])
            ->addColumn('discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => false,
                'default' => 0,
                'after' => 'quantity',
            ])
            ->addColumn('total_without_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
                'after' => 'discount_rate',
            ])
            ->addColumn('total_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
                'default' => 0,
                'after' => 'total_without_discount',
            ])
            ->addColumn('tax_regime', 'enum', [
                'values' => $taxRegimeValues,
                'null' => false,
                'default' => 'S',
                'comment' => 'UNTDID 5305 Code',
                'after' => 'total_without_taxes',
            ])
            ->addColumn('tax_exemption_code', 'string', [
                'length' => 50,
                'null' => true,
                'default' => null,
                'after' => 'tax_regime',
            ])
            ->update();

        $this->execute(sprintf(
            'UPDATE `%sinvoice_extras` SET `total_without_discount` = `total_without_taxes`',
            $prefix,
        ));

        $invoice_extras
            ->changeColumn('is_service', 'boolean', [
                'null' => false,
            ])
            ->changeColumn('discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => false,
            ])
            ->changeColumn('tax_regime', 'enum', [
                'values' => $taxRegimeValues,
                'null' => true,
                'default' => null,
                'comment' => 'UNTDID 5305 Code',
            ])
            ->changeColumn('total_without_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->changeColumn('total_discount', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => false,
            ])
            ->update();
    }

    public function down(): void
    {
        //
        // - Événements
        //

        $event_materials = $this->table('event_materials');
        $event_materials
            ->dropForeignKey('tax_id')
            ->update();
        $event_materials
            ->removeColumn('tax_id')
            ->removeColumn('tax_regime')
            ->removeColumn('tax_exemption_code')
            ->update();

        $event_extras = $this->table('event_extras');
        $event_extras
            ->removeColumn('is_service')
            ->removeColumn('discount_rate')
            ->removeColumn('tax_regime')
            ->removeColumn('tax_exemption_code')
            ->update();

        //
        // - Réservations
        //

        $reservation_materials = $this->table('reservation_materials');
        $reservation_materials
            ->dropForeignKey('tax_id')
            ->update();
        $reservation_materials
            ->removeColumn('tax_id')
            ->removeColumn('tax_regime')
            ->removeColumn('tax_exemption_code')
            ->update();

        $reservation_extras = $this->table('reservation_extras');
        $reservation_extras
            ->removeColumn('is_service')
            ->removeColumn('discount_rate')
            ->removeColumn('tax_regime')
            ->removeColumn('tax_exemption_code')
            ->update();

        //
        // - Devis
        //

        $estimates = $this->table('estimates');
        $estimates
            ->removeColumn('global_tax_regime')
            ->removeColumn('global_tax_exemption_code')
            ->removeColumn('global_tax_exemption_reason')
            ->update();

        $estimate_materials = $this->table('estimate_materials');
        $estimate_materials
            ->removeColumn('tax_regime')
            ->removeColumn('tax_exemption_code')
            ->update();

        $estimate_extras = $this->table('estimate_extras');
        $estimate_extras
            ->removeColumn('is_service')
            ->removeColumn('discount_rate')
            ->removeColumn('tax_regime')
            ->removeColumn('tax_exemption_code')
            ->removeColumn('total_without_discount')
            ->removeColumn('total_discount')
            ->update();

        //
        // - Factures
        //

        $invoices = $this->table('invoices');
        $invoices
            ->removeColumn('global_tax_regime')
            ->removeColumn('global_tax_exemption_code')
            ->removeColumn('global_tax_exemption_reason')
            ->update();

        $invoice_materials = $this->table('invoice_materials');
        $invoice_materials
            ->removeColumn('tax_regime')
            ->removeColumn('tax_exemption_code')
            ->update();

        $invoice_extras = $this->table('invoice_extras');
        $invoice_extras
            ->removeColumn('is_service')
            ->removeColumn('discount_rate')
            ->removeColumn('tax_regime')
            ->removeColumn('tax_exemption_code')
            ->removeColumn('total_without_discount')
            ->removeColumn('total_discount')
            ->update();
    }
}
