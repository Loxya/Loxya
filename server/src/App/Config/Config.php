<?php
declare(strict_types=1);

namespace Loxya\Config;

use Loxya\Config\Enums\BillingMode;
use Loxya\Config\Enums\ReturnPolicy;
use Loxya\Config\Enums\WeightUnit;
use Loxya\Contracts\EnumFactory;
use Loxya\Support\Address;
use Loxya\Support\Arr;
use Loxya\Support\BaseUri;
use Loxya\Support\Country;
use Loxya\Support\Data\LegalType\LegalTypeFactory;
use Loxya\Support\Invoicing\VatExemptionCode\VatExemptionCodeFactory;
use Loxya\Support\Str;
use Monolog\Level as LogLevel;
use Psr\Http\Message\UriInterface;

final class Config
{
    private const FILE = CONFIG_FOLDER . DS . 'settings.json';

    /**
     * Configuration par défaut.
     *
     * Veuillez NE PAS modifier les valeurs dans ce fichier.
     * Utilisez le fichier `settings.json` pour surcharger les valeurs de certaines
     * des options ci-dessous, ou mieux encore, utilisez l'assistant d'installation.
     */
    private const DEFAULT_SETTINGS = [
        /**
         * L'URL de base de l'application.
         *
         * Si `null`, l'URL de base sera déduite, ce qui n'est absolument
         * pas sûr car cela ne prend pas en charge les installations dans
         * des sous-dossiers.
         */
        'baseUrl' => null,

        /** Pays d'utilisation principal. */
        'mainCountry' => null,

        /** Langue par défaut de l'application (`en` ou `fr`). */
        'defaultLang' => 'fr',

        /** Code ISO 4217 de la devise utilisée dans l'application. */
        'currency' => 'EUR',

        /**
         * Clé secrète utilisée pour la génération et la
         * vérification des tokens JWT.
         */
        'JWTSecret' => null,

        /**
         * Active ou désactive le endpoint `/healthcheck` permettant
         * de vérifier l'état de l'application.
         */
        'healthcheck' => false,

        /**
         * Active ou désactive le support de CORS (Cross-Origin Resource Sharing).
         * Permet d'autoriser les requêtes provenant de domaines externes.
         */
        'enableCORS' => false,

        /**
         * Durée d'une session utilisateur (en heures) avant qu'il doive
         * se reconnecter (hors fermeture du navigateur, qui nécessitera
         * une reconnexion à la prochaine visite).
         *
         * Attention : cette valeur ne doit pas être trop élevée, car elle détermine
         * la durée de validité des jetons de connexion. Une durée excessive rendrait
         * ces jetons valides trop longtemps, augmentant ainsi les risques de sécurité
         * en cas d'accès non autorisé à l'ordinateur de l'utilisateur.
         */
        'sessionExpireHours' => 12,

        /**
         * Nombre maximum d'éléments dans une page de la pagination.
         * (Exemple: Si la valeur est 100 et qu'il y a 120 résultats,
         * il y aura donc deux page, la première avec les 100 premiers
         * résultats et la deuxième avec les 20 restants)
         *
         * Attention, trop augmenter cette valeur impactera négativement
         * les temps de réponses de l'application.
         */
        'maxItemsPerPage' => 100,

        /**
         * Période maximale (en jours) pendant laquelle
         * les données peuvent être récupérées.
         */
        'maxFetchPeriod' => 3 * 30, // = 3 mois.

        /**
         * La taille maximale autorisée (en octets) pour
         * l'upload de fichiers.
         */
        'maxFileUploadSize' => 25 * 1024 * 1024, // = 25 Mo.

        /** La documentation d'API doit-elle être activée ? */
        'enableApiDocs' => true,

        /**
         * Nombre de requêtes simultanées maximum pour la
         * récupération du matériel manquant.
         */
        'maxConcurrentFetches' => 2,

        /** Politique de retour des événements et réservations. */
        'returnPolicy' => ReturnPolicy::AUTO,

        /** Mode de facturation de l'application. */
        'billingMode' => BillingMode::PARTIAL,

        //
        // - Configuration du proxy utilisé pour les connexions HTTP sortantes.
        //

        'proxy' => [
            /** Le proxy est-il activé ? */
            'enabled' => false,

            /** Nom d'hôte ou adresse du serveur proxy. */
            'host' => 'proxy.loxya.test',

            /** Port utilisé pour la connexion au proxy. */
            'port' => 3128,
        ],

        //
        // - Activation / Désactivation des fonctionnalités.
        //

        'features' => [
            /** Active, ou non, la gestion des techniciens. */
            'technicians' => true,
        ],

        //
        // - Configuration de l'authentification.
        //

        'auth' => [
            /** Nom du cookie utilisé pour l'authentification. */
            'cookie' => 'auth',
        ],

        //
        // - Configuration de connexion à la base de données.
        //

        'db' => [
            /** Nom d'hôte ou adresse du serveur de base de données. */
            'host' => 'localhost',

            /** Port utilisé pour la connexion au serveur de base de données. */
            'port' => 3306,

            /** Nom de la base de données à utiliser. */
            'database' => 'loxya',

            /** Nom d'utilisateur utilisé pour la connexion à la base de données. */
            'username' => 'root',

            /** Mot de passe associé à l'utilisateur de la base de données. */
            'password' => '',

            /**
             * Préfixe à appliquer aux tables de la base de données utilisées par Loxya.
             *
             * Laisser vide pour ne pas en utiliser.
             */
            'prefix' => '',
        ],

        //
        // - Informations sur l'organisation exploitant Loxya.
        //

        'organization' => [
            /** La raison sociale / nom de l'organisation. */
            'name' => null,

            /** Chemin absolu vers le logo de l'organisation. */
            'logo' => null,

            /** Numéro d'enregistrement de l'organisation (SIRET, IDE, BCE, ...). */
            'registrationId' => null,

            /** Forme juridique. */
            'legalType' => null,

            /** Capital social. */
            'shareCapital' => null,

            /** Code d'activité de l'organisation (APE, NACE, NOGA, ...) */
            'activityCode' => null,

            /** Ville du registre du commerce (e.g. "Annecy"). */
            'tradeRegistryCity' => null,

            /** Exempté de T.V.A. ? */
            'isVatExempted' => false,

            /** Code d'exonération de T.V.A. (uniquement si exempté) */
            'vatExemptionCode' => null,

            /** Raison personnalisée d'exonération de T.V.A. (uniquement si exempté) */
            'vatExemptionReason' => null,

            /** Numéro de TVA. */
            'vatNumber' => null,

            /**
             * Si assujettie, la TVA est-elle exigible à l'émission des factures
             * (paiement sur les débits) plutôt qu'à l'encaissement ?
             */
            'isVatDueOnInvoice' => false,

            /** Adresse de l'organisation: Numéro et Rue / Complément d'adresse. */
            'street' => [],

            /** Adresse de l'organisation: Code postal. */
            'postalCode' => null,

            /** Adresse de l'organisation: Subdivision administrative. */
            'administrativeArea' => null,

            /** Adresse de l'organisation: Localité / Ville. */
            'locality' => null,

            /**
             * Adresse de l'organisation: Pays.
             * (au format ISO 3166-1 alpha-2)
             */
            'country' => 'FR',

            /** Numéro de téléphone de l'organisation. */
            'phone' => null,

            /** Adresse e-mail de l'organisation. */
            'email' => null,
        ],

        //
        // - Configuration des devis.
        //

        'estimates' => [
            /**
             * Durée de validité par défaut des devis (en jours, minimum 1).
             *
             * Utilisé pour calculer la date d'échéance par défaut du devis
             * si aucune date d'échéance n'est précisée explicitement.
             */
            'validityDays' => 15,
        ],

        //
        // - Configuration de la facturation.
        //

        'invoices' => [
            /**
             * Adresse électronique de l'organisation pour l'envoi des e-factures.
             *
             * Utilisé notamment pour recevoir les status de traitement des e-factures (dans le cadre du e-invoicing).
             *
             * Si ce code n'est pas défini explicitement, le format par défaut dans le pays de l’organisation,
             * s'il peut être déduit, sera utilisé (en France ce sera par exemple `0225:[Votre SIREN]`).
             */
            'routingIdentifier' => null,

            /**
             * Délai de paiement par défaut (en jours).
             *
             * Utilisé si la facture ne comporte pas de date d'échéance explicite.
             *
             * `0` signifie "à réception".
             */
            'paymentTermDays' => 15,

            /**
             * Moyens de pairement.
             *
             * Un tableau contenant une liste de moyen en clé (correspond à l'énumération
             * `PaymentMethod`) avec un booléen ou le détails du moyen de paiement en valeur.
             *
             * Moyens de paiement pris en charge :
             * - `cash` : Espèces
             * - `card` : Carte bancaire
             * - `cheque` : Chèque
             * - `transfer` : Virement SEPA
             *   => Cette valeur, si présente, doit contenir le RIB en sous-tableau avec les clés suivantes :
             *      - `holder` : Nom du titulaire du compte (par défaut: Raison sociale de l'organisation).
             *      - `iban` : IBAN du compte bancaire.
             *      - `bic` : Code BIC / SWIFT du compte bancaire.
             */
            'paymentMethods' => [],

            /**
             * Textes personnalisés pour les mentions légales des devis et factures.
             *
             * Ce tableau peut contenir une liste de codes en clé (correspond à l'énumération
             * `BillingMention`) avec le texte correspondant en valeur.
             *
             * Ce tableau permet non seulement d'ajouter de nouvelles mentions mais surtout de
             * surcharger les mentions obligatoires par défaut lorsque Loxya les proposent pour
             * le pays de l'organisation.
             *
             * Codes acceptés :
             * -  `seller-identity`: Identité complète du vendeur.
             * -  `trade-register`: Mention d'immatriculation au registre du commerce.
             * -  `vat-due-on-invoice`: Mention d'option pour la "TVA sur les débits".
             * -  `no-early-payment-discount`: Absence d'escompte pour paiement anticipé.
             * -  `late-payment-penalty`: Pénalité exigible en cas de retard de paiement.
             * -  `late-payment-flat-fee`: Indemnité forfaitaire pour frais de recouvrement
             *                             en cas de retard de paiement.
             */
            'mentions' => [],
        ],

        //
        // - Configuration de la journalisation.
        //

        'logger' => [
            /**
             * Le niveau de log à utiliser, sachant que tous les niveaux
             * au-dessus de la valeur choisie seront inclus.
             *
             * Valeurs possibles :
             * - 100: DEBUG
             * - 200: INFO
             * - 250: NOTICE
             * - 300: WARNING
             * - 400: ERROR
             * - 500: CRITICAL
             * - 550: ALERT
             * - 600: EMERGENCY
             */
            'level' => LogLevel::Notice,

            /**
             * Les fichiers de logs subissant une rotation quotidienne, le nombre
             * maximal de fichiers (et donc de jours) de logs à conserver.
             */
            'max_files' => 10,
        ],

        //
        // - Configuration des exports.
        //

        'exports' => [
            'materials' => [
                /**
                  * Permet d'activer l'export étendu en incluant des colonnes avancées.
                  *
                  * Il est à noter que ces colonnes ne pourront potentiellement pas être
                  * réutilisées lors du re-import, c'est le cas par exemple des codes-barres.
                  */
                'advanced' => false,
            ],
        ],

        //
        // - Configuration des envois d'e-mails.
        //

        'email' => [
            /**
             * Le driver à utiliser pour l'envoi des mails.
             *
             * Valeurs possibles : `mail`, `smtp`, `loxya`, ou `mailjet`.
             */
            'driver' => 'mail',

            /**
             * Adresse e-mail utilisée comme expéditeur des e-mails de l'application.
             *
             * Peut aussi être un tableau au format `['name' => '...', 'email' => '...']`.
             */
            'from' => null,

            /**
             * Configuration du serveur SMTP à utiliser pour l'envoi des e-mails.
             *
             * Note : Cette configuration n'est utilisée que si le driver utilisé est `smtp`.
             */
            'smtp' => [
                /** L'hôte du serveur SMTP. */
                'host' => 'localhost',

                /** Le port du serveur SMTP. */
                'port' => 1025,

                /**
                 * Nom d'utilisateur à utiliser pour la connexion SMTP.
                 *
                 * Si `null`, l'authentification SMTP sera désactivée.
                 */
                'username' => null,

                /** Mot de passe à utiliser pour la connexion SMTP. */
                'password' => null,

                /**
                 * Quel type de chiffrement utiliser lors de la connexion SMTP.
                 *
                 * Valeurs possibles :
                 * - `false` : Pas de chiffrement.
                 * - `tls` : Chiffrement en TLS via la commande STARTTLS.
                 * - `ssl` : Chiffrement via SSL/TLS (SMTPS).
                 */
                'security' => false,
            ],

            /**
             * Identifiants MailJet à utiliser pour l'envoi des e-mails.
             *
             * Note : Cette configuration n'est utilisée que si le driver utilisé est `mailjet`.
             */
            'mailjet' => [
                /** La clé d'API fournie par MailJet. */
                'apiKey' => null,

                /** Le "secret" lié à la clé d'API fournie par MailJet. */
                'apiSecretKey' => null,
            ],
        ],

        /**
         * Unités des mesures utilisées dans l'application.
         */
        'measurementUnits' => [
            'materials' => [
                /** Unité de poids. */
                'weight' => WeightUnit::KILOGRAM,
            ],
        ],

        /**
         * Couleurs personnalisées à utiliser dans le color-picker de l'application.
         * (à la place des propositions par défaut, doit être un tableau avec des codes
         * hexadécimaux ou `null`)
         */
        'colorSwatches' => null,
    ];

