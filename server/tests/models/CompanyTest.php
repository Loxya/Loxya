<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Loxya\Models\Company;

final class CompanyTest extends TestCase
{
    public function testSearch(): void
    {
        // - Recherche avec la raison sociale de la société.
        $results = Company::search('testin')->get();
        $this->assertCount(1, $results);
        $this->assertEquals(['Testing, Inc'], $results->pluck('legal_name')->all());

        // - Recherche avec son numéro d'enregistrement.
        $results = Company::search('123456789')->get();
        $this->assertCount(1, $results);
        $this->assertEquals(['Obscure'], $results->pluck('legal_name')->all());
    }

    public function testCreateCompanyNormalizeRegistrationId(): void
    {
        // - Avec un numéro français
        $resultCompany = Company::new([
            'legal_name' => 'Test Company 1',
            'registration_id' => '456 789 123',
        ]);
        $this->assertEquals('456789123', $resultCompany->registration_id);

        // - Avec un numéro suisse
        $resultCompany = Company::new([
            'legal_name' => 'Test Company 2',
            'registration_id' => 'CHE-123.456.789',
        ]);
        $this->assertEquals('CHE123456789', $resultCompany->registration_id);
    }

    public function testCreateCompanyNormalizePhone(): void
    {
        // - Test 1 : Sans préfixe.
        $resultCompany = Company::new([
            'legal_name' => 'Test Company',
            'phone' => '06 25 25 21 25',
        ]);
        $this->assertEquals('0625252125', $resultCompany->phone);

        // - Test 2 : Avec préfixe `00`.
        $resultCompany = Company::new([
            'legal_name' => 'Test Company 2',
            'phone' => '00336 25 25 21 25',
        ]);
        $this->assertEquals('0033625252125', $resultCompany->phone);

        // - Test 3 : Avec préfixe `+`.
        $resultCompany = Company::new([
            'legal_name' => 'Test Company 3',
            'phone' => '+336 25 25 21 25',
        ]);
        $this->assertEquals('+33625252125', $resultCompany->phone);
    }
}
