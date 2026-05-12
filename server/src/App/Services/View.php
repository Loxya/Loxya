<?php
declare(strict_types=1);

namespace Loxya\Services;

use Brick\Math\BigDecimal as Decimal;
use League\MimeTypeDetection\FinfoMimeTypeDetector;
use libphonenumber\NumberParseException;
use libphonenumber\PhoneNumberFormat;
use libphonenumber\PhoneNumberUtil;
use Loxya\Config\Config;
use Loxya\Config\Enums\Feature;
use Loxya\Services\View\Loader;
use Loxya\Support\Assert;
use Loxya\Support\Country;
use Loxya\Support\Period;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ResponseInterface;
use ScssPhp\ScssPhp\Compiler as ScssCompiler;
use ScssPhp\ScssPhp\OutputStyle as ScssOutputStyle;
use ScssPhp\ScssPhp\ValueConverter as ScssValueConverter;
use Slim\Views\Twig;
use Symfony\Component\Filesystem\Path;
use Twig\Environment;
use Twig\Extension\DebugExtension;
use Twig\Extra\Html\HtmlExtension;
use Twig\Extra\Intl\IntlExtension;
use Twig\Extra\String\StringExtension;
use Twig\TwigFilter;
use Twig\TwigFunction;

final class View
{
    private Twig $view;
    private I18n $i18n;

    private readonly ?string $folder;
    private readonly array $globalVars;