    public const JSON_OPTIONS =
        JSON_PRETTY_PRINT |
        JSON_UNESCAPED_UNICODE |
        JSON_UNESCAPED_SLASHES;

    private const SCHEMA = [
        'baseUrl' => 'string',
        'enableCORS?' => 'bool',
        'JWTSecret' => 'string',
        'sessionExpireHours?' => 'int',
        'maxItemsPerPage?' => 'int',
        'returnPolicy' => ReturnPolicy::class,
        'billingMode' => BillingMode::class,
        'defaultLang' => 'string',
        'currency' => 'string',
        'db?' => 'array',
        'organization' => [
            'legalType?' => LegalTypeFactory::class,
            'isVatExempted?' => 'bool',
            'vatExemptionCode?' => VatExemptionCodeFactory::class,
            'vatExemptionReason?' => 'string',
            'isVatDueOnInvoice?' => 'bool',
        ],
        'measurementUnits?' => [
            'materials' => [
                'weight' => WeightUnit::class,
            ],
        ],
        'invoices?' => [
            'routingIdentifier?' => 'string',
        ],
    ];

    public const ALLOWED_FILE_TYPES = [
        'application/pdf',
        'application/zip',
        'application/x-rar-compressed',
        'application/gzip',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/svg+xml',
        'text/plain',
        'text/csv',
        'text/xml',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.oasis.opendocument.text',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    public const ALLOWED_IMAGE_TYPES = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/svg+xml',
    ];

