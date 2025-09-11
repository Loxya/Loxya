<?php
declare(strict_types=1);

namespace Loxya\Services;

use Brick\Math\BigDecimal as Decimal;
use League\MimeTypeDetection\FinfoMimeTypeDetector;
use Loxya\Config\Config;
use Loxya\Config\Enums\Feature;
use Loxya\Support\Assert;
use Loxya\Support\Period;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ResponseInterface;
use Slim\Views\Twig;
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

    private ?string $folder;

    /**
     * Constructeur.
     *
     * @param I18n $i18n - L'instance d'I18n qui sera utilisée pour définir la langue de la vue.
     * @param string|null $folder - Un éventuel dossier dans lequel sera recherché les fichiers de vue.
     *                              Le fait de passer ce paramètre activera aussi la détection des
     *                              fichiers de vue par langue.
     */
    public function __construct(I18n $i18n, ?string $folder = null)
    {
        $cachePath = false;
        if (Config::getEnv() === 'production') {
            $cachePath = CACHE_FOLDER . DS . 'views';
        }

        $this->i18n = $i18n;
        $this->folder = $folder ? trim($folder, '\\/') : null;
        $this->view = Twig::create(VIEWS_FOLDER, [
            'debug' => Config::getEnv() !== 'production',
            'cache' => $cachePath,
        ]);

        //
        // - Global variables
        //

        $this->view->getEnvironment()->addGlobal('env', Config::getEnv());
        $this->view->getEnvironment()->addGlobal('locale', $i18n->getLocale());
        $this->view->getEnvironment()->addGlobal('lang', $i18n->getLanguage());
        $this->view->getEnvironment()->addGlobal('organization', Config::get('companyData'));

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

    private function formatPeriodFilter(): callable
    {
        return function (Environment $env, Period $period, string $format = 'short', ?string $locale = null): string {
            $formatDate = static function (\DateTimeInterface|null $date, bool $withTime) use ($env, $format, $locale) {
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
                    $format === 'minimalist' ? 'd MMM' : '',
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

                $formattedDates = [
                    $formatDate($period->getStartDate(), false),
                    $formatDate($period->getEndDate()?->subDay(), false),
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
