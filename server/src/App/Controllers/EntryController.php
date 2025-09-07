<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use DI\Container;
use Fig\Http\Message\StatusCodeInterface as StatusCode;
use Loxya\Config\Config;
use Loxya\Http\Request;
use Loxya\Models\Country;
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
        if (!Config::customConfigExists()) {
            return $response->withRedirect('/install', 302); // - 302 Redirect.
        }

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

        // - Uris
        $baseUri = Config::getBaseUri();
        $apiUri = $baseUri->withPath('/api');

        return [
            'baseUrl' => (string) $baseUri,
            'isSslEnabled' => Config::isSslEnabled(),
            'version' => Config::getVersion(),
            'api' => [
                'url' => (string) $apiUri,
                'headers' => $rawConfig['apiHeaders'],
            ],
            'features' => [
                'technicians' => $rawConfig['features']['technicians'],
            ],
            'auth' => [
                'cookie' => $rawConfig['auth']['cookie'],
                'timeout' => $rawConfig['sessionExpireHours'],
            ],
            'organization' => [
                'name' => $rawConfig['companyData']['name'],
                'country' => ($rawConfig['companyData']['country'] ?? null) !== null
                    ? Country::tryFromCode($rawConfig['companyData']['country'])
                    : null,
            ],
            'defaultPaginationLimit' => $rawConfig['maxItemsPerPage'],
            'maxConcurrentFetches' => $rawConfig['maxConcurrentFetches'],
            'maxFetchPeriod' => $rawConfig['maxFetchPeriod'],
            'defaultLang' => $rawConfig['defaultLang'],
            'currency' => $rawConfig['currency'],
            'returnPolicy' => $rawConfig['returnPolicy']->value,
            'billingMode' => $rawConfig['billingMode']->value,
            'maxFileUploadSize' => $rawConfig['maxFileUploadSize'],
            'authorizedFileTypes' => $rawConfig['authorizedFileTypes'],
            'authorizedImageTypes' => $rawConfig['authorizedImageTypes'],
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
