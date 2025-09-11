<?php
declare(strict_types=1);

use Loxya\Config\Config;
use Loxya\Support\Storage\StorageFactory;
use Loxya\Support\Str;
use Phinx\Migration\AbstractMigration;

final class MoveUploadedFiles extends AbstractMigration
{
    public function up(): void
    {
        if (Config::getEnv() === 'test') {
            return;
        }

        $prefix = Config::get('db.prefix');
        $rootOldDirectory = sprintf('_old-%s', date('YmdHis'));
        $storage = StorageFactory::createLocalDriver([
            'root' => DATA_FOLDER . DS . 'materials',
        ]);

        // - Déplace les anciens dossiers vers un dossier `_old`.
        $oldDirectories = $storage->directories();
        foreach ($oldDirectories as $oldDirectory) {
            $storage->move($oldDirectory, $rootOldDirectory . DS . $oldDirectory);
        }

        // - Crée les nouveaux dossiers pour les images et documents du matériel.
        $storage->createDirectory('picture');
        $storage->createDirectory('documents');

        // - Récupère les images utilisées et les transferts dans le bon dossier.
        $qb = $this->getSelectBuilder();
        $materials = $qb
            ->select(['id', 'picture'])
            ->from(sprintf('%smaterials', $prefix))
            ->where(['NOT' => ['picture' => 'NULL']])
            ->execute()->fetchAll('assoc');

        if (!empty($materials)) {
            foreach ($materials as $material) {
                $qb = $this->getUpdateBuilder();
                $qb
                    ->update(sprintf('%smaterials', $prefix))
                    ->where(['id' => $material['id']]);

                $oldPath = $rootOldDirectory . DS . $material['id'] . DS . $material['picture'];
                if ($storage->fileExists($oldPath)) {
                    $extension = pathinfo($material['picture'], PATHINFO_EXTENSION);
                    $filename = sprintf('%s.%s', (string) Str::uuid(), $extension);
                    $storage->copy($oldPath, 'picture' . DS . $filename);
                    $qb->set('picture', $filename);
                } else {
                    $qb->set('picture', null);
                }

                $qb->execute();
            }
        }

        // - Récupère les documents utilisés et les transferts dans le bon dossier.
        $qb = $this->getSelectBuilder();
        $documents = $qb
            ->select(['id', 'material_id', 'name'])
            ->from(sprintf('%sdocuments', $prefix))
            ->execute()->fetchAll('assoc');

        if (!empty($documents)) {
            foreach ($documents as $document) {
                $oldPath = $rootOldDirectory . DS . $document['material_id'] . DS . $document['name'];
                if ($storage->fileExists($oldPath)) {
                    $storage->copy($oldPath, 'documents' . DS . $document['material_id'] . DS . $document['name']);
                } else {
                    $qb = $this->getDeleteBuilder();
                    $qb
                        ->delete(sprintf('%sdocuments', $prefix))
                        ->where(['id' => $document['id']])
                        ->execute();
                }
            }
        }
    }

    public function down(): void
    {
        if (Config::getEnv() === 'test') {
            return;
        }

        $prefix = Config::get('db.prefix');
        $rootOldDirectory = sprintf('_old-%s', date('YmdHis'));
        $storage = StorageFactory::createLocalDriver([
            'root' => DATA_FOLDER . DS . 'materials',
        ]);

        // - Déplace les anciens dossiers vers un dossier `_old`.
        $oldDirectories = $storage->directories();
        foreach ($oldDirectories as $oldDirectory) {
            $storage->move($oldDirectory, $rootOldDirectory . DS . $oldDirectory);
        }

        // - Récupère les images utilisées et les transferts dans le bon dossier.
        $qb = $this->getSelectBuilder();
        $materials = $qb
            ->select(['id', 'picture'])
            ->from(sprintf('%smaterials', $prefix))
            ->where(['NOT' => ['picture' => 'NULL']])
            ->execute()->fetchAll('assoc');

        if (!empty($materials)) {
            foreach ($materials as $material) {
                $oldPath = $rootOldDirectory . DS . 'picture' . DS . $material['picture'];
                if ($storage->fileExists($oldPath)) {
                    $storage->copy($oldPath, $material['id'] . DS . $material['picture']);
                } else {
                    $qb = $this->getUpdateBuilder();
                    $qb
                        ->update(sprintf('%smaterials', $prefix))
                        ->set('picture', null)
                        ->where(['id' => $material['id']])
                        ->execute();
                }
            }
        }

        // - Récupère les documents utilisés et les transferts dans le bon dossier.
        $qb = $this->getSelectBuilder();
        $documents = $qb
            ->select(['id', 'material_id', 'name'])
            ->from(sprintf('%sdocuments', $prefix))
            ->execute()->fetchAll('assoc');

        if (!empty($documents)) {
            foreach ($documents as $document) {
                // phpcs:ignore Generic.Files.LineLength
                $oldPath = $rootOldDirectory . DS . 'documents' . DS . $document['material_id'] . DS . $document['name'];
                if ($storage->fileExists($oldPath)) {
                    $storage->copy($oldPath, $document['material_id'] . DS . $document['name']);
                } else {
                    $qb = $this->getDeleteBuilder();
                    $qb
                        ->delete(sprintf('%sdocuments', $prefix))
                        ->where(['id' => $document['id']])
                        ->execute();
                }
            }
        }
    }
}
