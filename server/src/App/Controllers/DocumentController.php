<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Http\Request;
use Loxya\Models\Document;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpNotFoundException;
use Slim\Http\Response;
use Slim\Psr7\Stream;

final class DocumentController extends BaseController
{
    public function getFile(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $document = Document::findOrFail($id);

        $fileName = $document->name;
        $fileContent = file_get_contents($document->path);
        if ($fileContent === false) {
            throw new HttpNotFoundException($request, "The file of the document cannot be found.");
        }

        try {
            $streamHandle = fopen('php://memory', 'r+');
            fwrite($streamHandle, $fileContent);
            rewind($streamHandle);
            $fileStream = new Stream($streamHandle);

            return $response
                ->withHeader('Content-Type', $document->type)
                ->withHeader('Content-Description', 'File Transfer')
                ->withHeader('Content-Transfer-Encoding', 'binary')
                ->withHeader('Content-Disposition', sprintf('attachment; filename="%s"', $fileName))
                ->withHeader('Expires', '0')
                ->withHeader('Cache-Control', 'must-revalidate, post-check=0, pre-check=0')
                ->withHeader('Pragma', 'public')
                ->withHeader('Content-Length', $fileStream->getSize())
                ->withStatus(StatusCode::STATUS_OK)
                ->withBody($fileStream);
        } catch (\Throwable $e) {
            throw new \RuntimeException(sprintf(
                "Cannot send the file \"%s\". Details: %s",
                $fileName,
                $e->getMessage(),
            ));
        }
    }

    public function delete(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $document = Document::findOrFail($id);

        if (!$document->delete()) {
            throw new \RuntimeException("An unknown error occurred while deleting the document.");
        }

        return $response->withStatus(StatusCode::STATUS_NO_CONTENT);
    }
}
