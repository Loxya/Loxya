<?php
declare(strict_types=1);

use Brick\Math\BigDecimal as Decimal;
use Brick\Math\RoundingMode;
use Loxya\Config\Config;
use Loxya\Config\Enums\BillingMode;
use Loxya\Services\I18n;
use Phinx\Migration\AbstractMigration;

final class AddTaxesAndCoefficients extends AbstractMigration
{
    /** Limite du nombre de jours parcourus pour la génération des degressive rates. */
    private const DEGRESSIVE_RATE_MAX_COMPUTED_DAYS = 365;

    /** Limite du nombre de slots pour la génération des degressive rates. */
    private const DEGRESSIVE_RATE_MAX_COMPUTED_SLOTS = 60;

    public function up(): void
    {
        $prefix = Config::get('db.prefix');
        $i18n = new I18n(Config::get('defaultLang'));
        $isBillingEnabled = Config::get('billingMode') !== BillingMode::NONE;

        //
        // - Taxes
        //

        $taxes = $this->table('taxes', ['signed' => true]);
        $taxes
            ->addColumn('name', 'string', ['length' => 30, 'null' => false])
            ->addColumn('is_group', 'boolean', ['null' => false])
            ->addColumn('is_rate', 'boolean', ['null' => true])
            ->addColumn('value', 'decimal', [
                'null' => true,
                'precision' => 15,
                'scale' => 3,
            ])
            ->create();

        $tax_components = $this->table('tax_components', ['signed' => true]);
        $tax_components
            ->addColumn('tax_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('name', 'string', ['length' => 30, 'null' => false])
            ->addColumn('is_rate', 'boolean', ['null' => false])
            ->addColumn('value', 'decimal', [
                'null' => false,
                'precision' => 15,
                'scale' => 3,
            ])
            ->addIndex(['tax_id', 'name'], ['unique' => true])
            ->addIndex(['tax_id'])
            ->addForeignKey('tax_id', 'taxes', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__tax_component__tax',
            ])
            ->create();

        $defaultTaxId = null;
        $defaultTaxData = null;
        $existingVatRate = Config::get('legacy.companyData.vatRate');
        if ($existingVatRate !== null && $existingVatRate > 0) {
            $defaultTaxId = 1;
            $defaultTaxData = [
                'name' => $i18n->translate('vat'),
                'is_rate' => true,
                'value' => $existingVatRate,
            ];

            $taxes
                ->insert(array_merge(
                    ['id' => $defaultTaxId, 'is_group' => false],
                    $defaultTaxData,
                ))
                ->save();
        }
        $this->table('settings')
            ->insert(['key' => 'billing.defaultTax', 'value' => $defaultTaxId])
            ->save();

        //
        // - Taux dégressifs
        //

        $degressive_rates = $this->table('degressive_rates', ['signed' => true]);
        $degressive_rates
            ->addColumn('name', 'string', ['length' => 30, 'null' => false])
            ->addIndex(['name'], ['unique' => true])
            ->create();

        $degressive_rate_tiers = $this->table('degressive_rate_tiers', ['signed' => true]);
        $degressive_rate_tiers
            ->addColumn('degressive_rate_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('from_day', 'smallinteger', ['length' => 5, 'null' => false])
            ->addColumn('is_rate', 'boolean', ['null' => false])
            ->addColumn('value', 'decimal', [
                'null' => false,
                'precision' => 7,
                'scale' => 2,
            ])
            ->addIndex(['degressive_rate_id', 'from_day'], ['unique' => true])
            ->addIndex(['degressive_rate_id'])
            ->addForeignKey('degressive_rate_id', 'degressive_rates', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__degressive_rate_item__degressive_rate',
            ])
            ->create();

        $defaultDegressiveRateId = null;
        $existingDegressiveRateTiers = [];
        $existingDegressiveRateFunction = Config::get('legacy.degressiveRateFunction');
        if (
            !in_array($existingDegressiveRateFunction, [null, 'daysCount'], true) &&
            str_contains($existingDegressiveRateFunction, 'daysCount')
        ) {
            $prevValue = null;
            for ($day = 1; $day <= self::DEGRESSIVE_RATE_MAX_COMPUTED_DAYS; $day += 1) {
                $fixedValue = null;
                $function = preg_replace('/daysCount/', (string) $day, $existingDegressiveRateFunction);
                eval(sprintf('$fixedValue = %s;', $function)); // phpcs:ignore Squiz.PHP.Eval
                if ($fixedValue === null || !is_numeric($fixedValue)) {
                    break;
                }

                $fixedValue = Decimal::of($fixedValue)
                    ->toScale(2, RoundingMode::UNNECESSARY);

                try {
                    $rateValue = $fixedValue
                        ->multipliedBy(100)
                        ->dividedBy($day, 2, RoundingMode::UNNECESSARY);
                } catch (\Brick\Math\Exception\MathException) {
                    $rateValue = null;
                }

                $currentValue = [
                    'from_day' => $day,
                    'fixed' => (string) $fixedValue,
                    'rate' => $rateValue !== null
                        ? (string) $rateValue
                        : null,
                ];

                if ($prevValue !== null) {
                    // - Si la valeur relative de l'itération précédente est égale à la valeur
                    //   relative de la présente itération, on considère qu'on est dans un groupe
                    //   utilisant une valeur relative.
                    if (
                        $prevValue['rate'] !== null &&
                        $currentValue['rate'] !== null &&
                        $prevValue['rate'] === $currentValue['rate']
                    ) {
                        $prevValue['fixed'] = null;
                        continue;
                    }

                    // - Si la valeur fixe de l'itération précédente est égale à la valeur
                    //   fixe de la présente itération, on considère qu'on est dans un groupe
                    //   utilisant une valeur fixe.
                    if (
                        $prevValue['fixed'] !== null &&
                        $prevValue['fixed'] === $currentValue['fixed']
                    ) {
                        $prevValue['rate'] = null;
                        continue;
                    }

                    // - Sinon, l'itération précédente est distinct de la présente itération.
                    //   => On crée un nouveau groupe.
                    $existingDegressiveRateTiers[] = [
                        'from_day' => $prevValue['from_day'],
                        'is_rate' => $prevValue['fixed'] === null,
                        'value' => $prevValue['fixed'] ?? $prevValue['rate'],
                    ];
                }

                $prevValue = $currentValue;

                // - Si on a le nombre de slots voulu (-1 car on va rajouter le dernier après la boucle)...
                //   => On sort de la boucle.
                if (count($existingDegressiveRateTiers) === (self::DEGRESSIVE_RATE_MAX_COMPUTED_SLOTS - 1)) {
                    break;
                }
            }

            if ($prevValue !== null) {
                $existingDegressiveRateTiers[] = [
                    'from_day' => $prevValue['from_day'],
                    'is_rate' => $prevValue['fixed'] === null,
                    'value' => $prevValue['fixed'] ?? $prevValue['rate'],
                ];

                // - Si on a été jusqu'à une des limites (nombre de slots ou jours parcourus) et qu'on a
                //   terminé sur un nombre fixe, on calcule un pourcentage pour les jours au delà.
                $isNotFinite = (
                    $prevValue['from_day'] === self::DEGRESSIVE_RATE_MAX_COMPUTED_DAYS ||
                    count($existingDegressiveRateTiers) === self::DEGRESSIVE_RATE_MAX_COMPUTED_SLOTS
                );
                if ($isNotFinite && $prevValue['fixed'] !== null) {
                    $existingDegressiveRateTiers[] = [
                        'from_day' => $prevValue['from_day'] + 1,
                        'is_rate' => true,
                        'value' => (string) Decimal::of($prevValue['fixed'])
                            ->multipliedBy(100)
                            ->dividedBy($day, 2, RoundingMode::UP),
                    ];
                }
            }
        }
        // @phpstan-ignore empty.variable
        if (!empty($existingDegressiveRateTiers)) {
            $defaultDegressiveRateId = 1;

            $degressive_rates
                ->insert([
                    'id' => $defaultDegressiveRateId,
                    'name' => $i18n->translate('base'),
                ])
                ->save();

            $degressive_rate_tiers
                ->insert(array_map(
                    static fn ($existingDegressiveRateTier) => array_merge(
                        ['degressive_rate_id' => $defaultDegressiveRateId],
                        $existingDegressiveRateTier,
                    ),
                    $existingDegressiveRateTiers,
                ))
                ->save();
        }
        $this->table('settings')
            ->insert([
                'key' => 'billing.defaultDegressiveRate',
                'value' => $defaultDegressiveRateId,
            ])
            ->save();

        //
        // - Matériel
        //

        $materials = $this->table('materials');
        $materials
            ->addColumn('degressive_rate_id', 'integer', [
                'signed' => true,
                'null' => true,
                'default' => null,
                'after' => 'rental_price',
            ])
            ->addColumn('tax_id', 'integer', [
                'signed' => true,
                'null' => true,
                'default' => null,
                'after' => 'degressive_rate_id',
            ])
            ->addIndex(['degressive_rate_id'])
            ->addIndex(['tax_id'])
            ->addForeignKey('degressive_rate_id', 'degressive_rates', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__material__degressive_rate',
            ])
            ->addForeignKey('tax_id', 'taxes', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__material__tax',
            ])
            ->update();

        if ($isBillingEnabled) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%smaterials', $prefix))
                ->set('degressive_rate_id', $defaultDegressiveRateId)
                ->set('tax_id', $defaultTaxId)
                ->execute();
        }
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        //
        // - Matériel
        //

        $materials = $this->table('materials');
        $materials
            ->dropForeignKey('degressive_rate_id')
            ->dropForeignKey('tax_id')
            ->removeIndex(['degressive_rate_id'])
            ->removeIndex(['tax_id'])
            ->update();
        $materials
            ->removeColumn('degressive_rate_id')
            ->removeColumn('tax_id')
            ->update();

        //
        // - Taxes
        //

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%ssettings', $prefix))
            ->where(['key' => 'billing.defaultTax'])
            ->execute();

        $this->table('tax_components')->drop()->save();
        $this->table('taxes')->drop()->save();

        //
        // - Taux dégressifs
        //

        $qb = $this->getDeleteBuilder();
        $qb
            ->delete(sprintf('%ssettings', $prefix))
            ->where(['key' => 'billing.defaultDegressiveRate'])
            ->execute();

        $this->table('degressive_rate_tiers')->drop()->save();
        $this->table('degressive_rates')->drop()->save();
    }
}
