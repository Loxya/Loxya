<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Models\Estimate;

final class EstimatesTest extends ApiTestCase
{
    public static function data(?int $id = null)
    {
        return static::dataFactory($id, [
            [
                'id' => 1,
                'date' => '2021-01-30 14:00:00',
                'url' => 'http://loxya.test/estimates/1/pdf',
                'total_without_taxes' => '886.64',
                'total_taxes' => [
                    [
                        'name' => 'T.V.A.',
                        'is_rate' => true,
                        'value' => '20.000',
                        'total' => '176.42',
                    ],
                    [
                        'name' => 'T.V.A.',
                        'is_rate' => true,
                        'value' => '5.000',
                        'total' => '0.23',
                    ],
                ],
                'total_with_taxes' => '1063.29',
                'currency' => 'EUR',
            ],
            [
                'id' => 2,
                'date' => '2021-01-30 14:00:00',
                'url' => 'http://loxya.test/estimates/2/pdf',
                'total_without_taxes' => '550.28',
                'total_taxes' => [
                    [
                        'name' => 'T.V.A.',
                        'is_rate' => true,
                        'value' => '20.000',
                        'total' => '110.06',
                    ],
                ],
                'total_with_taxes' => '660.34',
                'currency' => 'EUR',
            ],
        ]);
    }

    public function testDeleteAndDestroy(): void
    {
        // - First call: soft delete.
        $this->client->delete('/api/estimates/1');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $softDeleted = Estimate::withTrashed()->find(1);
        $this->assertNotNull($softDeleted);
        $this->assertNotEmpty($softDeleted->deleted_at);

        // - Second call: actually DESTROY record from DB
        $this->client->delete('/api/estimates/1');
        $this->assertStatusCode(StatusCode::STATUS_NO_CONTENT);
        $this->assertNull(Estimate::withTrashed()->find(1));
    }

    public function testDownloadPdf(): void
    {
        // - Si le devis n'existe pas...
        $this->client->get('/estimates/999/pdf');
        $this->assertStatusCode(StatusCode::STATUS_NOT_FOUND);

        // - Télécharge le PDF du devis #1.
        $responseStream = $this->client->get('/estimates/1/pdf');
        $this->assertStatusCode(StatusCode::STATUS_OK);
        $this->assertTrue($responseStream->isReadable());
        $this->assertMatchesHtmlSnapshot((string) $responseStream);
    }
}
