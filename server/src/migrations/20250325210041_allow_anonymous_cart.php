<?php
declare(strict_types=1);

use Phinx\Migration\AbstractMigration;

final class AllowAnonymousCart extends AbstractMigration
{
    public function up(): void
    {
        $carts = $this->table('carts');
        $carts
            ->changeColumn('borrower_id', 'integer', ['signed' => true, 'null' => true])
            ->addColumn('guest_token', 'string', [
                'length' => 36, // - UUID.
                'null' => true,
                'after' => 'borrower_id',
            ])
            ->addIndex('guest_token', ['unique' => true])
            ->update();
    }

    public function down(): void
    {
        $this->execute("DELETE FROM `carts` WHERE `borrower_id` IS NULL");

        $carts = $this->table('carts');
        $carts
            ->changeColumn('borrower_id', 'integer', ['signed' => true, 'null' => false])
            ->removeColumn('guest_token')
            ->update();
    }
}
