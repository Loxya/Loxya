<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Loxya\Support\Country;
use Phinx\Migration\AbstractMigration;
use Psr\Log\LogLevel;

final class ImproveLocalData extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        $qb = $this->getSelectBuilder();
        $countriesMap = array_column(
            $qb
                ->select(['id', 'code'])
                ->from(sprintf('%scountries', $prefix))
                ->execute()->fetchAll('assoc'),
            'code',
            'id',
        );

        $defaultCountryId = array_flip($countriesMap)[(
            Config::get('mainCountry')
                ?? Config::get('organization.country')
                ?? 'FR'
        )];

        /** @var array<string, Country> $countriesData */
        $countriesData = [];

        //
        // - Sociétés
        //

        $qb = $this->getUpdateBuilder();
        $qb
            ->update(sprintf('%scompanies', $prefix))
            ->set('country_id', $defaultCountryId)
            ->whereNull('country_id')
            ->execute();

        // - Normalise les numéros de téléphone, codes postaux et numéros légaux.
        $companiesData = $this->fetchAll(sprintf(
            'SELECT `id`, `phone`, `registration_id`, `country_id` FROM `%scompanies`',
            $prefix,
        ));
        foreach ($companiesData as $companyData) {
            $normalizedCompanyData = [];

            $companyCountryCode = $countriesMap[$companyData['country_id']];
            $countriesData[$companyCountryCode] ??= new Country($companyCountryCode);
            $companyCountryData = $countriesData[$companyCountryCode];

            // - Téléphone
            $normalizedPhone = preg_replace('/[\s.-]/', '', trim($companyData['phone'] ?? ''));
            if ($normalizedPhone !== '') {
                try {
                    $normalizedPhone = $companyCountryData->normalizePhoneNumber($normalizedPhone);
                } catch (\Throwable) {
                    // - On ignore et on conserve le numéro invalide, ce sera validé lors de la prochaine édition.
                }
            } else {
                $normalizedPhone = null;
            }
            if ($normalizedPhone !== $companyData['phone']) {
                $normalizedCompanyData['phone'] = $normalizedPhone;
            }

            // - Numéro d'enregistrement
            $normalizedRegistrationId = trim($companyData['registration_id'] ?? '');
            if ($normalizedRegistrationId !== '') {
                if ($companyCountryData->isValidCompanyIdentifier($normalizedRegistrationId)) {
                    $normalizedRegistrationId = $companyCountryData
                        ->normalizeCompanyIdentifier($normalizedRegistrationId);
                } else {
                    container('logger')->log(LogLevel::WARNING, vsprintf(
                        "Invalid company identifier for `%s` country in `companies` table: `%s`",
                        [$companyCountryCode, $normalizedRegistrationId],
                    ));
                }
            } else {
                $normalizedRegistrationId = null;
            }
            if ($normalizedRegistrationId !== $companyData['registration_id']) {
                $normalizedCompanyData['registration_id'] = $normalizedRegistrationId;
            }

            if (!empty($normalizedCompanyData)) {
                $qb = $this->getUpdateBuilder();
                $qb
                    ->update(sprintf('%scompanies', $prefix))
                    ->set($normalizedCompanyData)
                    ->where(['id' => $companyData['id']])
                    ->execute();
            }
        }

        $companies = $this->table('companies');
        $companies
            ->dropForeignKey('country_id')
            ->update();

        $companies
            ->addColumn('vat_number', 'string', [
                'length' => 50,
                'null' => true,
                'after' => 'registration_id',
            ])
            ->addColumn('additional_street', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'street',
            ])
            ->addColumn('administrative_area', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'postal_code',
            ])
            ->changeColumn('country_id', 'integer', [
                'signed' => true,
                'null' => false,
            ])
            ->addForeignKey('country_id', 'countries', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__companies__country',
            ])
            ->update();

        //
        // - Parcs
        //

        $qb = $this->getUpdateBuilder();
        $qb
            ->update(sprintf('%sparks', $prefix))
            ->set('country_id', $defaultCountryId)
            ->whereNull('country_id')
            ->execute();

        $parks = $this->table('parks');
        $parks
            ->dropForeignKey('country_id')
            ->update();

        $parks
            ->addColumn('additional_street', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'street',
            ])
            ->addColumn('administrative_area', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'postal_code',
            ])
            ->changeColumn('country_id', 'integer', [
                'signed' => true,
                'null' => false,
            ])
            ->addForeignKey('country_id', 'countries', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__parks__country',
            ])
            ->update();

        //
        // - Utilisateurs en cours d'inscription
        //

        // - Normalise les numéros d'enregistrement des sociétés en cours d'inscription.
        $pendingUsersData = $this->fetchAll(sprintf(
            'SELECT `id`, `type`, `company_registration_id`, `country_id` FROM `%spending_users`',
            $prefix,
        ));
        foreach ($pendingUsersData as $pendingUserData) {
            $normalizedPendingUserData = [];

            $normalizedRegistrationId = null;
            if ($pendingUserData['type'] === 'company') {
                $pendingUserCountryId = $pendingUserData['country_id'] ?: $defaultCountryId;
                $pendingUserCountryCode = $countriesMap[$pendingUserCountryId];
                $countriesData[$pendingUserCountryCode] ??= new Country($pendingUserCountryCode);
                $pendingUserCountryData = $countriesData[$pendingUserCountryCode];

                // - Numéro d'enregistrement
                $normalizedRegistrationId = trim($pendingUserData['company_registration_id'] ?? '');
                if ($normalizedRegistrationId !== '') {
                    // phpcs:ignore Generic.Files.LineLength
                    $normalizedRegistrationId = $pendingUserCountryData->isValidCompanyIdentifier($normalizedRegistrationId)
                        ? $pendingUserCountryData->normalizeCompanyIdentifier($normalizedRegistrationId)
                        : null;
                } else {
                    $normalizedRegistrationId = null;
                }

                // - Pays
                if ($pendingUserData['country_id'] !== $pendingUserCountryId) {
                    $normalizedPendingUserData['country_id'] = $pendingUserCountryId;
                }
            }
            if ($normalizedRegistrationId !== $pendingUserData['company_registration_id']) {
                $normalizedPendingUserData['company_registration_id'] = $normalizedRegistrationId;
            }

            if (!empty($normalizedCompanyData)) {
                $qb = $this->getUpdateBuilder();
                $qb
                    ->update(sprintf('%spending_users', $prefix))
                    ->set($normalizedCompanyData)
                    ->where(['id' => $pendingUserData['id']])
                    ->execute();
            }
        }

        $pending_users = $this->table('pending_users');
        $pending_users
            ->addColumn('company_vat_number', 'string', [
                'length' => 50,
                'null' => true,
                'after' => 'company_registration_id',
            ])
            ->addColumn('additional_street', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'street',
            ])
            ->addColumn('administrative_area', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'postal_code',
            ])
            ->addForeignKey('country_id', 'countries', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__pending_users__country',
            ])
            ->update();

        //
        // - Personnes
        //

        $qb = $this->getUpdateBuilder();
        $qb
            ->update(sprintf('%spersons', $prefix))
            ->set('country_id', $defaultCountryId)
            ->whereNull('country_id')
            ->execute();

        // - Normalise les numéros de téléphone.
        $personsPhones = $this->fetchAll(sprintf(
            'SELECT `id`, `phone`, `country_id` FROM `%spersons` WHERE `phone` IS NOT NULL',
            $prefix,
        ));
        foreach ($personsPhones as $personData) {
            $normalizedPhone = preg_replace('/[\s.-]/', '', $personData['phone']);
            if ($normalizedPhone !== '') {
                $personCountryCode = $countriesMap[$personData['country_id']];
                $countriesData[$personCountryCode] ??= new Country($personCountryCode);
                $personCountryData = $countriesData[$personCountryCode];

                try {
                    $normalizedPhone = $personCountryData->normalizePhoneNumber($normalizedPhone);
                } catch (\Throwable) {
                    // - On ignore et on conserve le numéro invalide, ce sera validé lors de la prochaine édition.
                }
            } else {
                $normalizedPhone = null;
            }

            if ($normalizedPhone !== $personData['phone']) {
                $qb = $this->getUpdateBuilder();
                $qb
                    ->update(sprintf('%spersons', $prefix))
                    ->set('phone', $normalizedPhone)
                    ->where(['id' => $personData['id']])
                    ->execute();
            }
        }

        $persons = $this->table('persons');
        $persons
            ->dropForeignKey('country_id')
            ->update();

        $persons
            ->addColumn('additional_street', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'street',
            ])
            ->addColumn('administrative_area', 'string', [
                'length' => 191,
                'null' => true,
                'after' => 'postal_code',
            ])
            ->changeColumn('country_id', 'integer', [
                'signed' => true,
                'null' => false,
            ])
            ->addForeignKey('country_id', 'countries', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__persons__country',
            ])
            ->update();
    }

    public function down(): void
    {
        $companies = $this->table('companies');
        $companies
            ->removeColumn('vat_number')
            ->removeColumn('additional_street')
            ->removeColumn('administrative_area')
            ->changeColumn('country_id', 'integer', [
                'signed' => true,
                'null' => true,
            ])
            ->update();

        //
        // - Parcs
        //

        $parks = $this->table('parks');
        $parks
            ->removeColumn('additional_street')
            ->removeColumn('administrative_area')
            ->changeColumn('country_id', 'integer', [
                'signed' => true,
                'null' => true,
            ])
            ->update();

        //
        // - Utilisateurs en cours d'inscription
        //

        $pending_users = $this->table('pending_users');
        $pending_users
            ->removeColumn('company_vat_number')
            ->removeColumn('additional_street')
            ->removeColumn('administrative_area')
            ->dropForeignKey('country_id')
            ->update();

        //
        // - Personnes
        //

        $persons = $this->table('persons');
        $persons
            ->removeColumn('additional_street')
            ->removeColumn('administrative_area')
            ->changeColumn('country_id', 'integer', [
                'signed' => true,
                'null' => true,
            ])
            ->update();
    }
}
