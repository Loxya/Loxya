<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class CreateRequests extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        $requests = $this->table('requests', ['signed' => true]);
        $requests
            ->addColumn('reference', 'char', [
                'length' => 6,
                'null' => true,
                'after' => 'id',
            ])
            ->addColumn('borrower_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('status', 'enum', [
                'values' => ['pending', 'approved', 'rejected'],
                'default' => 'pending',
                'null' => false,
            ])
            ->addColumn('status_reason', 'text')
            ->addColumn('approver_id', 'integer', [
                'signed' => true,
                'null' => true,
                'default' => null,
            ])
            ->addColumn('operation_start_date', 'datetime', ['null' => false])
            ->addColumn('operation_end_date', 'datetime', ['null' => false])
            ->addColumn('operation_is_full_days', 'boolean', [
                'default' => false,
                'null' => false,
            ])
            ->addColumn('is_billable', 'boolean', ['null' => false])
            ->addColumn('global_discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => true,
            ])
            ->addColumn('currency', 'char', ['length' => 3, 'null' => false])
            ->addColumn('comment', 'text', ['null' => true, 'default' => null])
            ->addTimestamps()
            ->addIndex(['borrower_id'])
            ->addForeignKey('borrower_id', 'beneficiaries', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__request__borrower',
            ])
            ->addIndex(['approver_id'])
            ->addForeignKey('approver_id', 'users', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__request__approver',
            ])
            ->create();

        $request_materials = $this->table('request_materials', ['signed' => true]);
        $request_materials
            ->addColumn('request_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('material_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('name', 'string', [
                'length' => 191,
                'null' => true,
            ])
            ->addColumn('reference', 'string', [
                'length' => 64,
                'null' => true,
            ])
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
            ->addColumn('degressive_rate', 'decimal', [
                'precision' => 7,
                'scale' => 2,
                'null' => true, // => `null`: Facturation désactivée pour la demande.
                'default' => null,
            ])
            ->addColumn('discount_rate', 'decimal', [
                'precision' => 7,
                'scale' => 4,
                'null' => true, // => `null`: Facturation désactivée pour la demande.
                'default' => null,
            ])
            ->addColumn('taxes', 'json', [
                'null' => true, // => `null`: Pas de taxe ou facturation désactivée pour la demande.
                'default' => null,
            ])
            ->addColumn('unit_replacement_price', 'decimal', [
                'precision' => 14,
                'scale' => 2,
                'null' => true,
                'default' => null,
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
            ->addIndex(['request_id'])
            ->addForeignKey('request_id', 'requests', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__request_material__request',
            ])
            ->addIndex(['material_id'])
            ->addForeignKey('material_id', 'materials', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__request_material__material',
            ])
            ->addIndex(['approver_id'])
            ->addForeignKey('approver_id', 'users', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__request_material__approver',
            ])
            ->addIndex(['request_id', 'material_id'], ['unique' => true])
            ->create();

        $request_material_units = $this->table('request_material_units', ['signed' => true]);
        $request_material_units
            ->addColumn('request_material_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('material_unit_id', 'integer', ['signed' => true, 'null' => false])
            ->addIndex(['request_material_id'])
            ->addForeignKey('request_material_id', 'request_materials', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__request_material_unit__request_material',
            ])
            ->addIndex(['material_unit_id'])
            ->addForeignKey('material_unit_id', 'material_units', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__request_material_unit__material_unit',
            ])
            ->addIndex(['request_material_id', 'material_unit_id'], ['unique' => true])
            ->create();

        $reservations = $this->table('reservations');
        $reservations
            ->addColumn('request_id', 'integer', [
                'signed' => true,
                'null' => true,
                'after' => 'reference',
            ])
            ->addIndex(['request_id'])
            ->addForeignKey('request_id', 'requests', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__reservation__request',
            ])
            ->update();

        //
        // - Transformation des réservations en demandes.
        //

        $reservations = $this->fetchAll(sprintf('SELECT * FROM `%1$sreservations`', $prefix));
        foreach ($reservations as $reservation) {
            $request = [
                'reference' => $reservation['reference'],
                'borrower_id' => $reservation['borrower_id'],
                'status' => $reservation['status'],
                'status_reason' => $reservation['status_reason'],
                'approver_id' => $reservation['approver_id'],
                'operation_start_date' => $reservation['operation_start_date'],
                'operation_end_date' => $reservation['operation_end_date'],
                'operation_is_full_days' => $reservation['operation_is_full_days'],
                'is_billable' => $reservation['is_billable'],
                'global_discount_rate' => $reservation['global_discount_rate'],
                'currency' => $reservation['currency'],
                'comment' => $reservation['borrower_comment'],
                'created_at' => $reservation['created_at'],
                'updated_at' => $reservation['updated_at'],
            ];
            $requests->insert($request)->save();
            $requestId = $this->getAdapter()->getConnection()->lastInsertId();

            if ($reservation['status'] === 'approved') {
                $this->execute(sprintf(
                    'UPDATE `%1$sreservations` SET `request_id` = %2$d WHERE `id` = %3$d',
                    $prefix,
                    $requestId,
                    $reservation['id'],
                ));
            }

            $reservationMaterials = $this->fetchAll(vsprintf(
                'SELECT * FROM `%1$sreservation_materials` WHERE `reservation_id` = %2$d',
                [$prefix, $reservation['id']],
            ));
            foreach ($reservationMaterials as $reservationMaterial) {
                $requestMaterial = [
                    'request_id' => $requestId,
                    'material_id' => $reservationMaterial['material_id'],
                    'name' => $reservationMaterial['name'],
                    'reference' => $reservationMaterial['reference'],
                    'quantity' => $reservationMaterial['quantity'],
                    'unit_price' => $reservationMaterial['unit_price'],
                    'degressive_rate' => $reservationMaterial['degressive_rate'],
                    'discount_rate' => $reservationMaterial['discount_rate'],
                    'taxes' => $reservationMaterial['taxes'],
                    'unit_replacement_price' => $reservationMaterial['unit_replacement_price'],
                    'is_approved' => $reservationMaterial['is_approved'],
                    'approver_id' => $reservationMaterial['approver_id'],
                ];
                $request_materials->insert($requestMaterial)->save();
                $requestMaterialId = $this->getAdapter()->getConnection()->lastInsertId();

                $reservationMaterialUnits = $this->fetchAll(vsprintf(
                    'SELECT * FROM `%1$sreservation_material_units` WHERE `reservation_material_id` = %2$d',
                    [$prefix, $reservationMaterial['id']],
                ));
                foreach ($reservationMaterialUnits as $reservationMaterialUnit) {
                    $requestMaterialUnit = [
                        'request_material_id' => $requestMaterialId,
                        'material_unit_id' => $reservationMaterialUnit['material_unit_id'],
                    ];
                    $request_material_units->insert($requestMaterialUnit)->save();
                }
            }
        }

        //
        // - Renomme les `reservation_period` en `operation_period` dans les paniers.
        //

        $carts = $this->table('carts');
        $carts
            ->renameColumn('reservation_start_date', 'operation_start_date')
            ->renameColumn('reservation_end_date', 'operation_end_date')
            ->update();

        //
        // - Suppression des données obsolètes
        //

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%sreservations', $prefix))
            ->where(['status !=' => 'approved'])
            ->execute();

        $reservations = $this->table('reservations');
        $reservations
            ->dropForeignKey('approver_id')
            ->removeIndex(['approver_id'])
            ->update();

        $reservations
            ->removeColumn('status')
            ->removeColumn('status_reason')
            ->removeColumn('approver_id')
            ->removeColumn('borrower_comment')
            ->update();

        $reservationMaterials = $this->table('reservation_materials');
        $reservationMaterials
            ->dropForeignKey('approver_id')
            ->removeIndex(['approver_id'])
            ->update();

        $reservationMaterials
            ->removeColumn('is_approved')
            ->removeColumn('approver_id')
            ->update();

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%sreservation_history', $prefix))
            ->where(['type' => 'approve'])
            ->execute();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $reservationMaterials = $this->table('reservation_materials');
        $reservationMaterials
            ->addColumn('is_approved', 'boolean', [
                'null' => false,
                'default' => false,
                'after' => 'unit_replacement_price',
            ])
            ->addColumn('approver_id', 'integer', [
                'signed' => true,
                'null' => true,
                'default' => null,
                'after' => 'is_approved',
            ])
            ->addIndex(['approver_id'])
            ->addForeignKey('approver_id', 'users', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__reservation_material__approver',
            ])
            ->update();

        $reservations = $this->table('reservations');
        $reservations
            ->addColumn('status', 'enum', [
                'values' => ['pending', 'approved', 'rejected'],
                'default' => 'pending',
                'null' => false,
                'after' => 'borrower_id',
            ])
            ->addColumn('status_reason', 'text', [
                'null' => true,
                'default' => null,
                'after' => 'status',
            ])
            ->addColumn('borrower_comment', 'text', [
                'null' => true,
                'default' => null,
                'after' => 'currency',
            ])
            ->addColumn('approver_id', 'integer', [
                'signed' => true,
                'null' => true,
                'default' => null,
                'after' => 'status_reason',
            ])
            ->addIndex(['approver_id'])
            ->addForeignKey('approver_id', 'users', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__reservation__approver',
            ])
            ->update();

        // - On marque les réservations existantes comme approuvées.
        $this->execute(sprintf('UPDATE `%1$sreservations` SET `status` = "approved"', $prefix));

        $reservation_materials = $this->table('reservation_materials');
        $reservation_material_units = $this->table('reservation_material_units');

        $requests = $this->fetchAll(sprintf('SELECT * FROM `%1$srequests`', $prefix));
        foreach ($requests as $request) {
            if ($request['status'] === 'approved') {
                $qb = $this->getUpdateBuilder();
                $qb
                    ->update(sprintf('%sreservations', $prefix))
                    ->set('borrower_comment', $request['comment'])
                    ->where(['request_id' => $request['id']])
                    ->execute();
                continue;
            }

            $reservation = [
                'reference' => $request['reference'],
                'borrower_id' => $request['borrower_id'],
                'status' => $request['status'],
                'status_reason' => $request['status_reason'],
                'approver_id' => $request['approver_id'],
                'mobilization_start_date' => $request['operation_start_date'],
                'mobilization_end_date' => $request['operation_end_date'],
                'operation_start_date' => $request['operation_start_date'],
                'operation_end_date' => $request['operation_end_date'],
                'operation_is_full_days' => $request['operation_is_full_days'],
                'is_billable' => $request['is_billable'],
                'global_discount_rate' => $request['global_discount_rate'],
                'currency' => $request['currency'],
                'borrower_comment' => $request['comment'],
            ];
            $reservations->insert($reservation)->save();
            $reservationId = $this->getAdapter()->getConnection()->lastInsertId();

            $requestMaterials = $this->fetchAll(vsprintf(
                'SELECT * FROM `%1$srequest_materials` WHERE `request_id` = %2$d',
                [$prefix, $request['id']],
            ));
            foreach ($requestMaterials as $requestMaterial) {
                $reservationMaterial = [
                    'reservation_id' => $reservationId,
                    'material_id' => $requestMaterial['material_id'],
                    'name' => $requestMaterial['name'],
                    'reference' => $requestMaterial['reference'],
                    'quantity' => $requestMaterial['quantity'],
                    'unit_price' => $requestMaterial['unit_price'],
                    'degressive_rate' => $requestMaterial['degressive_rate'],
                    'discount_rate' => $requestMaterial['discount_rate'],
                    'taxes' => $requestMaterial['taxes'],
                    'unit_replacement_price' => $requestMaterial['unit_replacement_price'],
                    'is_approved' => $requestMaterial['is_approved'],
                    'approver_id' => $requestMaterial['approver_id'],
                ];
                $reservation_materials->insert($reservationMaterial)->save();
                $reservationMaterialId = $this->getAdapter()->getConnection()->lastInsertId();

                $requestMaterialUnits = $this->fetchAll(vsprintf(
                    'SELECT * FROM `%1$srequest_material_units` WHERE `request_material_id` = %2$d',
                    [$prefix, $requestMaterial['id']],
                ));
                foreach ($requestMaterialUnits as $requestMaterialUnit) {
                    $reservationMaterialUnit = [
                        'reservation_material_id' => $reservationMaterialId,
                        'material_unit_id' => $requestMaterialUnit['material_unit_id'],
                    ];
                    $reservation_material_units->insert($reservationMaterialUnit)->save();
                }
            }
        }

        $reservations
            ->dropForeignKey('request_id')
            ->removeIndex(['request_id'])
            ->update();
        $reservations
            ->removeColumn('request_id')
            ->update();

        $this->table('request_material_units')->drop()->save();
        $this->table('request_materials')->drop()->save();
        $this->table('requests')->drop()->save();

        //
        // - Renomme les `operation_period` en `reservation_period` dans les paniers.
        //

        $carts = $this->table('carts');
        $carts
            ->renameColumn('operation_start_date', 'reservation_start_date')
            ->renameColumn('operation_end_date', 'reservation_end_date')
            ->update();
    }
}
