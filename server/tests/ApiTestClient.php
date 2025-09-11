<?php
declare(strict_types=1);

namespace Loxya\Tests;

use Adbar\Dot as DotArray;
use Loxya\App;
use Loxya\Http\Request;
use Loxya\Services\Auth;
use Loxya\Support\Arr;
use Loxya\Support\Assert;
use Psr\Http\Message\StreamInterface as Body;
use Psr\Http\Message\UploadedFileInterface;
use Psr\Http\Message\UriInterface;
use Slim\Http\Response;
use Slim\Psr7\Factory\ServerRequestFactory;

/**
 * ApiTestClient.
 *
 * @method Body get(UriInterface|string $uri, array|callable|null $headers = null)
 * @method Body post(UriInterface|string $uri, ?array $data = null, array|UploadedFileInterface|null $files = null, array|callable|null $headers = null)
 * @method Body patch(UriInterface|string $uri, ?array $data = null, ?array $files = null, array|callable|null $headers = null)
 * @method Body put(UriInterface|string $uri, ?array $data = null, ?array $files = null, array|callable|null $headers = null)
 * @method Body delete(UriInterface|string $uri, array|callable|null $headers = null)
 * @method Body head(UriInterface|string $uri, array|callable|null $headers = null)
 * @method Body options(UriInterface|string $uri, array|callable|null $headers = null)
 */
final class ApiTestClient
{
    private App $app;

    private ?Request $request;

    private ?Response $response;

    public function __construct(App $app)
    {
        $this->app = $app;
    }

    public function __call($method, $arguments): Body
    {
        $uri = array_shift($arguments);
        Assert::notNull($uri, 'Endpoint URI should be specified.');

        switch (strtoupper($method)) {
            case 'GET':
            case 'HEAD':
            case 'OPTIONS':
            case 'DELETE':
                [$headers] = Arr::defaults($arguments, [null]);
                return $this->request($method, $uri, null, null, $headers);

            case 'POST':
            case 'PUT':
            case 'PATCH':
                [$data, $files, $headers] = Arr::defaults($arguments, [null, null, null]);
                return $this->request($method, $uri, $data, $files, $headers);

            default:
                throw new \InvalidArgumentException(sprintf("The `%s` method is not supported.", strtoupper($method)));
        }
    }

    public function getResponseHttpCode(): ?int
    {
        if ($this->response === null) {
            return null;
        }
        return $this->response->getStatusCode();
    }

    public function getResponse(): ?Response
    {
        return $this->response;
    }

    public function getResponseAsString(): ?string
    {
        if ($this->response === null) {
            return null;
        }
        return (string) $this->response->getBody();
    }

    public function getResponseAsDecodedJson(): mixed
    {
        $rawResponse = $this->getResponseAsString();
        if ($rawResponse === null) {
            return null;
        }

        try {
            return json_decode($rawResponse, true);
        } catch (\JsonException) {
            return null;
        }
    }

    public function getResponseAsArray(): ?array
    {
        $response = $this->getResponseAsDecodedJson();

        return is_array($response) ? $response : null;
    }

    public function getResponseAsDotArray(): ?DotArray
    {
        return new DotArray($this->getResponseAsArray());
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    private function request(
        string $method,
        UriInterface|string $uri,
        array|null $data = null,
        array|UploadedFileInterface|null $files = null,
        array|callable|null $params = null,
    ): Body {
        // - Reset des valeurs précédentes éventuelles.
        $this->request = null;
        $this->response = null;

        // - On réinitialise l'utilisateur avant la requête.
        if (Auth::user() !== null) {
            Auth::reset();
        }

        $ip = is_array($params) && array_key_exists('ip', $params)
            ? $params['ip']
            : '0.0.0.0';

        // - Request
        $method = strtoupper($method);
        $request = new Request(
            (new ServerRequestFactory())
                ->createServerRequest($method, $uri, [
                    'REMOTE_ADDR' => $ip,
                ])
                ->withHeader('user-agent', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36')
                ->withHeader('accept-language', 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7'),
        );
        if (in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
            if (!empty($data)) {
                $request = $request->withParsedBody($data);
                $request = $request->withHeader('Content-Type', 'application/json');
            }
            if ($files !== null) {
                $files = !is_array($files) ? [$files] : $files;
                $request = $request->withUploadedFiles($files);
            }
        }
        if (!empty($params)) {
            $headers = is_callable($params)
                ? $params($request)
                : $params;

            if (!is_array($headers)) {
                throw new \LogicException(
                    'Headers callable should return an ' .
                    'array or a `Request` instance.',
                );
            }

            $headers = Arr::except($headers, ['ip']);
            foreach ($headers as $name => $value) {
                $request = $request->withHeader($name, $value);
            }
        }
        $this->request = $request;

        // - Response
        $this->response = $this->app->handle($this->request);
        return $this->response->getBody();
    }
}