    /** @var string|null La version de l'application, mise en "cache". */
    private static $versionCached;

    /** @var array La configuration, mise en "cache". */
    private static $configCached;

    /**
     * @var array|null En environnement de test, plutôt que d'utiliser un
     *                 vrai fichier, cette variable sera utilisée pour stocker
     *                 la configuration.
     */
    private static $testConfig = null;

    /**
     * Permet de vérifier si une clé de configuration est définie.
     *
     * @param string $key La clé de configuration dont on souhaite vérifier l'existence.
     *                    Peut aussi contenir un chemin "dot-style" (e.g; `key.sub-key`)
     *                    pour vérifier les clés "profondes".
     *
     * @return bool Retourne `true` si la clé de configuration est définie, `false` sinon.
     */
    public static function has(string $key): bool
    {
        return self::get($key) !== null;
    }

    /**
     * Permet de récupérer la configuration complète ou bien la valeur d'une clé de configuration.
     *
     * NOTE: Préférez utiliser le settings du conteneur global lorsque vous le pouvez.
     *
     * @param ?string $key     La clé de configuration dont on souhaite récupérer la valeur.
     *                         Peut aussi contenir un chemin "dot-style" (e.g; `key.sub-key`)
     *                         pour récupérer les clés "profondes".
     * @param ?mixed  $default La valeur par défaut à retourner si la clé n'existe pas ou
     *                         contient la valeur `null`. Par défaut: `null`.
     *
     * @return mixed Si un chemin / une clé a été fournie: La valeur de la clé si elle est
     *               spécifier ou la valeur par défaut sinon. Si aucune clé n'a été fournie,
     *               tout la configuration sera retournée.
     */
    public static function get(?string $key = null, $default = null): mixed
    {
        $config = Arr::defaultsRecursive(self::getDefault(), (
            static::customConfigExists() ? static::getCustomConfig() : []
        ));

        return $key !== null
            ? (Arr::get($config, $key) ?? $default)
            : $config;
    }