    /**
     * Constructeur.
     *
     * @param I18n $i18n - L'instance d'I18n qui sera utilisée pour définir la langue de la vue.
     * @param string|null $folder - Un éventuel dossier dans lequel sera recherché les fichiers de vue.
     *                              Si un chemin absolu est fourni, celui-ci sera utilisé comme racine
     *                              pour la résolution des fichiers de vue (à la place de `VIEWS_FOLDER`).
     *                              Sinon, il doit s'agir d'un sous-dossier de `VIEWS_FOLDER`.
     *                              Le fait de passer ce paramètre activera aussi la détection des
     *                              fichiers de vue par langue.
     * @param array $globalVars - Permet de passer des variables globales à tous les rendus.
     */
    public function __construct(I18n $i18n, ?string $folder = null, ?array $globalVars = [])
    {
        $cachePath = false;
        if (Config::getEnv() === 'production') {
            $cachePath = CACHE_FOLDER . DS . 'views';
        }

        $isAbsoluteFolder = $folder !== null && Path::isAbsolute($folder);
        $rootFolder = $isAbsoluteFolder ? $folder : VIEWS_FOLDER;

        $this->i18n = $i18n;
        $this->globalVars = $globalVars;
        $this->folder = (
            $folder !== null && !$isAbsoluteFolder
                ? trim($folder, '\\/')
                : null
        );
        $this->view = new Twig(new Loader($rootFolder), [
            'debug' => Config::getEnv() !== 'production',
            'cache' => $cachePath,
        ]);

        //
        // - Global variables
        //

        $this->view->getEnvironment()->addGlobal('env', Config::getEnv());
        $this->view->getEnvironment()->addGlobal('locale', $i18n->getLocale());
        $this->view->getEnvironment()->addGlobal('lang', $i18n->getLanguage());

        foreach ($this->globalVars as $key => $value) {
            $this->view->getEnvironment()->addGlobal($key, $value);
        }

        // - Organisation.
        $organization = Config::get('organization');
        $organization = array_replace($organization, [
            'address' => Config::getOrganizationAddress(),
            'country' => Config::getOrganizationCountry(),
        ]);
        $this->view->getEnvironment()->addGlobal('organization', $organization);

        // - Unités de mesure.
        $measurementUnits = Config::get('measurementUnits');
        $this->view->getEnvironment()->addGlobal('measurementUnits', [
            'materials' => [
                'weight' => $measurementUnits['materials']['weight']->value,
            ],
        ]);

        //
        // - Extensions
        //

        $this->view->addExtension(new HtmlExtension());
        $this->view->addExtension(new IntlExtension());
        $this->view->addExtension(new StringExtension());
        $this->view->addExtension(new DebugExtension());

        //
        // - Functions
        //

        $this->view->getEnvironment()->addFunction(
            new TwigFunction('__', [$i18n, 'translate']),
        );
        $this->view->getEnvironment()->addFunction(
            new TwigFunction('__n', [$i18n, 'plural']),
        );
        $this->view->getEnvironment()->addFunction(
            new TwigFunction('version', $this->getVersion()),
        );
        $this->view->getEnvironment()->addFunction(
            new TwigFunction('isFeatureEnabled', $this->isFeatureEnabled()),
        );
        $this->view->getEnvironment()->addFunction(
            new TwigFunction('asset', $this->getAsset()),
        );
        $this->view->getEnvironment()->addFunction(
            new TwigFunction('client_asset', $this->getClientAsset()),
        );
        $this->view->getEnvironment()->addFunction(
            new TwigFunction('source', $this->getSource(), [
                'needs_environment' => true,
                'is_safe' => ['all'],
            ]),
        );

        //
        // - Filters
        //

        $this->view->getEnvironment()->addFilter(
            new TwigFilter('image64', $this->createBase64Image()),
        );
        $this->view->getEnvironment()->addFilter(
            new TwigFilter('ucfirst', $this->ucfirstFilter()),
        );
        $this->view->getEnvironment()->addFilter(
            new TwigFilter('format_currency', $this->formatCurrencyFilter()),
        );
        $this->view->getEnvironment()->addFilter(
            new TwigFilter('format_phone', $this->formatPhoneFilter()),
        );
        $this->view->getEnvironment()->addFilter(
            new TwigFilter('format_number', $this->formatNumberFilter()),
        );
        $this->view->getEnvironment()->addFilter(
            new TwigFilter('format_*_number', $this->formatNumberStyleFilter()),
        );
        $this->view->getEnvironment()->addFilter(
            new TwigFilter('format_period', $this->formatPeriodFilter(), [
                'needs_environment' => true,
            ]),
        );
        $this->view->getEnvironment()->addFilter(
            new TwigFilter('format_period_*', $this->formatPeriodPartFilter(), [
                'needs_environment' => true,
            ]),
        );
        $this->view->getEnvironment()->addFilter(
            new TwigFilter('format_iban', $this->formatIbanFilter()),
        );
        $this->view->getEnvironment()->addFilter(
            new TwigFilter('scss', $this->compileScssFilter(), [
                'is_safe' => ['all'],
            ]),
        );
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes publiques
    // -
    // ------------------------------------------------------

    /**
     * Permet de récupérer de récupérer le rendu d'une vue.
     *
     * @param string $template - Le fichier de vue à rendre.
     * @param array $data - Un tableau de données à passer à la vue.
     *
     * @return string - Le contenu de la vue rendue.
     */
    public function fetch(string $template, array $data = []): string
    {
        $template = $this->resolveTemplatePath($template);
        return $this->view->fetch($template, $data);
    }

    /**
     * Permet de rendre une vue et d'assigner son contenu à la réponse fournie.
     *
     * @param Response $response - La réponse dans laquelle on veut voir le rendu ajouté.
     * @param string $template - Le fichier de vue à rendre.
     * @param array $data - Un tableau de données à passer à la vue.
     *
     * @return Response - La réponse passée en paramètres mais avec le rendu de la vue ajouté à son contenu.
     */
    public function render(Response $response, string $template, array $data = []): ResponseInterface
    {
        $response->getBody()->write($this->fetch($template, $data));
        return $response;
    }

    // ------------------------------------------------------
    // -
    // -    Fonctions Twig
    // -
    // ------------------------------------------------------

    private function resolveTemplatePath(string $template): string
    {
        $template = ltrim($template, '\\/');
        $template = !str_ends_with($template, '.twig')
            ? sprintf('%s.twig', $template)
            : $template;

        if ($this->folder === null) {
            return $template;
        }

        $loader = $this->view->getLoader();
        foreach ([$this->i18n->getLocale(), $this->i18n->getLanguage()] as $langFolder) {
            $templateLocalizedPath = $this->folder . DS . $langFolder . DS . $template;
            if ($loader->exists($templateLocalizedPath)) {
                return $templateLocalizedPath;
            }
        }

        return $this->folder . DS . $template;
    }

    private function getVersion(): callable
    {
        return static fn (): string => Config::getVersion();
    }

    private function isFeatureEnabled(): callable
    {
        return static fn (Feature $feature): bool => (
            isFeatureEnabled($feature)
        );
    }

    private function createBase64Image(): callable
    {
        return static function (string $path) {
            $fullPath = sprintf('%s/%s', rtrim(PUBLIC_FOLDER, '/'), ltrim($path, '/'));

            $file = new \SplFileObject($fullPath);
            $file->rewind();

            $data = '';
            while (!$file->eof()) {
                $data .= $file->fgets();
            }

            $mimeType = (new FinfoMimeTypeDetector())->detectMimeTypeFromPath($fullPath);
            if ($mimeType === null) {
                throw new \RuntimeException("Unable to detect the file's mime type.");
            }

            return explode('/', $mimeType, 2)[0] === 'text'
                ? sprintf('data:%s,%s', $mimeType, rawurlencode($data))
                : sprintf('data:%s;base64,%s', $mimeType, base64_encode($data));
        };
    }

    private function getClientAsset(): callable
    {
        return fn ($path) => $this->getAsset()(
            sprintf('/webclient/%s', ltrim($path, '/')),
        );
    }

    private function getAsset(): callable
    {
        $baseUri = Config::getBaseUri();

        return static fn (string $path, bool $full = false) => (
            vsprintf('%s/%s%s', [
                rtrim($full === true ? (string) $baseUri : $baseUri->getPath(), '/'),
                ltrim($path, '/'),
                Config::getEnv() !== 'test'
                    ? sprintf('?v=%s', Config::getVersion())
                    : '',
            ])
        );
    }

    private function getSource(): callable
    {
        $isProduction = Config::getEnv() === 'production';

        return function (Environment $env, string $name, bool $ignoreMissing = false) use ($isProduction): string {
            $loader = $env->getLoader();
            try {
                $source = $loader->getSourceContext($name);
            } catch (\Twig\Error\LoaderError $e) {
                if ($ignoreMissing) {
                    return '';
                }
                throw $e;
            }

            $sourcePath = $source->getPath();
            $content = $source->getCode();

            // - Pour les fichiers non-SCSS, on retourne le contenu tel quel.
            if (!str_ends_with($sourcePath, '.scss')) {
                return $content;
            }

            $cacheDir = CACHE_FOLDER . DS . 'scss';
            $cacheFile = $cacheDir . DS . md5($sourcePath) . '.css';

            $needsCompilation = (
                !$isProduction ||
                !is_file($cacheFile) ||
                filemtime($sourcePath) > filemtime($cacheFile)
            );
            if ($needsCompilation) {
                $css = $this->createScssCompiler(dirname($sourcePath))
                    ->compileString($content, $sourcePath)
                    ->getCss();

                if ($isProduction) {
                    if (!is_dir($cacheDir)) {
                        mkdir($cacheDir, 0775, true);
                    }
                    file_put_contents($cacheFile, $css);
                }

                return $css;
            }

            return file_get_contents($cacheFile);
        };
    }

    private function createScssCompiler(?string $sourceDir = null): ScssCompiler
    {
        $compiler = new ScssCompiler();
        $compiler->setOutputStyle(ScssOutputStyle::EXPANDED);
        $compiler->replaceVariables(array_map(
            static fn ($value) => ScssValueConverter::fromPhp($value),
            $this->globalVars,
        ));

        if ($sourceDir !== null) {
            $compiler->setImportPaths([$sourceDir]);
        }

        return $compiler;
    }

    private function compileScssFilter(): callable
    {
        $isProduction = Config::getEnv() === 'production';

        return function (string $content) use ($isProduction): string {
            $compile = fn (): string => (
                $this->createScssCompiler()
                    ->compileString($content)
                    ->getCss()
            );
            if (!$isProduction) {
                return $compile();
            }

            /** @var Cache $cache */
            $cache = container('cache');
            $cacheKey = sprintf('scss.inline.%s', md5($content));
            return $cache->get($cacheKey, $compile);
        };
    }

    // ------------------------------------------------------
    // -
    // -    Filtres Twig
    // -
    // ------------------------------------------------------

    private function ucfirstFilter(): callable
    {
        return static fn (string $string): string => (
            mb_strtoupper(mb_substr($string, 0, 1)) . mb_substr($string, 1)
        );
    }

    private function formatCurrencyFilter(): callable
    {
        return static function ($amount, ?string $currency = null, array $attrs = [], ?string $locale = null): string {
            $currency ??= Config::get('currency');
            $amount = $amount instanceof Decimal ? $amount->toFloat() : $amount;
            return (new IntlExtension())->formatCurrency($amount, $currency, $attrs, $locale);
        };
    }

    private function formatPhoneFilter(): callable
    {
        return static function (string $rawNumber, Country|string|null $country = null): string {
            if ($country !== null) {
                $country = !($country instanceof Country)
                    ? strtoupper($country)
                    : $country->getCode();
            }

            $phoneUtil = PhoneNumberUtil::getInstance();
            try {
                $phoneNumber = $phoneUtil->parse($rawNumber, $country);
                if (!$phoneUtil->isValidNumber($phoneNumber)) {
                    return $rawNumber;
                }
                $phoneCountryCode = $phoneNumber->getCountryCode();

                // - Code du pays déduit du numéro lui-même.
                if ($phoneCountryCode !== null) {
                    $inferredCountry = $phoneUtil->getRegionCodeForCountryCode($phoneCountryCode);
                    if ($inferredCountry !== PhoneNumberUtil::UNKNOWN_REGION) {
                        $country = $inferredCountry;
                    }
                }

                $mainCountry = Config::get('mainCountry');
                if ($country !== null && $mainCountry !== null) {
                    $format = $country !== $mainCountry
                        ? PhoneNumberFormat::INTERNATIONAL
                        : PhoneNumberFormat::NATIONAL;
                    return $phoneUtil->format($phoneNumber, $format);
                }

                $formattedNumber = $phoneUtil->format($phoneNumber, PhoneNumberFormat::NATIONAL);
                return $phoneCountryCode !== null
                    ? sprintf('(+%d) %s', $phoneCountryCode, $formattedNumber)
                    : $formattedNumber;
            } catch (NumberParseException) {
                return $rawNumber;
            }
        };
    }

    private function formatNumberFilter(): callable
    {
        // phpcs:ignore Generic.Files.LineLength.TooLong
        return static function ($number, array $attrs = [], string $style = 'decimal', string $type = 'default', ?string $locale = null): string {
            $number = $number instanceof Decimal ? $number->toFloat() : $number;
            return (new IntlExtension())->formatNumber($number, $attrs, $style, $type, $locale);
        };
    }

    private function formatNumberStyleFilter(): callable
    {
        // phpcs:ignore Generic.Files.LineLength.TooLong
        return static function (string $style, $number, array $attrs = [], string $type = 'default', ?string $locale = null): string {
            $number = $number instanceof Decimal ? $number->toFloat() : $number;
            return (new IntlExtension())->formatNumberStyle($style, $number, $attrs, $type, $locale);
        };
    }

    private function formatIbanFilter(): callable
    {
        return static function (string $iban): string {
            $iban = preg_replace('/\s+/', '', $iban);
            return implode(' ', str_split($iban, 4));
        };
    }

    private function formatPeriodFilter(): callable
    {
        return function (Environment $env, Period $period, string $format = 'short', ?string $locale = null): string {
            $formatDate = static function (
                \DateTimeInterface|null $date,
                bool $withTime,
                ?string $datePattern = null,
            ) use (
                $env,
                $format,
                $locale,
            ) {
                if ($date === null) {
                    return '?';
                }

                $intlExtension = new IntlExtension();
                $dateFormat = match ($format) {
                    'minimalist' => 'medium',
                    'sentence' => 'short',
                    default => $format,
                };

                $formattedDate = $intlExtension->formatDate(
                    $env,
                    $date,
                    $dateFormat,
                    $datePattern ?? (
                        $format === 'minimalist' ? 'd MMM' : ''
                    ),
                    null,
                    'gregorian',
                    $locale,
                );
                if (!$withTime) {
                    return $formattedDate;
                }

                $formattedTime = $intlExtension->formatTime(
                    $env,
                    $date,
                    'medium',
                    'HH:mm',
                    null,
                    'gregorian',
                    $locale,
                );

                return sprintf('%s - %s', $formattedDate, $formattedTime);
            };

            if ($period->isFullDays()) {
                $isOneDayPeriod = !$period->isInfinite() && $period->asDays() === 1;
                if ($isOneDayPeriod) {
                    $formattedDate = $formatDate($period->getStartDate(), false);
                    return match ($format) {
                        'minimalist' => $formattedDate,
                        'sentence' => $this->i18n->translate('date-in-sentence', [$formattedDate]),
                        default => $this->i18n->translate('on-date', [$formattedDate]),
                    };
                }

                $startDate = $period->getStartDate();
                $endDate = $period->getEndDate()?->subDay();

                // - Lorsque la date de début partage certaines composantes avec la date
                //   de fin, on utilise un pattern réduit pour éviter les répétitions.
                //   (e.g. "du 15 au 20 mai 2026" plutôt que "du 15 mai 2026 au 20 mai 2026").
                $customStartDatePattern = $endDate === null ? null : match (true) {
                    $startDate->isSameMonth($endDate) => match ($format) {
                        'minimalist', 'medium', 'long' => 'd',
                        'full' => 'EEEE d',
                        default => null,
                    },
                    $startDate->isSameYear($endDate) => match ($format) {
                        'minimalist', 'medium' => 'd MMM',
                        'long' => 'd MMMM',
                        'full' => 'EEEE d MMMM',
                        default => null,
                    },
                    default => null,
                };

                $formattedDates = [
                    $formatDate($startDate, false, $customStartDatePattern),
                    $formatDate($endDate, false),
                ];
            } else {
                $formattedDates = [
                    $formatDate($period->getStartDate(), true),
                    $formatDate($period->getEndDate(), true),
                ];
            }

            return match ($format) {
                'minimalist' => vsprintf('%s ⇒ %s', $formattedDates),
                'sentence' => !$period->isInfinite()
                    ? $this->i18n->translate('period-in-sentence', $formattedDates)
                    : $this->i18n->translate('period-in-sentence-no-end', $formattedDates),
                default => !$period->isInfinite()
                    ? $this->i18n->translate('from-date-to-date', $formattedDates)
                    : $this->i18n->translate('from-date-to-unknown', $formattedDates),
            };
        };
    }

    private function formatPeriodPartFilter(): callable
    {
        return static function (
            Environment $env,
            string $part,
            Period $period,
            string $format = 'short',
            ?string $locale = null,
        ): string {
            Assert::inArray($part, ['start', 'end'], 'Invalid period part.');
            Assert::true(
                $part !== 'end' || !$period->isInfinite(),
                'Unable to format the end part of an infinite period.',
            );

            $formatDate = static function (\DateTimeInterface $date, bool $withTime) use ($env, $format, $locale) {
                $intlExtension = new IntlExtension();

                $formattedDate = $intlExtension->formatDate($env, $date, $format, '', null, 'gregorian', $locale);
                if (!$withTime) {
                    return $formattedDate;
                }

                $formattedTime = $intlExtension->formatTime($env, $date, 'medium', 'HH:mm', null, 'gregorian', $locale);
                return sprintf('%s - %s', $formattedDate, $formattedTime);
            };

            if ($period->isFullDays()) {
                return $part === 'start'
                    ? $formatDate($period->getStartDate(), false)
                    : $formatDate($period->getEndDate()->subDay(), false);
            }

            return $part === 'start'
                ? $formatDate($period->getStartDate(), true)
                : $formatDate($period->getEndDate(), true);
        };
    }
}
