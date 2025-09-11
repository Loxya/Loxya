<?php
declare(strict_types=1);

namespace Loxya;

use DI\Container;
use Loxya\Config\Config;
use Loxya\Errors\ErrorHandler;
use Loxya\Http\Request;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use RKA\Middleware\IpAddress as IpAddressMiddleware;
use Slim\App as CoreApp;
use Slim\Exception\HttpNotFoundException;
use Slim\Factory\AppFactory;
use Slim\Factory\ServerRequestCreatorFactory;
use Slim\Http\Response;
use Slim\Interfaces\RouteParserInterface;
use Slim\Routing\RouteCollectorProxy;

/**
 * App.
 *
 * @method self add(\Psr\Http\Server\MiddlewareInterface|string|callable $middleware)
 * @method Response handle(Request $request)
 */
final class App
{
    private Container $container;

    /** @var CoreApp<Container> */
    private CoreApp $app;

    public function __construct()
    {
        $this->container = Kernel::boot()->getContainer();
        $this->app = AppFactory::create(null, $this->container);

        // NOTE: Les middlewares sont appelés du dernier ajouté au premier.
        $this->configureMiddlewares();
        $this->configureRouter();
        $this->configureErrorHandlers();
        $this->configureCors();
    }

    public function run(): void
    {
        // - Crée la requête.
        ServerRequestCreatorFactory::setSlimHttpDecoratorsAutomaticDetection(false);
        $serverRequestCreator = ServerRequestCreatorFactory::create();
        $request = new Request($serverRequestCreator->createServerRequestFromGlobals());

        // - Lance l'application.
        $this->app->run($request);
    }

    public function __call($name, $arguments)
    {
        return \call_user_func_array([$this->app, $name], $arguments);
    }

    // ------------------------------------------------------
    // -
    // -    Internal Methods
    // -
    // ------------------------------------------------------

    protected function configureCors(): void
    {
        $isCORSEnabled = (bool) Config::get('enableCORS', false);
        if (Config::getEnv() === 'test' || !$isCORSEnabled) {
            return;
        }

        // phpcs:ignore SlevomatCodingStandard.Functions.StaticClosure.ClosureNotStatic
        $this->app->add(function (Request $request, RequestHandler $handler): ResponseInterface {
            /** @var \Slim\Http\Response $response */
            $response = $handler->handle($request);

            $response = $response->withHeader('Access-Control-Allow-Origin', '*');
            $response = $response->withHeader('Access-Control-Allow-Credentials', 'true');
            $response = $response->withHeader(
                'Access-Control-Allow-Headers',
                'X-Requested-With, Content-Type, Accept, Origin, Authorization',
            );

            return $response;
        });
    }

    protected function configureRouter(): void
    {
        $isCORSEnabled = (bool) Config::get('enableCORS', false) && Config::getEnv() !== 'test';
        $useRouterCache = (bool) Config::get('useRouterCache') && Config::getEnv() === 'production';
        $routeCollector = $this->app->getRouteCollector();

        $getActionFqn = static fn ($action) => sprintf('Loxya\\Controllers\\%s', $action);

        // - Ajoute le parseur de route au conteneur.
        $this->container->set(RouteParserInterface::class, $routeCollector->getRouteParser());

        // - Base Path
        $basePath = rtrim(Config::getBaseUri()->getPath(), '/');
        $routeCollector->setBasePath($basePath);

        // - Route cache
        if ($useRouterCache) {
            $routeCollector->setCacheFile(CACHE_FOLDER . DS . 'routes.php');
        }

        // - Middleware
        $this->app->addRoutingMiddleware();

        //
        // -- Routes: Api
        //

        /* phpcs:disable SlevomatCodingStandard.Functions.StaticClosure.ClosureNotStatic */
        $this->app->group('/api', function (RouteCollectorProxy $group) use ($isCORSEnabled, $getActionFqn) {
            // - Autorise les requêtes de type OPTIONS sur les routes d'API.
            if ($isCORSEnabled) {
                $group->options('/{routes:.+}', fn (Request $request, Response $response) => $response);
            }

            // - Toutes les routes d'API sont définies dans le fichier `Config/routes.php`.
            // @phpstan-ignore-next-line include.fileNotFound
            $routeMethods = include CONFIG_FOLDER . DS . 'routes.php';
            foreach ($routeMethods as $method => $routes) {
                foreach ($routes as $route => $action) {
                    $group->$method($route, $getActionFqn($action));
                }
            }

            // - Not found API
            $group
                ->any('/[{path:.*}]', function (Request $request) {
                    throw new HttpNotFoundException($request);
                })
                ->setName('api-catch-not-found');
        });

        //
        // -- Routes: "statics"
        //

        // - Health check
        $this->app->get('/healthcheck', $getActionFqn('EntryController:healthcheck'));

        // - Install
        $this->app->map(['GET', 'POST'], '/install', $getActionFqn('SetupController:index'));
        $this->app->get('/install/end', $getActionFqn('SetupController:endInstall'));

        // - "Raw" / Download files
        $this->app->get('/estimates/{id:[0-9]+}/pdf[/]', $getActionFqn('EstimateController:getOnePdf'));
        $this->app->get('/invoices/{id:[0-9]+}/pdf[/]', $getActionFqn('InvoiceController:getOnePdf'));
        $this->app->get('/events/{id:[0-9]+}/pdf[/]', $getActionFqn('EventController:getOnePdf'));
        $this->app->get('/documents/{id:[0-9]+}', $getActionFqn('DocumentController:getFile'));
        $this->app->get('/materials/print[/]', $getActionFqn('MaterialController:printAll'));

        // - Static files
        $this->app->get('/static/materials/{id:[0-9]+}/picture[/]', $getActionFqn('MaterialController:getPicture'));

        // - Public resources
        $this->app->get('/calendar/public/{uuid:[a-z0-9-]+}.ics', $getActionFqn('CalendarController:public'))
            ->setName('public-calendar');

        // - Login services
        $this->app->get('/logout', $getActionFqn('AuthController:logout'));

        // - Points d'entrée de l'application
        $this->app->get('/[{path:.*}]', $getActionFqn('EntryController:default'));
    }

    protected function configureMiddlewares(): void
    {
        // NOTE: Les middlewares sont appelés du dernier ajouté au premier.
        $this->app->add(Middlewares\Pagination::class);
        $this->app->add(Middlewares\Acl::class);
        $this->app->add([$this->container->get('auth'), 'middleware']);
        $this->app->add(new Middlewares\BodyParser());
        $this->app->add(new IpAddressMiddleware(false, null, 'ip'));
        $this->app->add(Middlewares\SessionStart::class);
    }

    protected function configureErrorHandlers(): void
    {
        $shouldLog = Config::getEnv() !== 'test';
        $displayErrorDetails = (
            (bool) Config::get('displayErrorDetails', false)
            || in_array(Config::getEnv(), ['production', 'test'], true)
        );

        $logger = $this->container->get('logger')->createLogger('error');
        $errorMiddleware = $this->app->addErrorMiddleware($displayErrorDetails, $shouldLog, $shouldLog, $logger);

        // - Default error handler.
        $defaultErrorHandler = new ErrorHandler(
            $this->app->getCallableResolver(),
            $this->app->getResponseFactory(),
            $logger,
        );
        $errorMiddleware->setDefaultErrorHandler($defaultErrorHandler);
    }
}