    /**
     * Permet de récupérer la configuration par défaut complète ou bien la valeur d'une clé.
     *
     * @param ?string $key La clé de configuration par défaut dont on souhaite récupérer la valeur.
     *                     Peut aussi contenir un chemin "dot-style" (e.g; `key.sub-key`)
     *                     pour récupérer les clés "profondes".
     *
     * @return mixed Si un chemin / une clé a été fournie: La valeur de la clé si elle est
     *               spécifier ou `null` sinon. Si aucune clé n'a été fournie,
     *               tout la configuration par défaut sera retournée.
     */
    public static function getDefault(?string $key = null): mixed
    {
        $defaults = self::DEFAULT_SETTINGS;

        return $key !== null
            ? Arr::get($defaults, $key)
            : $defaults;
    }

    public static function getEnv(bool $envOnly = false)
    {
        $env = env('APP_ENV');
        if (!$envOnly && $env === null) {
            $env = static::get('env');
        }
        if (!in_array($env, ['development', 'production', 'test'], true)) {
            $env = 'production';
        }
        return $env;
    }

    public static function getVersion()
    {
        if (!static::$versionCached) {
            static::$versionCached = trim(file_get_contents(SRC_FOLDER . DS . 'VERSION'));
        }
        return static::$versionCached;
    }

