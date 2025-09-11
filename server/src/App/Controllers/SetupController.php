<?php
declare(strict_types=1);

namespace Loxya\Controllers;

use DI\Container;
use Loxya\Config\Config;
use Loxya\Errors\Exception\ValidationException;
use Loxya\Http\Request;
use Loxya\Models\Category;
use Loxya\Models\Enums\Group;
use Loxya\Models\User;
use Loxya\Services\I18n;
use Loxya\Services\View;
use Loxya\Support\Install;
use Loxya\Support\Str;
use Loxya\Support\Validation\Validator as V;
use Psr\Http\Message\ResponseInterface;
use Respect\Validation\Exceptions\NestedValidationException;
use Respect\Validation\Exceptions\ValidationException as RespectValidationException;
use Respect\Validation\Rules as Rule;
use Slim\Http\Response;

final class SetupController extends BaseController
{
    private View $view;

    private I18n $i18n;

    public function __construct(Container $container, View $view, I18n $i18n)
    {
        parent::__construct($container);

        $this->view = $view;
        $this->i18n = $i18n;
    }

    public function index(Request $request, Response $response): ResponseInterface
    {
        $currentStep = Install::getStep();
        if ($currentStep === 'end') {
            return $response->withRedirect('/login');
        }

        $stepData = [];
        $error = false;
        $validationErrors = null;

        $lang = $this->i18n->getLanguage();
        $allCurrencies = Install::getAllCurrencies();
        $allCountries = Install::getAllCountries();

        if ($request->isGet()) {
            if ($currentStep === 'welcome') {
                return $this->view->render(
                    $response,
                    'install.twig',
                    $this->_getCheckRequirementsData() + ['lang' => $lang],
                );
            }

            if ($currentStep === 'settings') {
                $currentCurrency = is_array(Config::get('currency'))
                    // - Rétro-compatibilité.
                    ? Config::get('currency.iso')
                    : Config::get('currency');

                $stepData = [
                    'currency' => $currentCurrency ?? 'EUR',
                ];
            }

            if ($currentStep === 'company') {
                $stepData = Config::get('companyData');

                // - Rétrocompatibilité.
                $isLegacyCountry = (
                    !empty($stepData['country']) &&
                    (
                        strlen($stepData['country']) !== 2 ||
                        strtoupper($stepData['country']) !== $stepData['country']
                    )
                );
                if ($isLegacyCountry) {
                    $normalizedCountry = Str::of($stepData['country'])
                        ->transliterate(null)
                        ->lower();

                    $stepData['country'] = null;
                    foreach ($allCountries as $country) {
                        $_normalizedCountry = Str::of($country['name'])
                            ->transliterate(null)
                            ->lower();

                        if ($normalizedCountry->exactly($_normalizedCountry)) {
                            $stepData['country'] = $country['code'];
                            break;
                        }
                    }
                }
            }
        }

        if ($request->isPost()) {
            $installData = $request->getParsedBody();

            $stepSkipped = (
                array_key_exists('skipped', $installData)
                && $installData['skipped'] === 'yes'
            );
            if ($stepSkipped) {
                $installData['skipped'] = true;
            }

            if ($currentStep === 'settings') {
                // - Pré-remplissage de la config de l'envoi des e-mails, vu qu'elle
                //   est absente du wizard d'installation.
                $installData['email'] = Config::getDefault('email');
            }

            if ($currentStep === 'company') {
                $installData['logo'] = null;
                ksort($installData);
            }

            try {
                if ($currentStep === 'company') {
                    $this->_validateCompanyData($installData);
                }
                Install::setInstallProgress($currentStep, $installData);

                if ($currentStep === 'database') {
                    $settings = Install::getSettingsFromInstallData();
                    Config::saveCustomConfig($settings);
                    Config::getPDO(); // - Try to connect to DB
                }

                if ($currentStep === 'dbStructure') {
                    Install::migrateDatabase();
                }

                if ($currentStep === 'adminUser') {
                    if ($stepSkipped && !User::where('group', Group::ADMINISTRATION)->exists()) {
                        throw new \InvalidArgumentException(
                            "At least one user must exist. Please create an administrator.",
                        );
                    }

                    if (!$stepSkipped) {
                        $installData['user']['group'] = Group::ADMINISTRATION;
                        User::new($installData['user']);
                    }
                }

                if ($currentStep === 'categories') {
                    $categories = explode(',', $installData['categories']);
                    Category::bulkAdd(array_unique($categories));
                }

                return $response->withRedirect('/install');
            } catch (\Throwable $e) {
                Install::setInstallProgress($currentStep);

                $stepData = $installData;
                $error = $e->getMessage();
                if ($e instanceof ValidationException) {
                    $error = "validationErrors";
                    $validationErrors = $e->getValidationErrors();
                }

                if ($currentStep === 'database') {
                    Config::deleteCustomConfig();
                }
            }
        }

        if ($currentStep === 'coreSettings' && empty($stepData['JWTSecret'])) {
            $stepData['JWTSecret'] = md5(uniqid('Loxya', true));
        }

        if ($currentStep === 'company') {
            $stepData['countries'] = $allCountries;
        }

        if ($currentStep === 'settings') {
            $stepData['currencies'] = $allCurrencies;
        }

        if ($currentStep === 'dbStructure') {
            try {
                $stepData = [
                    'migrationStatus' => Install::getMigrationsStatus(),
                    'canProcess' => true,
                ];
            } catch (\Throwable $e) {
                $stepData = [
                    'migrationStatus' => [],
                    'errorCode' => $e->getCode(),
                    'error' => $e->getMessage(),
                    'canProcess' => false,
                ];
            }
        }

        if ($currentStep === 'adminUser') {
            $stepData['existingAdmins'] = User::where('group', Group::ADMINISTRATION)->get()->toArray();
        }

        // - Données de configuration existantes.
        $config = array_replace(Config::get(), [
            'baseUrl' => Config::getBaseUrl(),
        ]);

        return $this->view->render($response, 'install.twig', [
            'lang' => $lang,
            'step' => $currentStep,
            'stepNumber' => array_search($currentStep, Install::INSTALL_STEPS, true),
            'error' => $error,
            'validationErrors' => $validationErrors,
            'stepData' => $stepData,
            'config' => $config,
        ]);
    }

