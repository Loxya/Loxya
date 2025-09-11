<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class CreateRequestsCustomFields extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');

        //
        // - Champs personnalisés.
        //

        $custom_fields = $this->table('custom_fields', ['signed' => true]);
        $custom_fields
            ->addColumn('name', 'string', ['length' => 64, 'null' => false])
            ->addColumn('entity', 'enum', [
                'values' => ['request'],
                'null' => false,
            ])
            ->addColumn('type', 'enum', [
                'values' => [
                    'string',
                    'text',
                    'integer',
                    'float',
                    'boolean',
                    'period',
                    'list',
                    'date',
                ],
                'null' => false,
            ])
            ->addColumn('order', 'integer', ['signed' => false, 'null' => true])
            ->addColumn('is_mandatory', 'boolean', ['null' => false])
            ->addColumn('config', 'json', ['null' => true])
            ->addTimestamps()
            ->create();

        $request_custom_fields = $this->table('request_custom_fields', ['signed' => true]);
        $request_custom_fields
            ->addColumn('request_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('field_id', 'integer', ['signed' => true, 'null' => true])
            ->addColumn('name', 'string', ['length' => 64, 'null' => false])
            ->addColumn('type', 'enum', [
                'values' => [
                    'string',
                    'text',
                    'integer',
                    'float',
                    'boolean',
                    'period',
                    'list',
                    'date',
                ],
                'null' => false,
            ])
            ->addColumn('config', 'json', ['null' => true])
            ->addColumn('value', 'json', ['null' => true])
            ->addIndex(['request_id'])
            ->addIndex(['field_id'])
            ->addIndex(['request_id', 'field_id'], ['unique' => true])
            ->addForeignKey('request_id', 'requests', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__request_custom_field__request',
            ])
            ->addForeignKey('field_id', 'custom_fields', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__request_custom_field__custom_field',
            ])
            ->create();

        //
        // - Caractéristiques spéciales de matériel.
        //

        $properties = $this->table('properties');
        $properties
            ->changeColumn('type', 'enum', [
                'values' => [
                    'string',
                    'text',
                    'integer',
                    'float',
                    'boolean',
                    'period',
                    'list',
                    'date',
                ],
                'null' => false,
            ])
            ->addColumn('config', 'json', ['null' => true, 'after' => 'type'])
            ->save();

        $propertiesData = array_column($this->fetchAll(sprintf('SELECT * FROM `%1$sproperties`', $prefix)), null, 'id');
        foreach ($propertiesData as $datum) {
            $config = match ($datum['type']) {
                'integer', 'float' => [
                    'unit' => $datum['unit'] ?: null,
                ],
                'string' => [
                    'max_length' => $datum['max_length'] ?: null,
                ],
                default => null,
            };
            if ($config === null) {
                continue;
            }

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sproperties', $prefix))
                ->set('config', json_encode($config))
                ->where(['id' => $datum['id']])
                ->execute();
        }

        $properties
            ->removeColumn('unit')
            ->removeColumn('max_length')
            ->save();

        //
        // - Caractéristiques spéciales du matériel.
        //

        // - Dé-duplique les propriétés des matériels en ne gardant que la dernière.
        $materialPropertiesData = [];
        $rawMaterialPropertiesData = $this->fetchAll(sprintf('SELECT * FROM `%1$smaterial_properties`', $prefix));
        foreach ($rawMaterialPropertiesData as $data) {
            $index = sprintf('%s-%s', $data['material_id'], $data['property_id']);
            $materialPropertiesData[$index] = $data;
        }

        foreach ($materialPropertiesData as $datum) {
            if ($datum['value'] === null) {
                continue;
            }

            $value = null;
            $propertyDatum = $propertiesData[$datum['property_id']] ?? null;
            if ($propertyDatum !== null) {
                switch ($propertyDatum['type']) {
                    case 'integer':
                        $value = filter_var($datum['value'], \FILTER_VALIDATE_INT, (
                            \FILTER_NULL_ON_FAILURE | \FILTER_REQUIRE_SCALAR
                        ));
                        break;

                    case 'float':
                        $value = filter_var($datum['value'], \FILTER_VALIDATE_FLOAT, (
                            \FILTER_NULL_ON_FAILURE | \FILTER_REQUIRE_SCALAR
                        ));
                        break;

                    case 'boolean':
                        $value = filter_var($datum['value'], \FILTER_VALIDATE_BOOL, (
                            \FILTER_NULL_ON_FAILURE | \FILTER_REQUIRE_SCALAR
                        ));
                        break;

                    default:
                        $value = $datum['value'];
                }
            }

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%smaterial_properties', $prefix))
                ->set('value', (
                    $value !== null
                        ? json_encode($value, \JSON_PRESERVE_ZERO_FRACTION)
                        : null
                ))
                ->where(['id' => $datum['id']])
                ->execute();
        }

        $material_properties = $this->table('material_properties');
        $material_properties
            ->changeColumn('value', 'json', ['null' => true])
            ->addIndex(['material_id', 'property_id'], ['unique' => true])
            ->update();

        //
        // - Caractéristiques spéciales des unités de matériel.
        //


        // - Dé-duplique les propriétés des unités de matériel en ne gardant que la dernière.
        $materialUnitPropertiesData = [];
        $rawMaterialUnitPropertiesData = $this->fetchAll(vsprintf(
            'SELECT * FROM `%1$smaterial_unit_properties`',
            [$prefix],
        ));
        foreach ($rawMaterialUnitPropertiesData as $data) {
            $index = sprintf('%s-%s', $data['material_unit_id'], $data['property_id']);
            $materialUnitPropertiesData[$index] = $data;
        }

        foreach ($materialUnitPropertiesData as $datum) {
            if ($datum['value'] === null) {
                continue;
            }

            $value = null;
            $propertyDatum = $propertiesData[$datum['property_id']] ?? null;
            if ($propertyDatum !== null) {
                switch ($propertyDatum['type']) {
                    case 'integer':
                        $value = filter_var($datum['value'], \FILTER_VALIDATE_INT, (
                            \FILTER_NULL_ON_FAILURE | \FILTER_REQUIRE_SCALAR
                        ));
                        break;

                    case 'float':
                        $value = filter_var($datum['value'], \FILTER_VALIDATE_FLOAT, (
                            \FILTER_NULL_ON_FAILURE | \FILTER_REQUIRE_SCALAR
                        ));
                        break;

                    case 'boolean':
                        $value = filter_var($datum['value'], \FILTER_VALIDATE_BOOL, (
                            \FILTER_NULL_ON_FAILURE | \FILTER_REQUIRE_SCALAR
                        ));
                        break;

                    default:
                        $value = $datum['value'];
                }
            }

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%smaterial_unit_properties', $prefix))
                ->set('value', (
                    $value !== null
                        ? json_encode($value, \JSON_PRESERVE_ZERO_FRACTION)
                        : null
                ))
                ->where(['id' => $datum['id']])
                ->execute();
        }

        $material_properties = $this->table('material_unit_properties');
        $material_properties
            ->changeColumn('value', 'json', ['null' => true])
            ->addIndex(['material_unit_id', 'property_id'], ['unique' => true])
            ->update();
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');

        $hasRequestsWithCustomFields = (
            (int) $this->fetchRow(vsprintf(
                'SELECT COUNT(*) AS `count` FROM `%1$srequest_custom_fields`',
                [$prefix],
            ))['count']
        ) !== 0;
        $hasUnrollbackablePropertiesTypes = (
            (int) $this->fetchRow(vsprintf(
                'SELECT COUNT(*) AS `count` FROM `%1$sproperties` WHERE `type` in ("period", "list")',
                [$prefix],
            ))['count']
        ) !== 0;
        if ($hasRequestsWithCustomFields || $hasUnrollbackablePropertiesTypes) {
            throw new \RuntimeException(
                "Unable to rollback the migration, this would cause the " .
                "loss of properties with \"period\" or \"list\" types and/or" .
                "requests with already specified custom field values.",
            );
        }

        //
        // - Champs personnalisés.
        //

        $this->table('request_custom_fields')->drop()->save();
        $this->table('custom_fields')->drop()->save();

        //
        // - Caractéristiques spéciales de matériel.
        //

        $properties = $this->table('properties');
        $properties
            ->changeColumn('type', 'enum', [
                'values' => ['string', 'text', 'integer', 'float', 'boolean', 'date'],
                'null' => false,
            ])
            ->addColumn('unit', 'string', [
                'null' => true,
                'length' => 8,
                'after' => 'type',
            ])
            ->addColumn('max_length', 'integer', [
                'null' => true,
                'after' => 'unit',
            ])
            ->save();

        $propertiesData = array_column($this->fetchAll(sprintf('SELECT * FROM `%1$sproperties`', $prefix)), null, 'id');
        foreach ($propertiesData as $datum) {
            $config = $datum['config'] !== null
                ? json_decode($datum['config'], true)
                : [];

            $data = match ($datum['type']) {
                'integer', 'float' => [
                    'unit' => $config['unit'] ?? null,
                ],
                'string' => [
                    'max_length' => $config['max_length'] ?? null,
                ],
                default => [],
            };
            if (empty($data)) {
                continue;
            }

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sproperties', $prefix))
                ->set($data)
                ->where(['id' => $datum['id']])
                ->execute();
        }

        $properties
            ->removeColumn('config')
            ->save();

        //
        // - Caractéristiques spéciales du matériel.
        //

        $material_properties = $this->table('material_properties');
        $material_properties
            ->changeColumn('value', 'text', ['null' => true])
            ->removeIndex(['material_id', 'property_id'])
            ->update();

        $materialPropertiesData = $this->fetchAll(vsprintf('SELECT * FROM `%1$smaterial_properties`', [$prefix]));
        foreach ($materialPropertiesData as $datum) {
            if ($datum['value'] === null) {
                continue;
            }
            $datum['value'] = json_decode($datum['value'], true);

            $value = null;
            $propertyDatum = $propertiesData[$datum['property_id']] ?? null;
            if ($propertyDatum !== null) {
                switch ($propertyDatum['type']) {
                    case 'integer':
                        $value = filter_var($datum['value'], \FILTER_VALIDATE_INT, (
                            \FILTER_NULL_ON_FAILURE | \FILTER_REQUIRE_SCALAR
                        ));
                        break;

                    case 'float':
                        $value = filter_var($datum['value'], \FILTER_VALIDATE_FLOAT, (
                            \FILTER_NULL_ON_FAILURE | \FILTER_REQUIRE_SCALAR
                        ));
                        break;

                    case 'boolean':
                        $value = filter_var($datum['value'], \FILTER_VALIDATE_BOOL, (
                            \FILTER_NULL_ON_FAILURE | \FILTER_REQUIRE_SCALAR
                        ));
                        break;

                    default:
                        $value = $datum['value'];
                }
            }

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%smaterial_properties', $prefix))
                ->set('value', $value !== null ? (string) $value : null)
                ->where(['id' => $datum['id']])
                ->execute();
        }

        //
        // - Caractéristiques spéciales des unités de matériel.
        //

        $material_unit_properties = $this->table('material_unit_properties');
        $material_unit_properties
            ->changeColumn('value', 'text', ['null' => true])
            ->removeIndex(['material_unit_id', 'property_id'])
            ->update();

        $materialUnitPropertiesData = $this->fetchAll(vsprintf(
            'SELECT * FROM `%1$smaterial_unit_properties`',
            [$prefix],
        ));
        foreach ($materialUnitPropertiesData as $datum) {
            if ($datum['value'] === null) {
                continue;
            }
            $datum['value'] = json_decode($datum['value'], true);

            $value = null;
            $propertyDatum = $propertiesData[$datum['property_id']] ?? null;
            if ($propertyDatum !== null) {
                switch ($propertyDatum['type']) {
                    case 'integer':
                        $value = filter_var($datum['value'], \FILTER_VALIDATE_INT, (
                            \FILTER_NULL_ON_FAILURE | \FILTER_REQUIRE_SCALAR
                        ));
                        break;

                    case 'float':
                        $value = filter_var($datum['value'], \FILTER_VALIDATE_FLOAT, (
                            \FILTER_NULL_ON_FAILURE | \FILTER_REQUIRE_SCALAR
                        ));
                        break;

                    case 'boolean':
                        $value = filter_var($datum['value'], \FILTER_VALIDATE_BOOL, (
                            \FILTER_NULL_ON_FAILURE | \FILTER_REQUIRE_SCALAR
                        ));
                        break;

                    default:
                        $value = $datum['value'];
                }
            }

            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%smaterial_unit_properties', $prefix))
                ->set('value', $value !== null ? (string) $value : null)
                ->where(['id' => $datum['id']])
                ->execute();
        }
    }
}