    public static function getDbConfig(array $options = []): array
    {
        $options = Arr::defaults($options, [
            'noDatabase' => false,
            'noCharset' => false,
        ]);

        $dbConfig = array_replace(self::get('db'), [
            'charset' => 'utf8mb4',
            'collation' => 'utf8mb4_unicode_ci',
            'options' => [
                \PDO::ATTR_CASE => \PDO::CASE_NATURAL,
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
                \PDO::ATTR_STRINGIFY_FETCHES => false,
                \PDO::ATTR_EMULATE_PREPARES => true,
                \PDO::ATTR_PERSISTENT => true,
            ],
        ]);

        // - Récupération des overwrites depuis les variables d'environnement.
        $envVars = [
            'host' => 'host',
            'port' => 'port',
            'name' => 'database',
            'test' => 'testDatabase',
            'user' => 'username',
            'pass' => 'password',
        ];
        foreach ($envVars as $envVar => $var) {
            $value = env(sprintf('DB_%s', strtoupper($envVar)));
            if ($value !== null) {
                $dbConfig[$var] = $value;
            }
        }

        // - Si on est dans un environnement de test, on utilise la base de test.
        if (static::getEnv() === 'test') {
            $dbConfig['testDatabase'] ??= sprintf('%s-test', $dbConfig['database']);
            $dbConfig['database'] = $dbConfig['testDatabase'];
        }

        $dbConfig['driver'] = 'mysql';
        $dbConfig['dsn'] = sprintf(
            '%s:host=%s;port=%s',
            $dbConfig['driver'],
            $dbConfig['host'],
            $dbConfig['port'],
        );

        if (!$options['noDatabase']) {
            $dbConfig['dsn'] .= sprintf(';dbname=%s', $dbConfig['database']);
        }
        if (!$options['noCharset']) {
            $dbConfig['dsn'] .= sprintf(';charset=%s', $dbConfig['charset']);
        }

        return $dbConfig;
    }

