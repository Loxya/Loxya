<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Loxya\Models\Event;
use Loxya\Models\Material;
use Loxya\Support\Collections\MaterialsCollection;

final class MaterialsCollectionTest extends TestCase
{
    public function testByCategoriesMaterials(): void
    {
        $collection = new MaterialsCollection(Material::all());
        $result = $collection->byCategories();

        $expected = [
            'Décors' => ['Décor Thème Forêt'],
            'Lumière' => ['PAR64 LED', 'Showtec SDS-6'],
            'Son' => [
                'Console Yamaha CL3',
                'Processeur DBX PA2',
                'Behringer X Air XR18',
            ],
            'Transport' => ['Volkswagen Transporter'],
            '__other' => ['Câble XLR 10m'],
        ];
        $this->assertSame(array_keys($expected), $result->keys()->all());

        foreach ($expected as $key => $expectedNames) {
            $names = $result->get($key)->pluck('name')->all();
            $this->assertSame($expectedNames, $names);
        }
    }

    public function testByCategoriesEventMaterials(): void
    {
        $materials = Event::findOrFail(1)->materials;

        $collection = new MaterialsCollection($materials);
        $result = $collection->byCategories();

        $expected = [
            'Lumière' => ['Showtec SDS-6'],
            'Son' => ['Console Yamaha CL3', 'DBX PA2'],
        ];
        $this->assertSame(array_keys($expected), $result->keys()->all());

        foreach ($expected as $key => $expectedNames) {
            $names = $result->get($key)->pluck('name')->all();
            $this->assertSame($expectedNames, $names);
        }
    }

    public function testBySubCategoriesMaterials(): void
    {
        $collection = new MaterialsCollection(Material::all());
        $result = $collection->bySubCategories();

        $expected = [
            '--' => ['Câble XLR 10m'],
            'Décors - __other' => ['Décor Thème Forêt'],
            'Lumière - Gradateurs' => ['Showtec SDS-6'],
            'Lumière - Projecteurs' => ['PAR64 LED'],
            'Son - Mixeurs' => ['Console Yamaha CL3', 'Behringer X Air XR18'],
            'Son - Processeurs' => ['Processeur DBX PA2'],
            'Transport - __other' => ['Volkswagen Transporter'],
        ];
        $this->assertSame(array_keys($expected), $result->keys()->all());

        foreach ($expected as $key => $expectedNames) {
            $names = $result->get($key)->pluck('name')->all();
            $this->assertSame($expectedNames, $names);
        }
    }

    public function testBySubCategoriesEventMaterials(): void
    {
        $materials = Event::findOrFail(1)->materials;

        $collection = new MaterialsCollection($materials);
        $result = $collection->bySubCategories();

        $expected = [
            'Lumière - Gradateurs' => ['Showtec SDS-6'],
            'Son - Mixeurs' => ['Console Yamaha CL3'],
            'Son - Processeurs' => ['DBX PA2'],
        ];
        $this->assertSame(array_keys($expected), $result->keys()->all());

        foreach ($expected as $key => $expectedNames) {
            $names = $result->get($key)->pluck('name')->all();
            $this->assertSame($expectedNames, $names);
        }
    }

    public function testByParksMaterials(): void
    {
        $collection = new MaterialsCollection(Material::all());
        $result = $collection->byParks();

        $expected = [
            "Défaut" => [
                'Console Yamaha CL3',
                'Processeur DBX PA2',
                'PAR64 LED',
                'Showtec SDS-6',
                'Câble XLR 10m',
                'Behringer X Air XR18',
                'Décor Thème Forêt',
            ],
            "Spare" => [
                'Volkswagen Transporter',
            ],
        ];
        $this->assertSame(array_keys($expected), $result->keys()->all());

        foreach ($expected as $parkName => $expectedNames) {
            $names = $result->get($parkName)->pluck('name')->all();
            $this->assertSame($expectedNames, $names);
        }
    }

    public function testByParksEventMaterials(): void
    {
        $materials = Event::findOrFail(1)->materials;

        $collection = new MaterialsCollection($materials);
        $result = $collection->byParks();

        $expected = [
            "Défaut" => [
                'Console Yamaha CL3',
                'DBX PA2',
                'Showtec SDS-6',
            ],
        ];
        $this->assertSame(array_keys($expected), $result->keys()->all());

        foreach ($expected as $key => $expectedNames) {
            $names = $result->get($key)->pluck('name')->all();
            $this->assertSame($expectedNames, $names);
        }
    }
}
