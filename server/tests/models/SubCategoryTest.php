<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Loxya\Models\SubCategory;
use Loxya\Support\Validation\ValidationsException;

final class SubCategoryTest extends TestCase
{
    public function testCreateDuplicate(): void
    {
        // - Ajoute une sous-catégorie qui a le même nom qu'une autre,
        //   mais dans une catégorie différente
        try {
            SubCategory::new(['name' => 'Gradateurs', 'category_id' => 1]);
        } catch (ValidationsException) {
            $this->fail("Should have been created without validation errors.");
        }

        // - Tente d'ajouter une sous-catégorie qui existe déjà pour cette catégorie
        $this->expectException(ValidationsException::class);
        SubCategory::new(['name' => 'Gradateurs', 'category_id' => 2]);
    }
}