    public static function getPDO(bool $withDatabase = true): \PDO
    {
        $dbConfig = self::getDbConfig(['noDatabase' => !$withDatabase]);
        try {
            return new \PDO(
                $dbConfig['dsn'],
                $dbConfig['username'],
                $dbConfig['password'],
                $dbConfig['options'],
            );

        // @codeCoverageIgnoreStart
        } catch (\PDOException $e) {
            $details = match ($e->getCode()) {
                2002 => sprintf(
                    "Hostname `%s` unreachable. Please check DB `host` in configuration.",
                    $dbConfig['host'],
                ),
                1045 => "Bad credentials. Please check DB `username` and `password` in configuration.",
                1049 => sprintf(
                    "Database `%s` is missing. You should create it, or check its name in configuration.",
                    $dbConfig['database'],
                ),
                default => null,
            };

            $message = sprintf("Unable to connect to database (error %s)", $e->getCode());
            $message .= $details === null
                ? sprintf(":\n    PDO details: %s", $e->getMessage())
                : sprintf(":\n    %s", $details);

            throw new \PDOException($message);
        }
        // @codeCoverageIgnoreEnd
    }

    /**
     * Permet de récupérer le pays d'utilisation principal de l'application.
     *
     * @return Country Le pays d'utilisation principal.
     */
    public static function getMainCountry(): Country
    {
        return new Country(self::get('mainCountry'));
    }

    /**
     * Permet de récupérer l'adresse de l'organisation.
     *
     * @return Address L'adresse de l'organisation.
     */
    public static function getOrganizationAddress(): Address
    {
        $organization = self::get('organization');

        return (new Address($organization['country']))
            ->withAddressLine1($organization['street'][0] ?? null)
            ->withAddressLine2($organization['street'][1] ?? null)
            ->withPostalCode($organization['postalCode'] ?? null)
            ->withAdministrativeArea($organization['administrativeArea'] ?? null)
            ->withLocality($organization['locality'] ?? null);
    }

    /**
     * Permet de récupérer le pays de l'organisation.
     *
     * @return Country Le pays de l'organisation.
     */
    public static function getOrganizationCountry(): Country
    {
        return self::getOrganizationAddress()->getCountry();
    }

    /**
     * Permet de récupérer l'URL de base de l'application.
     *
     * @return string L'URL de base de l'application.
     */
    public static function getBaseUrl(): string
    {
        $url = self::get('baseUrl');

        // NOTE: Rétro-compatibilité, à supprimer à terme.
        if ($url === null && self::has('apiUrl')) {
            $url = self::get('apiUrl');
        }

        // - Dans le cas ou l'URL de base n'est pas définie, on tente
        //   de déduire ça de l'hôte courant.
        if ($url === null) {
            $scheme = env('HTTPS', false) ? 'https://' : 'http://';
            $host = env('HTTP_HOST') ?? 'localhost';
            $url = $scheme . $host;
        }

        return rtrim($url, '/');
    }

    /**
     * Permet de récupérer une instance de {@link UriInterface}
     * représentant l'URI de base de l'application.
     *
     * @return UriInterface L'URI de base de l'application.
     */
    public static function getBaseUri(): UriInterface
    {
        return new BaseUri(self::getBaseUrl());
    }

    /**
     * Permet de savoir si SSL est activé.
     *
     * @return bool `true` si SSL est activé, `false` sinon.
     */
    public static function isSslEnabled(): bool
    {
        return Config::getBaseUri()->getScheme() === 'https';
    }

    // ------------------------------------------------------
    // -
    // -    Config storage related.
    // -
    // ------------------------------------------------------

    public static function customConfigExists(): bool
    {
        if (isset(static::$configCached)) {
            return true;
        }

        if (static::getEnv(true) === 'test') {
            return static::$testConfig !== null;
        }

        return file_exists(static::FILE);
    }

