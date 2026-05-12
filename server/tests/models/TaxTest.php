<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Loxya\Models\Tax;
use Loxya\Models\TaxComponent;
use Loxya\Support\Arr;

final class TaxTest extends TestCase
{
    public function testValidation(): void
    {
        $generateTax = static function (array $data = []): Tax {
            $data = Arr::defaults($data, [
                'is_group' => false,
                'value' => '19.600',
            ]);
            return new Tax($data);
        };

        // - Avec des données valides.
        $this->assertTrue($generateTax()->isValid());

        // - Avec des erreurs simples (types incorrects).
        $tax = $generateTax([
            'is_group' => 'ok',
            'value' => '__invalid__',
        ]);
        $expectedErrors = [
            'is_group' => "Ce champ doit être un booléen.",
            'value' => "Ce champ doit contenir un chiffre à virgule.",
        ];
        $this->assertFalse($tax->isValid());
        $this->assertSame($expectedErrors, $tax->validationErrors());

        // - Avec un groupe de taxes (interdit avec un système de T.V.A. simple).
        $tax = $generateTax(['is_group' => true, 'value' => null]);
        $expectedErrors = [
            'is_group' => "Ce champ est invalide.",
        ];
        $this->assertFalse($tax->isValid());
        $this->assertSame($expectedErrors, $tax->validationErrors());

        // - Avec un nom spécifié (doit être `null` pour les systèmes avec T.V.A. simple).
        $tax = $generateTax(['name' => 'T.V.A.']);
        $expectedErrors = [
            'name' => "Ce champ ne devrait pas être spécifié.",
        ];
        $this->assertFalse($tax->isValid());
        $this->assertSame($expectedErrors, $tax->validationErrors());

        // - Avec un taux non autorisé pour la France.
        $tax = $generateTax(['value' => '10.255']);
        $expectedErrors = [
            'value' => "Ce taux ne fait pas partie des taux en vigueur.",
        ];
        $this->assertFalse($tax->isValid());
        $this->assertSame($expectedErrors, $tax->validationErrors());

        // - Avec un taux supérieur à 100%.
        $tax = $generateTax(['value' => '105']);
        $expectedErrors = [
            'value' => "Ce champ est invalide.",
        ];
        $this->assertFalse($tax->isValid());
        $this->assertSame($expectedErrors, $tax->validationErrors());

        // - On utilise un pays avec un système de T.V.A. qui n'est pas "simple".
        static::setCustomConfig(['organization.country' => 'CA']);

        // - Création d'une groupe pour les tests.
        tap(
            Tax::create(['name' => 'Taxe Québec (TPS + TVQ)', 'is_group' => true]),
            static function (Tax $tax) {
                $tax->components()->saveMany([
                    new TaxComponent(['name' => "TPS", 'value' => '5']),
                    new TaxComponent(['name' => "TVQ", 'value' => '9.975']),
                ]);
            },
        );

        $generateTax = static function (array $data = []): Tax {
            $data = Arr::defaults($data, [
                'name' => "Taxe",
                'is_group' => false,
                'value' => '10.255',
            ]);
            return new Tax($data);
        };

        // - Avec des données valides.
        $this->assertTrue($generateTax()->isValid());

        // - Avec des erreurs simples (1).
        $tax = $generateTax([
            'name' => '',
            'is_group' => 'ok',
            'value' => '__invalid__',
        ]);
        $expectedErrors = [
            'name' => "Ce champ est obligatoire.",
            'is_group' => "Ce champ doit être un booléen.",
            'value' => "Ce champ doit contenir un chiffre à virgule.",
        ];
        $this->assertFalse($tax->isValid());
        $this->assertSame($expectedErrors, $tax->validationErrors());

        // - Avec des erreurs simples (2).
        $tax = $generateTax([
            'name' => 'invalideeeeeeeeeeeeeeeeeeeeeeee',
            'is_group' => true,
            'value' => '100', // => Devrait être `null` vu que c'est un groupe.
        ]);
        $expectedErrors = [
            'name' => "1 caractères min., 30 caractères max.",
            'value' => "Ce champ ne devrait pas être spécifié.",
        ];
        $this->assertFalse($tax->isValid());
        $this->assertSame($expectedErrors, $tax->validationErrors());

        // - Avec un nom déjà utilisé (avec un groupe: Vérification simple).
        $tax = $generateTax([
            'name' => "Taxe Québec (TPS + TVQ)",
            'is_group' => true,
            'value' => null,
        ]);
        $expectedErrors = [
            'name' => "Une taxe avec ce nom existe déjà.",
        ];
        $this->assertFalse($tax->isValid());
        $this->assertSame($expectedErrors, $tax->validationErrors());

        // - Avec un nom déjà utilisé (sans groupe, erreur si même valeur).
        Tax::findOrFail(1)->update(['name' => 'T.V.A.']);
        $tax = $generateTax(['name' => "T.V.A.", 'value' => '20']);
        $expectedErrors = [
            'name' => "Une taxe avec ce nom existe déjà.",
        ];
        $this->assertFalse($tax->isValid());
        $this->assertSame($expectedErrors, $tax->validationErrors());

        // - Avec un nom déjà utilisé (sans groupe, pas d'erreur si valeur différente).
        $tax = $generateTax(['name' => "T.V.A.", 'value' => '25']);
        $this->assertTrue($tax->isValid());
    }

    public function testDelete(): void
    {
        // - Ne peut pas être supprimée si c'est la taxe par défaut.
        $this->assertThrow(\LogicException::class, static function () {
            Tax::findOrFail(1)->delete();
        });

        // - Ne peut pas être supprimée si utilisée.
        $this->assertThrow(\LogicException::class, static function () {
            Tax::findOrFail(2)->delete();
        });

        // - Test valide.
        $isDeleted = Tax::findOrFail(3)->delete();
        $this->assertTrue($isDeleted);
        $this->assertFalse(Tax::includes(3));
    }
}
