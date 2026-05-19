<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class CreateReservations extends AbstractMigration
{
    public function up(): void
    {
        //
        // - Approbation des demandes
        //

        $material_approvers = $this->table('material_approvers', [
            'id' => false,
            'primary_key' => ['material_id', 'user_id'],
        ]);
        $material_approvers
            ->addColumn('material_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('user_id', 'integer', ['signed' => true, 'null' => false])
            ->addIndex(['material_id'])
            ->addForeignKey('material_id', 'materials', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__material_approver__material',
            ])
            ->addIndex(['user_id'])
            ->addForeignKey('user_id', 'users', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__material_approver__user',
            ])
            ->create();

        $category_approvers = $this->table('category_approvers', [
            'id' => false,
            'primary_key' => ['category_id', 'user_id'],
        ]);
        $category_approvers
            ->addColumn('category_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('user_id', 'integer', ['signed' => true, 'null' => false])
            ->addIndex(['category_id'])
            ->addForeignKey('category_id', 'categories', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__category_approver__category',
            ])
            ->addIndex(['user_id'])
            ->addForeignKey('user_id', 'users', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__category_approver__user',
            ])
            ->create();

        //
        // - Réservations
        //

        $reservations = $this->table('reservations', ['signed' => true]);
        $reservations
            ->addColumn('borrower_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('status', 'enum', [
                'values' => ['pending', 'approved', 'rejected'],
                'default' => 'pending',
                'null' => false,
            ])
            ->addColumn('status_reason', 'text', ['null' => true, 'default' => null])
            ->addColumn('approver_id', 'integer', [
                'signed' => true,
                'null' => true,
                'default' => null,
            ])
            ->addColumn('start_date', 'date', ['null' => false])
            ->addColumn('end_date', 'date', ['null' => false])
            ->addColumn('is_billable', 'boolean', ['null' => false])
            ->addColumn('degressive_rate', 'decimal', [
                'precision' => 7,
                'scale' => 2,
                'null' => true,
            ])
            ->addColumn('vat_rate', 'decimal', [
                'precision' => 4,
                'scale' => 2,
                'null' => true,
            ])
            ->addColumn('daily_total_without_taxes', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
            ])
            ->addColumn('daily_total_taxes', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
            ])
            ->addColumn('daily_total_with_taxes', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
            ])
            ->addColumn('total_without_taxes', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
            ])
            ->addColumn('total_taxes', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
            ])
            ->addColumn('total_with_taxes', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
            ])
            ->addColumn('currency', 'char', ['length' => 3, 'null' => true])
            ->addColumn('borrower_comment', 'text', ['null' => true, 'default' => null])
            ->addColumn('is_archived', 'boolean', [
                'null' => false,
                'default' => false,
            ])
            ->addColumn('is_return_inventory_done', 'boolean', [
                'null' => false,
                'default' => false,
            ])
            ->addColumn('created_at', 'datetime', ['null' => false])
            ->addColumn('updated_at', 'datetime', ['null' => true])
            ->addIndex(['borrower_id'])
            ->addForeignKey('borrower_id', 'beneficiaries', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__reservation__borrower',
            ])
            ->addIndex(['approver_id'])
            ->addForeignKey('approver_id', 'users', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__reservation__approver',
            ])
            ->create();

        $reservation_materials = $this->table('reservation_materials', ['signed' => true]);
        $reservation_materials
            ->addColumn('reservation_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('material_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('quantity', 'smallinteger', [
                'signed' => false,
                'length' => 5,
                'null' => false,
            ])
            ->addColumn('unit_price', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
            ])
            ->addColumn('total_price', 'decimal', [
                'precision' => 8,
                'scale' => 2,
                'null' => true,
            ])
            ->addColumn('is_approved', 'boolean', [
                'null' => false,
                'default' => false,
            ])
            ->addColumn('approver_id', 'integer', [
                'signed' => true,
                'null' => true,
                'default' => null,
            ])
            ->addColumn('quantity_returned', 'smallinteger', [
                'length' => 5,
                'null' => true,
                'default' => null,
            ])
            ->addColumn('quantity_returned_broken', 'smallinteger', [
                'length' => 5,
                'null' => true,
                'default' => null,
            ])
            ->addIndex(['reservation_id'])
            ->addForeignKey('reservation_id', 'reservations', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__reservation_material__reservation',
            ])
            ->addIndex(['material_id'])
            ->addForeignKey('material_id', 'materials', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__reservation_material__material',
            ])
            ->addIndex(['approver_id'])
            ->addForeignKey('approver_id', 'users', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__reservation_material__approver',
            ])
            ->addIndex(['reservation_id', 'material_id'], ['unique' => true])
            ->create();

        $reservation_material_units = $this->table('reservation_material_units', ['signed' => true]);
        $reservation_material_units
            ->addColumn('reservation_material_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('material_unit_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('is_returned', 'boolean', [
                'default' => false,
                'null' => false,
            ])
            ->addColumn('is_returned_broken', 'boolean', [
                'default' => false,
                'null' => false,
            ])
            ->addIndex(['reservation_material_id'])
            ->addForeignKey('reservation_material_id', 'reservation_materials', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__reservation_material_unit__reservation_material',
            ])
            ->addIndex(['material_unit_id'])
            ->addForeignKey('material_unit_id', 'material_units', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__reservation_material_unit__material_unit',
            ])
            ->addIndex(['reservation_material_id', 'material_unit_id'], ['unique' => true])
            ->create();
    }

    public function down(): void
    {
        $this->table('material_approvers')->drop()->save();
        $this->table('category_approvers')->drop()->save();

        $this->table('reservation_material_units')->drop()->save();
        $this->table('reservation_materials')->drop()->save();
        $this->table('reservations')->drop()->save();
    }
}
