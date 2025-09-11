<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class AddBookingListTypeToBeneficiaryEmails extends AbstractMigration
{
    public function up(): void
    {
        $table = $this->table('beneficiary_emails');
        $table
            ->changeColumn('type', 'enum', [
                'values' => ['reminder', 'reservation-approved', 'reservation-rejected', 'materials-list'],
                'null' => false,
            ])
            ->save();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%sbeneficiary_emails', $prefix))
            ->where(['type' => 'materials-list'])
            ->execute();

        $table = $this->table('beneficiary_emails');
        $table
            ->changeColumn('type', 'enum', [
                'values' => ['reminder', 'reservation-approved', 'reservation-rejected'],
                'null' => false,
            ])
            ->save();
    }
}
