<?php
declare(strict_types=1);

use Brick\Math\BigDecimal as Decimal;
use Loxya\Config\Config;
use Loxya\Services\I18n;
use Loxya\Support\Arr;
use Phinx\Migration\AbstractMigration;

final class ImplementSimpleVatSystem extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        $taxes = $this->table('taxes');
        $taxes
            ->changeColumn('name', 'string', [
                'null' => true,
                'limit' => 30,
            ])
            ->update();

        //
        // - Traitement des taxes existantes
        //

        $organizationCountry = Config::getOrganizationCountry();
        $allowedRates = $organizationCountry->getVatRates();
        $hasSimpleVatSystem = $organizationCountry->hasSimpleVatSystem();

        $isValidRate = static function (Decimal|string|int|float $value) use ($allowedRates): bool {
            $value = Decimal::of($value);
            if ($value->isLessThan(0) || $value->isGreaterThan(100)) {
                return false;
            }
            return (
                $allowedRates === null ||
                Arr::some($allowedRates, static fn ($allowedRate) => (
                    Decimal::of($allowedRate)->isEqualTo($value)
                ))
            );
        };

        $taxesData = $this->getSelectBuilder()
            ->select(['*'])
            ->from(sprintf('%staxes', $prefix))
            ->execute()
            ->fetchAll('assoc');

        foreach ($taxesData as $taxDatum) {
            $deleteTax = function () use ($prefix, $taxDatum) {
                // - On supprime l'assignation dans les matériels.
                $this->getUpdateBuilder()
                    ->update(sprintf('%smaterials', $prefix))
                    ->set('tax_id', null)
                    ->where(['tax_id' => $taxDatum['id']])
                    ->execute();

                // - On supprime l'assignation en taxe par défaut si c'est le cas.
                $this->getUpdateBuilder()
                    ->update(sprintf('%ssettings', $prefix))
                    ->set('value', null)
                    ->where([
                        'key' => 'billing.defaultTax',
                        'value' => $taxDatum['id'],
                    ])
                    ->execute();

                // - Et on supprime la taxe elle-même.
                $this->getDeleteBuilder()
                    ->delete(sprintf('%staxes', $prefix))
                    ->where(['id' => $taxDatum['id']])
                    ->execute();
            };

            if (!$taxDatum['is_group']) {
                // - On supprime les taxes à prix fixe et les taxes avec taux invalide.
                if (!$taxDatum['is_rate'] || !$isValidRate($taxDatum['value'])) {
                    $deleteTax();
                    continue;
                }

                if ($hasSimpleVatSystem) {
                    $this->getUpdateBuilder()
                        ->update(sprintf('%staxes', $prefix))
                        ->set('name', null)
                        ->where(['id' => $taxDatum['id']])
                        ->execute();
                }
                continue;
            }

            $componentsData = $this->getSelectBuilder()
                ->select(['id', 'is_rate', 'value'])
                ->from(sprintf('%stax_components', $prefix))
                ->where(['tax_id' => $taxDatum['id']])
                ->execute()
                ->fetchAll('assoc');

            if (!$hasSimpleVatSystem) {
                $countComponents = count($componentsData);
                foreach ($componentsData as $component) {
                    if (!$component['is_rate'] || !$isValidRate($component['value'])) {
                        $this->getDeleteBuilder()
                            ->delete(sprintf('%stax_components', $prefix))
                            ->where(['id' => $component['id']])
                            ->execute();

                        $countComponents--;
                    }
                }
                if ($countComponents === 0) {
                    $deleteTax();
                }
                continue;
            }

            // - S'il n'y a qu'une seule taxe dans ce groupe et qu'elle est valide
            //   pour un système simple, on tente de la convertir en taxe simple,
            //   sinon, on supprime.
            $converted = false;
            if (count($componentsData) === 1) {
                $componentData = array_shift($componentsData);
                if ($componentData['is_rate'] && $isValidRate($componentData['value'])) {
                    $similarExistingTaxData = $this->getSelectBuilder()
                        ->select(['id'])
                        ->from(sprintf('%staxes', $prefix))
                        ->where([
                            'is_rate' => 1,
                            'is_group' => 0,
                            'value' => $componentData['value'],
                        ])
                        ->execute()
                        ->fetch('assoc');

                    // - Si une taxe de premier niveau avec un taux similaire existe, on ré-utilise.
                    if ($similarExistingTaxData) {
                        $this->getUpdateBuilder()
                            ->update(sprintf('%smaterials', $prefix))
                            ->set('tax_id', $similarExistingTaxData['id'])
                            ->where(['tax_id' => $taxDatum['id']])
                            ->execute();

                        $this->getUpdateBuilder()
                            ->update(sprintf('%ssettings', $prefix))
                            ->set('value', $similarExistingTaxData['id'])
                            ->where([
                                'key' => 'billing.defaultTax',
                                'value' => $taxDatum['id'],
                            ])
                            ->execute();
                    } else {
                        $this->getUpdateBuilder()
                            ->update(sprintf('%staxes', $prefix))
                            ->set([
                                'name' => null,
                                'is_rate' => 1,
                                'is_group' => 0,
                                'value' => $componentData['value'],
                            ])
                            ->where(['id' => $taxDatum['id']])
                            ->execute();

                        $converted = true;
                    }
                }
            }

            $this->getDeleteBuilder()
                ->delete(sprintf('%stax_components', $prefix))
                ->where(['tax_id' => $taxDatum['id']])
                ->execute();

            if (!$converted) {
                $deleteTax();
            }
        }

        //
        // - On nettoie les lignes des tables d'événements, réservations, etc.
        //

        $lineItemTables = [
            'event_materials',
            'event_extras',
            'reservation_materials',
            'reservation_extras',
            'request_materials',
        ];
        foreach ($lineItemTables as $table) {
            $rows = $this->getSelectBuilder()
                ->select(['id', 'taxes'])
                ->from(sprintf('%s%s', $prefix, $table))
                ->execute()
                ->fetchAll('assoc');

            foreach ($rows as $row) {
                if ($row['taxes'] === null) {
                    continue;
                }

                $taxesData = json_decode($row['taxes'], true);
                if (!is_array($taxesData)) {
                    continue;
                }

                $cleanTaxesData = [];
                foreach ($taxesData as $taxDatum) {
                    // - Si ce n'est pas une taux ou qu'il n'est pas valide, on supprime.
                    if (!$taxDatum['is_rate'] || !$isValidRate($taxDatum['value'])) {
                        continue;
                    }

                    $cleanTaxesData[] = !$hasSimpleVatSystem
                        ? ['name' => $taxDatum['name'], 'value' => $taxDatum['value']]
                        : ['value' => $taxDatum['value']];

                    // - Si on est dans un système de T.V.A. simple, on ne
                    //   garde que la première T.V.A. de la ligne...
                    if ($hasSimpleVatSystem) {
                        break;
                    }
                }

                $cleanTaxesData = !empty($cleanTaxesData) ? json_encode($cleanTaxesData) : null;
                if ($cleanTaxesData !== $row['taxes']) {
                    $this->getUpdateBuilder()
                        ->update(sprintf('%s%s', $prefix, $table))
                        ->set('taxes', $cleanTaxesData)
                        ->where(['id' => $row['id']])
                        ->execute();
                }
            }
        }

        //
        // - Ajout des taxes par défaut pour les pays avec taxe contrôlée.
        //

        $defaultRates = $organizationCountry->getVatRates(extended: false);
        if (!empty($defaultRates)) {
            $defaultRateId = null;
            foreach (array_values($defaultRates) as $index => $defaultRate) {
                $defaultRateRawValue = (string) Decimal::of($defaultRate);

                $existingTaxData = $this->getSelectBuilder()
                    ->select(['id'])
                    ->from(sprintf('%staxes', $prefix))
                    ->where([
                        'is_rate' => 1,
                        'is_group' => 0,
                        'value' => $defaultRateRawValue,
                    ])
                    ->execute()
                    ->fetch('assoc');

                if ($existingTaxData) {
                    // - Si c'est la première taxe (= la taxe par défaut), on récupère son id.
                    if ($index === 0) {
                        $defaultRateId = $existingTaxData['id'];
                    }
                    continue;
                }

                $this->getInsertBuilder()
                    ->insert(['name', 'is_group', 'is_rate', 'value'])
                    ->into(sprintf('%staxes', $prefix))
                    ->values([
                        'name' => null,
                        'is_rate' => 1,
                        'is_group' => 0,
                        'value' => $defaultRateRawValue,
                    ])
                    ->execute();

                // - Si c'est la première taxe (= la taxe par défaut), on récupère son id.
                if ($index === 0) {
                    $defaultRateId = $this->getAdapter()->getConnection()->lastInsertId();
                }
            }

            // - Si on a la taxe par défaut, on l'assigne dans la config.
            if ($defaultRateId !== null) {
                $defaultTaxSettingData = $this->getSelectBuilder()
                    ->select(['value'])
                    ->from(sprintf('%ssettings', $prefix))
                    ->where(['key' => 'billing.defaultTax'])
                    ->execute()
                    ->fetch('assoc');

                if (!$defaultTaxSettingData || $defaultTaxSettingData['value'] === null) {
                    $this->getUpdateBuilder()
                        ->update(sprintf('%ssettings', $prefix))
                        ->set('value', $defaultRateId)
                        ->where(['key' => 'billing.defaultTax'])
                        ->execute();
                }
            }
        }

        //
        // - Mise à jour finale de la structure.
        //

        $taxes = $this->table('taxes');
        $taxes
            ->removeColumn('is_rate')
            ->changeColumn('value', 'decimal', [
                'null' => true,
                'precision' => 6,
                'scale' => 3,
            ])
            ->update();

        $tax_components = $this->table('tax_components');
        $tax_components
            ->removeColumn('is_rate')
            ->changeColumn('value', 'decimal', [
                'null' => false,
                'precision' => 6,
                'scale' => 3,
            ])
            ->update();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');
        $i18n = new I18n(Config::get('defaultLang'));

        $this->getUpdateBuilder()
            ->update(sprintf('%staxes', $prefix))
            ->set('name', $i18n->translate('vat'))
            ->whereNull('name')
            ->execute();

        //
        // - Restauration des taxes par ligne.
        //

        $lineItemTables = [
            'event_materials',
            'event_extras',
            'reservation_materials',
            'reservation_extras',
            'request_materials',
        ];
        foreach ($lineItemTables as $table) {
            $rows = $this->getSelectBuilder()
                ->select(['id', 'taxes'])
                ->from(sprintf('%s%s', $prefix, $table))
                ->execute()
                ->fetchAll('assoc');

            foreach ($rows as $row) {
                if ($row['taxes'] === null) {
                    continue;
                }

                $taxesData = json_decode($row['taxes'], true);
                if (!is_array($taxesData)) {
                    continue;
                }

                $restoredTaxesData = array_map(
                    static fn ($taxDatum) => [
                        'name' => $taxDatum['name'] ?? $i18n->translate('vat'),
                        'is_rate' => true,
                        'value' => $taxDatum['value'],
                    ],
                    $taxesData,
                );

                $restoredTaxesData = !empty($restoredTaxesData) ? json_encode($restoredTaxesData) : null;
                if ($restoredTaxesData !== $row['taxes']) {
                    $this->getUpdateBuilder()
                        ->update(sprintf('%s%s', $prefix, $table))
                        ->set('taxes', $restoredTaxesData)
                        ->where(['id' => $row['id']])
                        ->execute();
                }
            }
        }

        //
        // - Restauration de la structure.
        //

        $taxes = $this->table('taxes');
        $taxes
            ->changeColumn('name', 'string', [
                'null' => false,
                'limit' => 30,
            ])
            ->changeColumn('value', 'decimal', [
                'null' => true,
                'precision' => 15,
                'scale' => 3,
            ])
            ->addColumn('is_rate', 'boolean', [
                'null' => false,
                'default' => true,
                'after' => 'is_group',
            ])
            ->update();
        $taxes
            ->changeColumn('is_rate', 'boolean', ['null' => false])
            ->update();

        $tax_components = $this->table('tax_components');
        $tax_components
            ->changeColumn('value', 'decimal', [
                'null' => false,
                'precision' => 15,
                'scale' => 3,
            ])
            ->addColumn('is_rate', 'boolean', [
                'null' => false,
                'default' => true,
                'after' => 'name',
            ])
            ->update();
        $tax_components
            ->changeColumn('is_rate', 'boolean', ['null' => false])
            ->update();
    }
}
