<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Phinx\Migration\AbstractMigration;

final class CreateGroupsProfile extends AbstractMigration
{
    public function up(): void
    {
        $prefix = Config::get('db.prefix');
        $defaultTags = Config::get('legacy.defaultTags', []);

        // - Tag "Bénéficiaire".
        $qb = $this->getSelectBuilder();
        $beneficiaryTag = $qb
            ->select(['id', 'name'])
            ->from(sprintf('%stags', $prefix))
            ->where(['name' => $defaultTags['beneficiary'] ?? 'Bénéficiaire'])
            ->execute()->fetch('assoc');

        // - Tag "Technicien".
        $qb = $this->getSelectBuilder();
        $technicianTag = $qb
            ->select(['id', 'name'])
            ->from(sprintf('%stags', $prefix))
            ->where(['name' => $defaultTags['technician'] ?? 'Technicien'])
            ->execute()->fetch('assoc');

        //
        // - Bénéficiaires
        //

        $beneficiaries = $this->table('beneficiaries', ['signed' => true]);
        $beneficiaries
            ->addColumn('reference', 'string', ['length' => 96, 'null' => true])
            ->addColumn('person_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('company_id', 'integer', [
                'signed' => true,
                'null' => true,
                'default' => null,
            ])
            ->addColumn('note', 'text', ['null' => true])
            ->addColumn('created_at', 'datetime', ['null' => false])
            ->addColumn('updated_at', 'datetime', ['null' => true])
            ->addColumn('deleted_at', 'datetime', ['null' => true])
            ->addIndex(['reference'], ['unique' => true])
            ->addIndex(['company_id'])
            ->addForeignKey('company_id', 'companies', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__beneficiary__company',
            ])
            ->addIndex(['person_id'], ['unique' => true])
            ->addForeignKey('person_id', 'persons', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__beneficiary__person',
            ])
            ->create();

        if ($beneficiaryTag) {
            $qb = $this->getSelectBuilder();
            $personsData = $qb
                ->select([
                    'p.id',
                    'p.reference',
                    'p.company_id',
                    'p.note',
                    'p.created_at',
                    'p.updated_at',
                    'p.deleted_at',
                ])
                ->from(['p' => sprintf('%spersons', $prefix)])
                ->innerJoin(['t' => sprintf('%staggables', $prefix)], [
                    't.tag_id' => $beneficiaryTag['id'],
                    't.taggable_type' => 'Robert2\API\Models\Person',
                    't.taggable_id = p.id',
                ])
                ->orderByAsc('p.id')
                ->execute()->fetchAll('assoc');

            if (!empty($personsData)) {
                $beneficiariesData = [];
                foreach ($personsData as $personData) {
                    $beneficiariesData[] = [
                        'reference' => $personData['reference'],
                        'person_id' => $personData['id'],
                        'company_id' => $personData['company_id'],
                        'note' => $personData['note'],
                        'created_at' => $personData['created_at'],
                        'updated_at' => $personData['updated_at'],
                        'deleted_at' => $personData['deleted_at'],
                    ];
                }
                $beneficiaries->insert($beneficiariesData)->saveData();
            }
        }

        $qb = $this->getSelectBuilder();
        $personBeneficiaryMap = array_column(
            $qb
                ->select(['id', 'person_id'])
                ->from(sprintf('%sbeneficiaries', $prefix))
                ->execute()->fetchAll('assoc'),
            'id',
            'person_id',
        );

        //
        // -- Bénéficiaires des événements
        //

        $event_beneficiaries = $this->table('event_beneficiaries');
        $event_beneficiaries
            ->dropForeignKey('person_id')
            ->removeIndex(['person_id'])
            ->addColumn('beneficiary_id', 'integer', [
                'signed' => true,
                'null' => true,
                'after' => 'event_id',
            ])
            ->update();

        foreach ($personBeneficiaryMap as $personId => $beneficiaryId) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sevent_beneficiaries', $prefix))
                ->set(['beneficiary_id' => $beneficiaryId])
                ->where(['person_id' => $personId])
                ->execute();
        }

        $event_beneficiaries
            ->changeColumn('beneficiary_id', 'integer', ['signed' => true, 'null' => false])
            ->removeColumn('person_id')
            ->addIndex(['beneficiary_id'])
            ->addForeignKey('beneficiary_id', 'beneficiaries', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__event_beneficiary__beneficiary',
            ])
            ->update();

        //
        // -- Bénéficiaires des Factures / Devis
        //

        $billTables = ['bills' => 'bill', 'estimates' => 'estimate'];
        foreach ($billTables as $billTableName => $billTableSingularName) {
            $table = $this->table($billTableName);
            $table
                ->removeIndex(['beneficiary_id'])
                ->dropForeignKey('beneficiary_id')
                ->dropForeignKey('event_id')
                ->update();

            $table
                ->renameColumn('beneficiary_id', 'person_id')
                ->update();

            $table
                ->addColumn('beneficiary_id', 'integer', [
                    'signed' => true,
                    'null' => true,
                    'after' => 'event_id',
                ])
                ->update();

            foreach ($personBeneficiaryMap as $personId => $beneficiaryId) {
                $qb = $this->getUpdateBuilder();
                $qb
                    ->update(sprintf('%s%s', $prefix, $billTableName))
                    ->set(['beneficiary_id' => $beneficiaryId])
                    ->where(['person_id' => $personId])
                    ->execute();
            }

            $table
                ->changeColumn('beneficiary_id', 'integer', ['signed' => true, 'null' => false])
                ->removeColumn('person_id')
                ->addIndex(['beneficiary_id'])
                ->addForeignKey('beneficiary_id', 'beneficiaries', 'id', [
                    'delete' => 'CASCADE',
                    'update' => 'NO_ACTION',
                    'constraint' => sprintf('fk__%s__beneficiary', $billTableSingularName),
                ])
                ->addForeignKey('event_id', 'events', 'id', [
                    'delete' => 'CASCADE',
                    'update' => 'NO_ACTION',
                    'constraint' => sprintf('fk__%s__event', $billTableSingularName),
                ])
                ->update();
        }

        //
        // - Techniciens
        //

        $technicians = $this->table('technicians', ['signed' => true]);
        $technicians
            ->addColumn('person_id', 'integer', ['signed' => true, 'null' => false])
            ->addColumn('nickname', 'string', ['length' => 96, 'null' => true])
            ->addColumn('note', 'text', ['null' => true])
            ->addColumn('created_at', 'datetime', ['null' => false])
            ->addColumn('updated_at', 'datetime', ['null' => true])
            ->addColumn('deleted_at', 'datetime', ['null' => true])
            ->addIndex(['person_id'], ['unique' => true])
            ->addForeignKey('person_id', 'persons', 'id', [
                'delete' => 'RESTRICT',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__technician__person',
            ])
            ->create();

        if ($technicianTag) {
            $qb = $this->getSelectBuilder();
            $personsData = $qb
                ->select([
                    'p.id',
                    'p.nickname',
                    'p.note',
                    'p.created_at',
                    'p.updated_at',
                    'p.deleted_at',
                ])
                ->from(['p' => sprintf('%spersons', $prefix)])
                ->innerJoin(['t' => sprintf('%staggables', $prefix)], [
                    't.tag_id' => $technicianTag['id'],
                    't.taggable_type' => 'Robert2\API\Models\Person',
                    't.taggable_id = p.id',
                ])
                ->orderByAsc('p.id')
                ->execute()->fetchAll('assoc');

            if (!empty($personsData)) {
                $techniciansData = [];
                foreach ($personsData as $personData) {
                    $techniciansData[] = [
                        'nickname' => $personData['nickname'],
                        'person_id' => $personData['id'],
                        'note' => $personData['note'],
                        'created_at' => $personData['created_at'],
                        'updated_at' => $personData['updated_at'],
                        'deleted_at' => $personData['deleted_at'],
                    ];
                }
                $technicians->insert($techniciansData)->saveData();
            }
        }

        $qb = $this->getSelectBuilder();
        $personTechnicianMap = array_column(
            $qb
                ->select(['id', 'person_id'])
                ->from(sprintf('%stechnicians', $prefix))
                ->execute()->fetchAll('assoc'),
            'id',
            'person_id',
        );

        //
        // -- Techniciens des événements
        //

        $event_technicians = $this->table('event_technicians');
        $event_technicians
            ->dropForeignKey('technician_id')
            ->removeIndex(['technician_id'])
            ->update();

        $event_technicians
            ->renameColumn('technician_id', 'person_id')
            ->update();

        $event_technicians
            ->addColumn('technician_id', 'integer', [
                'signed' => true,
                'null' => true,
                'after' => 'event_id',
            ])
            ->update();

        foreach ($personTechnicianMap as $personId => $technicianId) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sevent_technicians', $prefix))
                ->where(['person_id' => $personId])
                ->set('technician_id', $technicianId)
                ->execute();
        }

        $event_technicians
            ->changeColumn('technician_id', 'integer', ['signed' => true, 'null' => false])
            ->removeColumn('person_id')
            ->addIndex(['technician_id'])
            ->addForeignKey('technician_id', 'technicians', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__event_technician__technician',
            ])
            ->update();

        //
        // - Suppression des données obsolètes
        //

        $persons = $this->table('persons');
        $persons
            ->removeIndex(['reference'])
            ->removeIndex(['company_id'])
            ->dropForeignKey('company_id')
            ->update();

        $persons
            ->removeColumn('reference')
            ->removeColumn('company_id')
            ->removeColumn('nickname')
            ->removeColumn('note')
            ->removeColumn('deleted_at')
            ->update();

        $parks = $this->table('parks');
        $parks
            ->dropForeignKey('person_id')
            ->removeIndex(['person_id'])
            ->dropForeignKey('company_id')
            ->removeIndex(['company_id'])
            ->update();

        $parks
            ->removeColumn('person_id')
            ->removeColumn('company_id')
            ->update();

        if ($beneficiaryTag || $technicianTag) {
            $qb = $this->getDeleteBuilder();
            $qb
                ->delete(sprintf('%stags', $prefix))
                ->where(static fn ($exp) => (
                    $exp->in('name', array_map(
                        static fn ($tag) => $tag['name'],
                        array_filter([$beneficiaryTag, $technicianTag]),
                    ))
                ))
                ->execute();
        }
    }

    public function down(): void
    {
        $prefix = Config::get('db.prefix');
        $defaultTags = Config::get('legacy.defaultTags', []);

        //
        // - Tags
        //

        $beneficiaryTagName = $defaultTags['beneficiary'] ?? 'Bénéficiaire';
        $technicianTagName = $defaultTags['technician'] ?? 'Technicien';

        $tags = $this->table('tags');
        $tags
            ->insert([
                ['name' => $beneficiaryTagName],
                ['name' => $technicianTagName],
            ])
            ->saveData();

        // - Id du tag "Bénéficiaire".
        $qb = $this->getSelectBuilder();
        $beneficiaryTagId = $qb
            ->select(['id'])
            ->from(sprintf('%stags', $prefix))
            ->where(['name' => $beneficiaryTagName])
            ->execute()->fetch('assoc')['id'];

        // - Id du tag "Technicien".
        $qb = $this->getSelectBuilder();
        $technicianTagId = $qb
            ->select(['id'])
            ->from(sprintf('%stags', $prefix))
            ->where(['name' => $technicianTagName])
            ->execute()->fetch('assoc')['id'];

        //
        // - Personnes
        //

        $persons = $this->table('persons');
        $persons
            ->addColumn('reference', 'string', [
                'length' => 96,
                'null' => true,
                'after' => 'last_name',
            ])
            ->addColumn('nickname', 'string', [
                'length' => 96,
                'null' => true,
                'after' => 'reference',
            ])
            ->addColumn('company_id', 'integer', [
                'signed' => true,
                'null' => true,
                'after' => 'country_id',
            ])
            ->addColumn('note', 'text', [
                'null' => true,
                'after' => 'company_id',
            ])
            ->addColumn('deleted_at', 'datetime', [
                'null' => true,
                'after' => 'updated_at',
            ])
            ->addIndex(['reference'], ['unique' => true, 'name' => 'reference_UNIQUE'])
            ->addIndex(['company_id'])
            ->addForeignKey('company_id', 'companies', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__person__company',
            ])
            ->update();

        //
        // - Bénéficiaires
        //

        $qb = $this->getSelectBuilder();
        $beneficiariesData = $qb
            ->select([
                'id',
                'person_id',
                'company_id',
                'reference',
                'note',
                'deleted_at',
            ])
            ->from(sprintf('%sbeneficiaries', $prefix))
            ->execute()->fetchAll('assoc');

        $personBeneficiaryMap = [];
        foreach ($beneficiariesData as $beneficiaryData) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%spersons', $prefix))
                ->set('reference', $beneficiaryData['reference'])
                ->set('note', $beneficiaryData['note'])
                ->set('company_id', $beneficiaryData['company_id'])
                ->set('deleted_at', $beneficiaryData['deleted_at'])
                ->where(['id' => $beneficiaryData['person_id']])
                ->execute();

            $personBeneficiaryMap[$beneficiaryData['person_id']] = $beneficiaryData['id'];
        }

        if (!empty($personBeneficiaryMap)) {
            $this->table('taggables')
                ->insert(array_map(
                    static fn ($personId) => [
                        'tag_id' => $beneficiaryTagId,
                        'taggable_type' => 'Robert2\API\Models\Person',
                        'taggable_id' => $personId,
                    ],
                    array_keys($personBeneficiaryMap),
                ))
                ->saveData();
        }

        //
        // -- Bénéficiaires des événements
        //

        $event_beneficiaries = $this->table('event_beneficiaries');
        $event_beneficiaries
            ->dropForeignKey('beneficiary_id')
            ->removeIndex(['beneficiary_id'])
            ->addColumn('person_id', 'integer', [
                'signed' => true,
                'null' => true,
                'after' => 'event_id',
            ])
            ->update();

        foreach ($personBeneficiaryMap as $personId => $beneficiaryId) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sevent_beneficiaries', $prefix))
                ->set(['person_id' => $personId])
                ->where(['beneficiary_id' => $beneficiaryId])
                ->execute();
        }

        $event_beneficiaries
            ->changeColumn('person_id', 'integer', ['signed' => true, 'null' => false])
            ->removeColumn('beneficiary_id')
            ->addIndex(['person_id'])
            ->addForeignKey('person_id', 'persons', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__event_beneficiary__person',
            ])
            ->update();

        //
        // -- Bénéficiaires des Factures / Devis
        //

        $billTables = ['bills' => 'bill', 'estimates' => 'estimate'];
        foreach ($billTables as $billTableName => $billTableSingularName) {
            $table = $this->table($billTableName);
            $table
                ->removeIndex(['beneficiary_id'])
                ->dropForeignKey('beneficiary_id')
                ->dropForeignKey('event_id')
                ->update();

            $table
                ->renameColumn('beneficiary_id', 'old_beneficiary_id')
                ->update();

            $table
                ->addColumn('beneficiary_id', 'integer', [
                    'signed' => true,
                    'null' => true,
                    'after' => 'event_id',
                ])
                ->update();

            foreach ($personBeneficiaryMap as $personId => $beneficiaryId) {
                $qb = $this->getUpdateBuilder();
                $qb
                    ->update(sprintf('%s%s', $prefix, $billTableName))
                    ->set(['beneficiary_id' => $personId])
                    ->where(['old_beneficiary_id' => $beneficiaryId])
                    ->execute();
            }

            $table
                ->changeColumn('beneficiary_id', 'integer', ['signed' => true, 'null' => false])
                ->removeColumn('old_beneficiary_id')
                ->addIndex(['beneficiary_id'])
                ->addForeignKey('beneficiary_id', 'persons', 'id', [
                    'delete' => 'CASCADE',
                    'update' => 'NO_ACTION',
                    'constraint' => sprintf('fk__%s__beneficiary', $billTableSingularName),
                ])
                ->addForeignKey('event_id', 'events', 'id', [
                    'delete' => 'CASCADE',
                    'update' => 'NO_ACTION',
                    'constraint' => sprintf('fk__%s__event', $billTableSingularName),
                ])
                ->update();
        }

        $this->table('beneficiaries')->drop()->save();

        //
        // - Techniciens
        //

        $qb = $this->getSelectBuilder();
        $techniciansData = $qb
            ->select([
                'id',
                'person_id',
                'nickname',
                'note',
                'deleted_at',
            ])
            ->from(sprintf('%stechnicians', $prefix))
            ->execute()->fetchAll('assoc');

        $personTechnicianMap = [];
        foreach ($techniciansData as $technicianData) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%spersons', $prefix))
                ->where(['id' => $technicianData['person_id']])
                ->set('note', $technicianData['note'])
                ->set('nickname', $technicianData['nickname'])
                ->set('deleted_at', $technicianData['deleted_at'])
                ->execute();

            $personTechnicianMap[$technicianData['person_id']] = $technicianData['id'];
        }

        if (!empty($personTechnicianMap)) {
            $this->table('taggables')
                ->insert(array_map(
                    static fn ($personId) => [
                        'tag_id' => $technicianTagId,
                        'taggable_type' => 'Robert2\API\Models\Person',
                        'taggable_id' => $personId,
                    ],
                    array_keys($personTechnicianMap),
                ))
                ->saveData();
        }

        //
        // -- Techniciens des événements
        //

        $event_technicians = $this->table('event_technicians');
        $event_technicians
            ->dropForeignKey('technician_id')
            ->removeIndex(['technician_id'])
            ->update();

        $event_technicians
            ->renameColumn('technician_id', 'old_technician_id')
            ->update();

        $event_technicians
            ->addColumn('technician_id', 'integer', [
                'signed' => true,
                'null' => true,
                'after' => 'event_id',
            ])
            ->update();

        foreach ($personTechnicianMap as $personId => $technicianId) {
            $qb = $this->getUpdateBuilder();
            $qb
                ->update(sprintf('%sevent_technicians', $prefix))
                ->set(['technician_id' => $personId])
                ->where(['old_technician_id' => $technicianId])
                ->execute();
        }

        $event_technicians
            ->changeColumn('technician_id', 'integer', ['signed' => true, 'null' => false])
            ->removeColumn('old_technician_id')
            ->addIndex(['technician_id'])
            ->addForeignKey('technician_id', 'persons', 'id', [
                'delete' => 'CASCADE',
                'update' => 'NO_ACTION',
                'constraint' => 'fk__event_technician__technician',
            ])
            ->update();

        $this->table('technicians')->drop()->save();

        //
        // - Autres données
        //

        $parks = $this->table('parks');
        $parks
            ->addColumn('person_id', 'integer', [
                'signed' => true,
                'null' => true,
                'after' => 'name',
            ])
            ->addColumn('company_id', 'integer', [
                'signed' => true,
                'null' => true,
                'after' => 'person_id',
            ])
            ->addIndex(['person_id'])
            ->addForeignKey('person_id', 'persons', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk_parks_persons',
            ])
            ->addIndex(['company_id'])
            ->addForeignKey('company_id', 'companies', 'id', [
                'delete' => 'SET_NULL',
                'update' => 'NO_ACTION',
                'constraint' => 'fk_parks_companies',
            ])
            ->update();
    }
}
