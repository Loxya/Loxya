<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\App;
use Loxya\Errors\Enums\ApiErrorCode;
use Slim\HttpCache\Cache as HttpCache;

abstract class ApiTestCase extends TestCase
{
    protected App $app;

    protected ApiTestClient $client;

    protected function setUp(): void
    {
        parent::setUp();

        $this->app = new App();
        $this->client = new ApiTestClient($this->app);

        // - Configuration spécifique aux tests.
        $this->app->add(new HttpCache('private', 0));
    }

    // ------------------------------------------------------
    // -
    // -    Assertion methods
    // -
    // ------------------------------------------------------

    public function assertStatusCode(int $expectedCode): void
    {
        $actualCode = $this->client->getResponseHttpCode();

        $this->assertEquals(
            $expectedCode,
            $actualCode,
            vsprintf(
                "The HTTP error code `%s` does not match expected `%s`.\nFull output:\n%s",
                [$actualCode, $expectedCode, $this->client->getResponseAsString()],
            ),
        );
    }

    public function assertApiError(ApiErrorCode $code, ?string $message = null): void
    {
        $result = $this->client->getResponseAsArray();

        foreach (['success', 'error'] as $key) {
            $this->assertArrayHasKey($key, $result, sprintf(
                "The expected error payload is missing. Actual output:\n%s",
                json_encode($result, JSON_PRETTY_PRINT),
            ));
        }

        $this->assertFalse($result['success']);
        $this->assertApiErrorCode($code);
        if ($message !== null) {
            $this->assertApiErrorMessage($message);
        }
    }

    public function assertApiErrorCode(ApiErrorCode $code): void
    {
        $result = $this->client->getResponseAsArray();

        if (!isset($result['error']['code'])) {
            $this->fail(sprintf(
                "The expected error code is missing. Actual output:\n%s",
                json_encode($result, JSON_PRETTY_PRINT),
            ));
        }

        $resultCode = $result['error']['code'];
        $this->assertSame(
            $code->value,
            $resultCode,
            vsprintf(
                "The API error code `%s` does not match expected `%s`.\nFull output:\n%s",
                [$resultCode, $code->value, json_encode($result, JSON_PRETTY_PRINT)],
            ),
        );
    }

    public function assertApiErrorMessage(string $message): void
    {
        $result = $this->client->getResponseAsArray();

        if (!isset($result['error']['message'])) {
            $this->fail(sprintf(
                "The expected error message is missing.\nFull output:\n%s",
                json_encode($result, JSON_PRETTY_PRINT),
            ));
        }

        $resultMessage = $result['error']['message'];
        $this->assertSame(
            $message,
            $resultMessage,
            sprintf(
                "The API error message does not match the expected one (got \"%s\" instead of \"%s\").\n" .
                "Full output:\n%s",
                is_string($resultMessage) ? $resultMessage : var_export($resultMessage, true),
                $message,
                json_encode($result, JSON_PRETTY_PRINT),
            ),
        );
    }

    public function assertApiValidationError($details = null): void
    {
        $this->assertStatusCode(StatusCode::STATUS_BAD_REQUEST);
        $this->assertApiErrorCode(ApiErrorCode::VALIDATION_FAILED);

        if ($details !== null) {
            $result = $this->client->getResponseAsArray();
            $this->assertSameCanonicalize($details, $result['error']['details']);
        }
    }

    public function assertResponseData(mixed $expectedData): void
    {
        $response = $this->client->getResponseAsDecodedJson();
        $this->assertSameCanonicalize($expectedData, $response);
    }

    public function assertResponseHasKey(string $path): void
    {
        $response = $this->client->getResponseAsDotArray();

        $this->assertTrue($response->has($path), sprintf("The key \"%s\" does not exist in the answer.", $path));
    }

    public function assertResponseHasNotKey(string $path): void
    {
        $response = $this->client->getResponseAsDotArray();

        $this->assertFalse($response->has($path), sprintf("The key \"%s\" exists in the answer.", $path));
    }

    public function assertResponseHasKeyEquals(string $path, $expectedValue): void
    {
        $response = $this->client->getResponseAsDotArray();

        $this->assertTrue($response->has($path), sprintf("The key \"%s\" does not exist in the answer.", $path));
        $this->assertSameCanonicalize($expectedValue, $response->get($path));
    }

    public function assertResponseHasKeyNotEquals(string $path, $expectedValue): void
    {
        $response = $this->client->getResponseAsDotArray();

        $this->assertTrue($response->has($path), sprintf("The key \"%s\" does not exist in the answer.", $path));
        $this->assertNotSameCanonicalize($expectedValue, $response->get($path));
    }

    public function assertResponsePaginatedData(int $totalCount, $expectedData = null): void
    {
        $response = $this->client->getResponseAsDotArray();

        $this->assertTrue(
            $response->has(['pagination', 'data']),
            "The answer doesn't seem to be paginated.",
        );

        $data = $response->get('data');

        // - Vérifie les données de pagination.
        $this->assertSame($totalCount, $response->get('pagination.total.items'));

        // - Vérifie les données paginées (optionnel).
        if ($expectedData !== null) {
            $this->assertSameCanonicalize($expectedData, $data);
        }
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    protected static function dataFactory($id, array $data)
    {
        $data = array_column($data, null, 'id');
        return $id ? $data[$id] : array_values($data);
    }
}
