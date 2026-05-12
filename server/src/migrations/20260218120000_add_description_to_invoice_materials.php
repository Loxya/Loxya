<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddDescriptionToInvoiceMaterials extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        //
        // - Factures
        //

        $invoice_materials = $this->table('invoice_materials');
        $invoice_materials
            ->addColumn('description', 'text', [
                'null' => true,
                'after' => 'reference',
            ])
            ->update();

        $this->execute(sprintf(
            'UPDATE `%1$sinvoice_materials` AS `invoice_material`
            INNER JOIN `%1$smaterials` AS `material`
                ON `material`.`id` = `invoice_material`.`material_id`
            SET `invoice_material`.`description` = `material`.`description`',
            $prefix,
        ));

        //
        // - Devis
        //

        $estimate_materials = $this->table('estimate_materials');
        $estimate_materials
            ->addColumn('description', 'text', [
                'null' => true,
                'after' => 'reference',
            ])
            ->update();

        $this->execute(sprintf(
            'UPDATE `%1$sestimate_materials` AS `estimate_material`
            INNER JOIN `%1$smaterials` AS `material`
                ON `material`.`id` = `estimate_material`.`material_id`
            SET `estimate_material`.`description` = `material`.`description`',
            $prefix,
        ));
    }

    public function down(): void
    {
        $invoice_materials = $this->table('invoice_materials');
        $invoice_materials
            ->removeColumn('description')
            ->update();

        $estimate_materials = $this->table('estimate_materials');
        $estimate_materials
            ->removeColumn('description')
            ->update();
    }
}