    public static function saveCustomConfig(array $customConfig): void
    {
        if (empty($customConfig)) {
            throw new \InvalidArgumentException("Empty configuration.");
        }

        $parseConfig = static function (array $config, ?string $path = null) use (&$parseConfig) {
            $schema = $path !== null ? Arr::getOptional(self::SCHEMA, $path) : self::SCHEMA;
            foreach ($schema as $field => $type) {
                $isRequired = substr($field, -1) !== '?';
                $field = rtrim($field, '?');
                $fullField = ($path !== null ? sprintf('%s.', $path) : '') . $field;

                if (!array_key_exists($field, $config) || $config[$field] === null) {
                    if ($isRequired) {
                        throw new \InvalidArgumentException(sprintf(
                            "Required configuration field `%s` is missing.",
                            $fullField,
                        ));
                    }
                    continue;
                }

                if (is_array($type)) {
                    if (!is_array($config[$field])) {
                        throw new \InvalidArgumentException(vsprintf(
                            "Configuration field `%s` must be of type `array`.",
                            [$fullField],
                        ));
                    }
                    $config[$field] = $parseConfig($config[$field], $fullField);
                    continue;
                }

                if (is_a($type, \BackedEnum::class, true)) {
                    /** @var class-string<\BackedEnum> $type */

                    $enumValue = is_string($config[$field])
                        ? $type::tryFrom($config[$field])
                        : $config[$field];

                    if (!($enumValue instanceof $type)) {
                        throw new \InvalidArgumentException(vsprintf(
                            "Configuration field `%s` must be of type `%s`.",
                            [$fullField, $type],
                        ));
                    }

                    /** @var \BackedEnum $enumValue */
                    $config[$field] = $enumValue->value;
                    continue;
                }

                if (is_a($type, EnumFactory::class, true)) {
                    /** @var class-string<EnumFactory> $type */

                    $enumClass = $type::getEnumInterface();
                    $enumValue = is_string($config[$field])
                        ? $type::tryFrom($config[$field])
                        : $config[$field];

                    if (!($enumValue instanceof $enumClass)) {
                        throw new \InvalidArgumentException(vsprintf(
                            "Configuration field `%s` must be of type `%s`.",
                            [$fullField, $enumClass],
                        ));
                    }

                    /** @var \BackedEnum $enumValue */
                    $config[$field] = $enumValue->value;
                    continue;
                }

                $functionTest = sprintf('is_%s', $type);
                if (!$functionTest($config[$field])) {
                    throw new \InvalidArgumentException(vsprintf(
                        "Configuration field `%s` must be of type `%s`.",
                        [$fullField, $type],
                    ));
                }
            }
            return $config;
        };
        $customConfig = $parseConfig($customConfig);

        static::$configCached = null;

        if (static::getEnv(true) === 'test') {
            static::$testConfig = $customConfig;
            return;
        }

        $jsonSettings = json_encode($customConfig, self::JSON_OPTIONS);
        $saved = file_put_contents(static::FILE, $jsonSettings);
        if (!$saved) {
            throw new \RuntimeException(
                "Unable to write JSON settings file. " .
                "Check write access to `config/` folder.",
            );
        }
    }

    public static function deleteCustomConfig(): void
    {
        if (static::getEnv(true) === 'test') {
            static::$testConfig = null;
            return;
        }

        if (file_exists(static::FILE)) {
            unlink(static::FILE);
        }
    }

    public static function getCustomConfig(): array
    {
        if (isset(static::$configCached)) {
            return static::$configCached;
        }

        if (!static::customConfigExists()) {
            throw new \RuntimeException('Config file is missing. Please create one.');
        }

        if (static::getEnv(true) !== 'test') {
            $fileContent = @file_get_contents(static::FILE);
            if ($fileContent === false) {
                throw new \RuntimeException('Unable to read the config file.');
            }

            $rawConfig = json_decode($fileContent, true);
            if (!is_array($rawConfig)) {
                throw new \RuntimeException('Config file cannot be decoded. It may be malformed or corrupted.');
            }
        } else {
            $rawConfig = static::$testConfig;
        }

        foreach (Arr::dot(self::SCHEMA) as $field => $type) {
            $field = Str::remove('?', $field);
            if (!Arr::has($rawConfig, $field)) {
                continue;
            }

            $currentValue = Arr::get($rawConfig, $field);
            if ($currentValue === null) {
                continue;
            }

            if (is_a($type, \BackedEnum::class, true)) {
                Arr::set($rawConfig, $field, (
                    !($currentValue instanceof $type)
                        ? $type::from($currentValue)
                        : $currentValue
                ));
            }

            if (is_a($type, EnumFactory::class, true)) {
                /** @var class-string<EnumFactory> $type */
                $enumClass = $type::getEnumInterface();

                Arr::set($rawConfig, $field, (
                    !($currentValue instanceof $enumClass)
                        ? $type::from($currentValue)
                        : $currentValue
                ));
            }
        }

        return static::$configCached = $rawConfig;
    }
}
