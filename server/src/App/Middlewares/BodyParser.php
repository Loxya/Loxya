<?php
declare(strict_types=1);

namespace Loxya\Middlewares;

use Adbar\Dot as DotArray;
use Loxya\Support\File\UploadedFile;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Middleware\BodyParsingMiddleware as BodyParsingMiddlewareCore;

final class BodyParser extends BodyParsingMiddlewareCore
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $parsedBody = $request->getParsedBody();
        if ($parsedBody === null || empty($parsedBody)) {
            $parsedBody = $this->parseBody($request);
            $request = $request->withParsedBody($parsedBody);
        }

        $mediaType = $this->getMediaType($request);
        if ($mediaType === 'multipart/form-data') {
            // - Ajout le parsing aussi pour les méthodes PUT, PATCH, DELETE.
            $parsedRequest = static::parseRequest($request);
            $request = $request->withParsedBody($parsedRequest['params']);
            $request = $request->withUploadedFiles(
                static::normalizeUploadedFiles($parsedRequest['files']),
            );

            // - Gestion des envois hybrides avec données sous forme de JSON et fichiers uploadés.
            $parsedBody = $request->getParsedBody();
            if (is_array($parsedBody) && array_key_exists('@data', $parsedBody)) {
                $data = json_decode($parsedBody['@data'], true);
                $data = new DotArray(is_array($data) ? $data : []);
                unset($parsedBody['@data']);

                $rawUploadedFiles = $request->getUploadedFiles();
                if (!empty($rawUploadedFiles)) {
                    $uploadedFiles = new DotArray();
                    foreach ($rawUploadedFiles as $name => $file) {
                        $name = base64_decode($name);
                        if ($name === false) {
                            continue;
                        }

                        // @see https://regex101.com/r/eUq52B/1
                        $name = preg_replace('/\[([0-9]+)\]/', '.$1', $name);

                        $data->add($name, $file);
                        $uploadedFiles->add($name, $file);
                    }
                    $request = $request->withUploadedFiles($uploadedFiles->all());
                }

                $parsedBody = array_replace($data->all(), $parsedBody);
                $request = $request->withParsedBody($parsedBody);
            }
        }

        return $handler->handle($request);
    }

    private static function normalizeUploadedFiles(array $files): array
    {
        $normalized = [];
        foreach ($files as $key => $value) {
            if (!is_array($value)) {
                continue;
            }

            $normalized[$key] = !array_key_exists('tmp_name', $value)
                ? static::normalizeUploadedFiles($value)
                : new UploadedFile(
                    $value['tmp_name'],
                    (int) $value['size'],
                    (int) $value['error'],
                    $value['name'],
                    $value['type'],
                );
        }
        return $normalized;
    }

    public static function parseRequest(ServerRequestInterface $request): array
    {
        $data = array_fill_keys(['params', 'files'], []);
        $method = $request->getMethod();

        if ($method === 'GET') {
            return $data;
        }

        if ($method === 'POST') {
            $data['files'] = $_FILES;
            $data['params'] = $_POST;
            return $data;
        }

        // - Get raw input data.
        $contentType = $request->getHeader('Content-Type')[0] ?? null;
        if (!preg_match('/boundary=(.*)$/is', $contentType, $matches)) {
            return $data;
        }

        $rawRequestData = file_get_contents('php://input');
        $bodyParts = preg_split('/\\R?-+' . preg_quote($matches[1], '/') . '/s', $rawRequestData);
        array_pop($bodyParts);

        foreach ($bodyParts as $bodyPart) {
            if (empty($bodyPart)) {
                continue;
            }
            [$headers, $value] = preg_split('/\\R\\R/', $bodyPart, 2);
            $headers = static::parseHeaders($headers);
            if (!isset($headers['content-disposition']['name'])) {
                continue;
            }
            if (isset($headers['content-disposition']['filename'])) {
                $file = [
                    'name' => $headers['content-disposition']['filename'],
                    'type' => $headers['content-type'] ?? 'application/octet-stream',
                    'size' => mb_strlen($value, '8bit'),
                    'error' => UPLOAD_ERR_OK,
                    'tmp_name' => null,
                ];

                if ($file['size'] > self::toBytes(ini_get('upload_max_filesize'))) {
                    $file['error'] = UPLOAD_ERR_INI_SIZE;
                } else {
                    $tmpResource = tmpfile();
                    if ($tmpResource === false) {
                        $file['error'] = UPLOAD_ERR_CANT_WRITE;
                    } else {
                        $tmpResourceMetaData = stream_get_meta_data($tmpResource);
                        $tmpFileName = $tmpResourceMetaData['uri'];
                        if (empty($tmpFileName)) {
                            $file['error'] = UPLOAD_ERR_CANT_WRITE;
                            @fclose($tmpResource);
                        } else {
                            fwrite($tmpResource, $value);
                            $file['tmp_name'] = $tmpFileName;
                            $file['tmp_resource'] = $tmpResource;
                        }
                    }
                }
                $file['size'] = self::toFormattedBytes($file['size']);

                $_FILES[$headers['content-disposition']['name']] = $file;
                $data['files'][$headers['content-disposition']['name']] = $file;
            } else {
                $data['params'][$headers['content-disposition']['name']] = $value;
            }
        }

        return $data;
    }

    private static function parseHeaders(string $headerContent): array
    {
        $headers = [];
        $headerParts = preg_split('/\\R/s', $headerContent, -1, PREG_SPLIT_NO_EMPTY);
        foreach ($headerParts as $headerPart) {
            if (!str_contains($headerPart, ':')) {
                continue;
            }
            [$headerName, $headerValue] = explode(':', $headerPart, 2);
            $headerName = strtolower(trim($headerName));
            $headerValue = trim($headerValue);
            if (!str_contains($headerValue, ';')) {
                $headers[$headerName] = $headerValue;
            } else {
                $headers[$headerName] = [];
                foreach (explode(';', $headerValue) as $part) {
                    $part = trim($part);
                    if (!str_contains($part, '=')) {
                        $headers[$headerName][] = $part;
                    } else {
                        [$name, $value] = explode('=', $part, 2);
                        $name = strtolower(trim($name));
                        $value = trim(trim($value), '"');
                        $headers[$headerName][$name] = $value;
                    }
                }
            }
        }
        return $headers;
    }

    private static function toFormattedBytes(int $bytes): string
    {
        $precision = 2;
        $base = log($bytes, 1024);
        $suffixes = ['', 'K', 'M', 'G', 'T'];

        return round(1024 ** ($base - floor($base)), $precision) . $suffixes[floor($base)];
    }

    private static function toBytes(string $formattedBytes): ?int
    {
        $units = ['B', 'K', 'M', 'G', 'T', 'P'];
        $unitsExtended = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

        $number = (int) preg_replace("/[^0-9]+/", "", $formattedBytes);
        $suffix = preg_replace("/[^a-zA-Z]+/", "", $formattedBytes);

        //B or no suffix
        if (is_numeric($suffix[0])) {
            return preg_replace('/[^\d]/', '', $formattedBytes);
        }

        $exponent = array_flip($units)[$suffix] ?? null;
        $exponent ??= array_flip($unitsExtended)[$suffix] ?? null;

        if ($exponent === null) {
            return null;
        }
        return $number * (1024 ** $exponent);
    }
}
