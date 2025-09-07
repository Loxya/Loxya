<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class CreateCarts extends AbstractMigration
{
    public function up(): void
    {
        //
        // - Nouvelles configurations
        //

        $data = [
            [
                'key' => 'reservation.enabled',
                'value' => '0',
            ],
            [
                'key' => 'reservation.minDelay',
                'value' => '24',
            ],
            [
                'key' => 'reservation.timeout',
                'value' => '15',
            ],
        ];
        $this->table('settings')->insert($data)->save();

        //
        // - Bénéficiaires
        //

        $beneficiaries = $this->table('beneficiaries');
        $beneficiaries
            ->addColumn('can_make_reservation', 'boolean', [
                'default' => false,
                'null' => false,
                'after' => 'company_id',
            ])
            ->update();

        //
        // - Matériels
        //

        $materials = $this->table('materials');
        $materials
            ->addColumn('is_reservable', 'boolean', [
                'default' => true,
                'null' => false,
                'after' => 'is_discountable',
            ])
            ->update();

        //
        // - "Panier"
        //

        $carts = $this->table('carts', ['signed' => true]);
        $carts
            ->addColumn('borrower_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('reservation_start_date', 'date', ['null' => false])
            ->addColumn('reservation_end_date', 'date', ['null' => false])
            ->addColumn('created_at', 'datetime', ['null' => false])
            ->addColumn('updated_at', 'datetime', ['null' => true])
            ->addIndex(['borrower_id'], ['unique' => true])
            ->addForeignKey('borrower_id', 'beneficiaries', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__cart__borrower',
            ])
            ->create();

        $cart_events = $this->table('cart_events', ['signed' => true]);
        $cart_events
            ->addColumn('cart_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('type', 'enum', [
                'values' => [
                    'material-deleted',
                    'material-quantity-updated',
                    'material-price-changed',
                ],
                'null' => false,
            ])
            ->addColumn('metadata', 'json', ['null' => true])
            ->addColumn('created_at', 'datetime', ['null' => false])
            ->addColumn('consumed_at', 'datetime', ['null' => true])
            ->addIndex(['cart_id'])
            ->addForeignKey('cart_id', 'carts', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__cart_event__cart',
            ])
            ->create();

        $cart_materials = $this->table('cart_materials', ['signed' => true]);
        $cart_materials
            ->addColumn('cart_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('material_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('quantity', 'smallinteger', [
                'signed' => false,
                'length' => 5,
                'null' => false,
            ])
            ->addIndex(['cart_id'])
            ->addForeignKey('cart_id', 'carts', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__cart_material__cart',
            ])
            ->addIndex(['material_id'])
            ->addForeignKey('material_id', 'materials', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__cart_material__material',
            ])
            ->addIndex(['cart_id', 'material_id'], ['unique' => true])
            ->create();

        $cart_material_units = $this->table('cart_material_units', [
            'id' => false,
            'primary_key' => ['cart_material_id', 'material_unit_id'],
        ]);
        $cart_material_units
            ->addColumn('cart_material_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('material_unit_id', 'integer', ['signed' => true, 'null' => false])
            ->addIndex(['cart_material_id'])
            ->addForeignKey('cart_material_id', 'cart_materials', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__cart_material_unit__cart_material',
            ])
            ->addIndex(['material_unit_id'])
            ->addForeignKey('material_unit_id', 'material_units', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__cart_material_unit__material_unit',
            ])
            ->addIndex(['cart_material_id', 'material_unit_id'], ['unique' => true])
            ->create();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%ssettings', $prefix))
            ->where(static fn ($exp) => (
                $exp->in('key', [
                    'reservation.enabled',
                    'reservation.minDelay',
                    'reservation.timeout',
                ])
            ))
            ->execute();

        $this->table('beneficiaries')
            ->removeColumn('can_make_reservation')
            ->update();

        $this->table('materials')
            ->removeColumn('is_reservable')
            ->update();

        $this->table('cart_material_units')->drop()->save();
        $this->table('cart_materials')->drop()->save();
        $this->table('cart_events')->drop()->save();
        $this->table('carts')->drop()->save();
    }
}
