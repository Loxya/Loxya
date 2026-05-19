<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Loxya\Models\Tax;
use Loxya\Models\TaxComponent;
use Loxya\Support\Arr;

final class TaxComponentTest extends TestCase
{
    public function testValidation(): void
    {
        // - On utilise un pays avec un système de T.V.A. qui n'est pas "simple".
        static::setCustomConfig(['organization.country' => 'CA']);

        // - Création d'un groupe pour les tests.
        $group = tap(
            Tax::create(['name' => 'Taxe groupe A', 'is_group' => true]),
            static function (Tax $tax) {
                $component = new TaxComponent(['name' => "Éco-participation", 'value' => '2.00']);
                $component->tax()->associate($tax);
                $component->save();
            },
        );

        $generateTaxComponent = static fn (array $data = []) => (
            tap(new TaxComponent(), static function (TaxComponent $component) use ($data, $group) {
                $component->tax_id = $data['tax_id'] ?? $group->id;
                $component->fill(Arr::defaults($data, [
                    'name' => "Taxe écologique",
                    'value' => '1.00',
                ]));
            })
        );

        // - Avec des données valides.
        $this->assertTrue($generateTaxComponent()->isValid());

        // - Avec des erreurs simples.
        $taxComponent = $generateTaxComponent([
            'name' => 'invalideeeeeeeeeeeeeeeeeeeeeeee',
            'value' => '__invalid__',
        ]);
        $expectedErrors = [
            'name' => "1 caractères min., 30 caractères max.",
            'value' => "Ce champ doit contenir un chiffre à virgule.",
        ];
        $this->assertFalse($taxComponent->isValid());
        $this->assertSame($expectedErrors, $taxComponent->validationErrors());

        // - Avec un nom déjà utilisé dans le même groupe de taxes.
        $taxComponent = $generateTaxComponent(['name' => "Éco-participation"]);
        $expectedErrors = [
            'name' => "Cette composante de taxe existe déjà dans la même taxe.",
        ];
        $this->assertFalse($taxComponent->isValid());
        $this->assertSame($expectedErrors, $taxComponent->validationErrors());

        // - Avec un nom déjà utilisé dans un autre groupe de taxes : Pas d'erreur.
        $otherGroup = Tax::create(['name' => 'Taxe groupe B', 'is_group' => true]);
        $taxComponent = $generateTaxComponent([
            'tax_id' => $otherGroup->id,
            'name' => "Éco-participation",
        ]);
        $this->assertTrue($taxComponent->isValid());

        // - Avec un identifiant de taxe qui n'est pas un groupe.
        $taxComponent = $generateTaxComponent(['tax_id' => 1]);
        $expectedErrors = [
            'tax_id' => "Ce champ est invalide.",
        ];
        $this->assertFalse($taxComponent->isValid());
        $this->assertSame($expectedErrors, $taxComponent->validationErrors());

        // - Avec un taux supérieur à 100%.
        $taxComponent = $generateTaxComponent(['value' => '105']);
        $expectedErrors = [
            'value' => "Ce champ est invalide.",
        ];
        $this->assertFalse($taxComponent->isValid());
        $this->assertSame($expectedErrors, $taxComponent->validationErrors());
    }
}
