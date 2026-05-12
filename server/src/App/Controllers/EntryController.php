<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use DI\Container;
use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Config\Config;
use Loxya\Http\Request;
use Loxya\Models\Event;
use Loxya\Models\Material;
use Loxya\Services\Auth;
use Loxya\Services\I18n;
use Loxya\Services\View;
use Odan\Session\FlashInterface;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpNotFoundException;
use Slim\Http\Response;

final class EntryController extends BaseController
{
    private I18n $i18n;

    private View $view;

    private FlashInterface $flash;

    private Auth $auth;

    public function __construct(
        Container $container,
        I18n $i18n,
        View $view,
        FlashInterface $flash,
        Auth $auth,
    ) {
        parent::__construct($container);

        $this->view = $view;
        $this->flash = $flash;
        $this->i18n = $i18n;
        $this->auth = $auth;
    }

    public function default(Request $request, Response $response): ResponseInterface
    {
        return $this->view->render($response, 'entries/default.twig', [
            'serverConfig' => $this->getServerConfig(),
            'flashMessages' => $this->getFlashMessages(),
        ]);
    }

    public function healthcheck(Request $request, Response $response): ResponseInterface
    {
        $enabled = Config::get('healthcheck', false);
        if (!$enabled) {
            throw new HttpNotFoundException($request, "Health check not enabled.");
        }

        $lastUpdate = max([
            Material::orderBy('updated_at', 'DESC')->first()?->updated_at,
            Event::orderBy('updated_at', 'DESC')->first()?->updated_at,
        ]);

        return $response->withJson(['last_update' => $lastUpdate?->format('Y-m-d H:i:s')], StatusCode::STATUS_OK);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    private function getServerConfig(): array
    {
        $rawConfig = Config::get();

        return [
            'baseUrl' => Config::getBaseUrl(),
            'isSslEnabled' => Config::isSslEnabled(),
            'mainCountry' => $rawConfig['mainCountry'],
            'version' => Config::getVersion(),
            'features' => [
                'technicians' => $rawConfig['features']['technicians'],
            ],
            'auth' => [
                'cookie' => $rawConfig['auth']['cookie'],
                'timeout' => $rawConfig['sessionExpireHours'],
            ],
            'organization' => [
                'name' => $rawConfig['organization']['name'],
                'isVatExempted' => $rawConfig['organization']['isVatExempted'],
                'vatExemptionCode' => $rawConfig['organization']['vatExemptionCode'],
                'vatExemptionReason' => $rawConfig['organization']['vatExemptionReason'],
                'country' => $rawConfig['organization']['country'],
            ],
            'defaultPaginationLimit' => $rawConfig['maxItemsPerPage'],
            'maxConcurrentFetches' => $rawConfig['maxConcurrentFetches'],
            'maxFetchPeriod' => $rawConfig['maxFetchPeriod'],
            'defaultLang' => $rawConfig['defaultLang'],
            'currency' => $rawConfig['currency'],
            'returnPolicy' => $rawConfig['returnPolicy']->value,
            'billingMode' => $rawConfig['billingMode']->value,
            'estimates' => [
                'validityDays' => $rawConfig['estimates']['validityDays'],
            ],
            'invoices' => [
                'paymentTermDays' => $rawConfig['invoices']['paymentTermDays'],
            ],
            'maxFileUploadSize' => $rawConfig['maxFileUploadSize'],
            'allowedFileTypes' => Config::ALLOWED_FILE_TYPES,
            'allowedImageTypes' => Config::ALLOWED_IMAGE_TYPES,
            'measurementUnits' => [
                'materials' => [
                    'weight' => $rawConfig['measurementUnits']['materials']['weight']->value,
                ],
            ],
            'colorSwatches' => $rawConfig['colorSwatches'],
        ];
    }

    private function getFlashMessages(): array
    {
        $messages = [];
        $rawMessageTypes = $this->flash->all();
        foreach ($rawMessageTypes as $type => $rawMessages) {
            foreach ($rawMessages as $rawMessage) {
                $message = $this->i18n->translate(sprintf('flash.%s', $rawMessage));
                $messages[] = compact('type', 'message');
            }
        }
        return $messages;
    }
}