    public function endInstall(Request $request, Response $response): ResponseInterface
    {
        $steps = Install::INSTALL_STEPS;

        $endStep = end($steps);
        $prevStep = prev($steps);

        Install::setInstallProgress($prevStep, ['skipped' => true]);
        Install::setInstallProgress($endStep, []);

        return $response->withRedirect('/login');
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes
    // -
    // ------------------------------------------------------

    private function _getCheckRequirementsData(): array
    {
        $phpVersion = PHP_VERSION;
        if (str_contains(PHP_VERSION, '+')) {
            $phpVersion = substr(PHP_VERSION, 0, strpos(PHP_VERSION, '+'));
        }

        $phpVersionMin = Install::MIN_PHP_VERSION;
        $phpVersionMax = Install::MAX_PHP_VERSION;
        $neededExtensions = Install::REQUIRED_EXTENSIONS;

        $loadedExtensions = get_loaded_extensions();
        $phpversionIsAboveMin = version_compare(PHP_VERSION, $phpVersionMin, '>=');
        $phpversionIsAboveMax = version_compare(
            // - Réduit la version de PHP courante à la même précision que la contrainte max.
            //   (e.g. Version de PHP : `8.3.4` / Contrainte : `8.4` => `8.3`)
            implode('.', array_slice(
                explode('.', $phpVersion),
                0,
                count(explode('.', $phpVersionMax)),
            )),
            $phpVersionMax,
            '>',
        );

        $missingExtensions = array_diff($neededExtensions, $loadedExtensions);

        return [
            'step' => 'welcome',
            'phpVersion' => $phpVersion,
            'phpVersionMin' => $phpVersionMin,
            'phpVersionMax' => $phpVersionMax,
            'phpversionIsAboveMin' => $phpversionIsAboveMin,
            'phpversionIsAboveMax' => $phpversionIsAboveMax,
            'missingExtensions' => $missingExtensions,
        ];
    }

    private function _validateCompanyData($companyData): void
    {
        $schema = new Rule\KeySet(
            new Rule\Key('name', V::notEmpty()->stringType()),
            new Rule\Key('street', V::notEmpty()->stringType()),
            new Rule\Key('zipCode', V::notEmpty()->stringType()),
            new Rule\Key('locality', V::notEmpty()->stringType()),
            new Rule\Key('country', V::custom(
                static function ($value) {
                    V::notEmpty()->stringType()->check($value);
                    $allCountries = array_column(Install::getAllCountries(), 'code');
                    return in_array($value, $allCountries, true);
                },
            )),
        );

        try {
            $schema->assert($companyData);
        } catch (NestedValidationException $e) {
            $errors = array_reduce(
                iterator_to_array($e),
                static function (array $errors, RespectValidationException $exception) {
                    $errors[$exception->getParam('name')] = $exception->getMessage();
                    return $errors;
                },
                [],
            );
        }

        if (empty($errors)) {
            return;
        }

        throw new ValidationException($errors);
    }
}
