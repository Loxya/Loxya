<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use DI\Container;
use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Controllers\Traits\Crud;
use Loxya\Http\Request;
use Loxya\Models\BillingCompany;
use Loxya\Services\I18n;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpNotFoundException;
use Slim\Http\Response;

final class BillingCompanyController extends BaseController
{
    use Crud\Create;
    use Crud\Update;
    use Crud\SoftDelete;

    private I18n $i18n;

    public function __construct(Container $container, I18n $i18n)
    {
        parent::__construct($container);

        $this->i18n = $i18n;
    }

    // ------------------------------------------------------
    // -
    // -    Actions
    // -
    // ------------------------------------------------------

    public function getAll(Request $request, Response $response): ResponseInterface
    {
        $companies = BillingCompany::orderBy('id', 'asc')->get();
        return $response->withJson($companies, StatusCode::STATUS_OK);
    }

    public function getLogo(Request $request, Response $response): ResponseInterface
    {
        $id = $request->getIntegerAttribute('id');
        $company = BillingCompany::findOrFail($id);

        $picturePath = $company->getLogoRealPathAttribute();
        if (!$picturePath) {
            throw new HttpNotFoundException($request, "The company has no logo.");
        }

        if (!file_exists($picturePath)) {
            throw new HttpNotFoundException($request);
        }

        return $response
            ->withStatus(StatusCode::STATUS_OK)
            ->withFile($picturePath);
    }
}
