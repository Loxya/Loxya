<?php
declare(strict_types=1);

namespace Loxya\Support\Storage;

use Aws\S3\S3Client;
use League\Flysystem\AwsS3V3\AwsS3V3Adapter as S3Adapter;
use League\Flysystem\AwsS3V3\PortableVisibilityConverter as AwsS3PortableVisibilityConverter;
use League\Flysystem\Filesystem as Flysystem;
use League\Flysystem\FilesystemAdapter as FlysystemAdapter;
use League\Flysystem\Ftp\FtpAdapter;
use League\Flysystem\Ftp\FtpConnectionOptions;
use League\Flysystem\Local\LocalFilesystemAdapter as LocalAdapter;
use League\Flysystem\PhpseclibV3\SftpAdapter;
use League\Flysystem\PhpseclibV3\SftpConnectionProvider;
use League\Flysystem\UnixVisibility\PortableVisibilityConverter;
use League\Flysystem\Visibility;
use Loxya\Support\Arr;

class StorageFactory
{
    /**
     * Permet de créer un manipulateur de stockage local.
     *
     * Options disponibles:
     * - `root`: Le dossier racine à partir duquel tous les chemins seront résolus.
     * - `links`: Que faire des liens symboliques ? Peut valoir:
     *    - `skip`: Les liens symboliques sont ignorés.
     *    - `disallow`: Liens symboliques sont interdits, une exception est levée si rencontrés (défaut).
     * - `lock`: Verrou à appliquer lors de la lecture / écriture (défaut: LOCK_EX).
     * - `lazyRootCreation`: Est-ce que le dossier racine doit être créé seulement quand
     *                       il est requis (e.g. opération d'écriture) ? (défaut: `false`)
     * - `useInconclusiveMimeTypeFallback`: Détermine si un mime type peu concluant doit être
     *                                      utilisé si un meilleur type n'est pas trouvé (défaut: `false`).
     * - `directory_visibility`: La visibilité par défaut des dossiers (défaut: `private`).
     * - `permissions`: Les permissions CHMOD à appliquer aux fichiers / dossiers publics / privés.
     *   {@see https://flysystem.thephpleague.com/docs/usage/unix-visibility/}
     *
     * @param array $config Les options à appliquer au driver.
     *                      Voir "Options disponibles" ci-dessus.
     *
     * @return Storage Le manipulateur de stockage local.
     */
    public static function createLocalDriver(array $config): Storage
    {
        $visibility = PortableVisibilityConverter::fromArray(
            $config['permissions'] ?? [],
            $config['directory_visibility'] ?? $config['visibility'] ?? Visibility::PRIVATE,
        );

        $links = ($config['links'] ?? null) === 'skip'
            ? LocalAdapter::SKIP_LINKS
            : LocalAdapter::DISALLOW_LINKS;

        $adapter = new LocalAdapter(
            $config['root'],
            $visibility,
            $config['lock'] ?? LOCK_EX,
            $links,
            null,
            $config['lazyRootCreation'] ?? false,
            $config['useInconclusiveMimeTypeFallback'] ?? false,
        );

        return static::createStorage($adapter, $config);
    }

    /**
     * Permet de créer un manipulateur de stockage FTP.
     *
     * Options disponibles:
     * - `root`: Le dossier racine à partir duquel tous les chemins seront résolus (défaut: racine).
     * - `host`: L'hôte auquel se connecter (requis).
     * - `username`: Le nom d'utilisateur à utiliser pour la connexion (requis).
     * - `password`: Le mot de passe à utiliser pour la connexion (requis).
     * - `port`: Le port à utiliser pour la connexion. (défaut: 21)
     * - `ssl`: Doit-on utiliser SSL ? (défaut: `false`)
     * - `utf8`: Forcer l'utilisation du mode UTF8 ? (défaut: `false`)
     * - `timeout`: Délai de connexion après lequel une exception est levée. (défaut: 90)
     * - `passive`: Doit-on utiliser le mode passif pour déterminer le port à utiliser ? (défaut: `true`)
     * - `transferMode`: Le mode de transfert. Doit être soit `FTP_ASCII`, soit `FTP_BINARY`. (défaut: `FTP_BINARY`)
     * - `systemType`: Quel est le type de système ? Utile pour la normalisation des réponses.
     *                 (`windows` ou `unix` | défaut: `null`)
     * - `ignorePassiveAddress`: Doit-on ignorer l'adresse IP retournée par le serveur FTP en réponse à la commande
     *                           PASV et utilise plutôt l'adresse IP fournie dans le ftp_connect().
     *                           (`true` ou `false` | défaut: `null`)
     * - `timestampsOnUnixListingsEnabled`: Doit-on activer la récupération de la dernière modification dans les
     *                                      listings ? (défaut: `false`)
     * - `recurseManually`: Doit-on procéder aux récursions manuellement ou s'appuyer sur les
     *                      fonctions FTP ? (défaut: `true`)
     * - `useRawListOptions`: Doit-on permettre d'utiliser des options avec la méthode `ftpRawlist` ?
     *                        Par exemple: `ftpRawlist('-a', '/my/path')`
     *                        (défaut: Uniquement si le serveur le permet)
     *
     * @param array $config Les options à appliquer au driver.
     *                      Voir "Options disponibles" ci-dessus.
     *
     * @return Storage Le manipulateur de stockage local.
     */
    public static function createFtpDriver(array $config): Storage
    {
        if (!isset($config['root'])) {
            $config['root'] = '';
        }

        $adapter = new FtpAdapter(FtpConnectionOptions::fromArray($config));
        return static::createStorage($adapter, $config);
    }

    /**
     * Permet de créer un manipulateur de stockage SFTP.
     *
     * Options disponibles:
     * - `root`: Le dossier racine à partir duquel tous les chemins seront résolus (défaut: racine).
     * - `host`: L'hôte auquel se connecter (requis).
     * - `username`: Le nom d'utilisateur à utiliser pour la connexion (requis).
     * - `password`: Le mot de passe à utiliser pour la connexion. (défaut: `null`)
     *               (Peut-être `null` si la clé privée (`privateKey`) est utilisée)
     * - `privateKey`: La clé privée à utiliser pour la connexion. (défaut: `null`)
     *                 (Peut-être `null` si le mot de passe (`password`) est utilisé)
     * - `passphrase`: L'éventuelle passphrase à utiliser avec la clé privée. (défaut: `null`)
     * - `port`: Le port à utiliser pour la connexion. (défaut: 22)
     * - `useAgent`: Doit-on utiliser un agent SSH pour l'authentification ? (défaut: `false`)
     * - `timeout`: Délai de connexion après lequel une exception est levée. (défaut: 10)
     * - `maxTries`: Nom de tentative de connexion avant de lever une exception. (défaut: 4)
     * - `hostFingerprint`: L'emprunte attendue du serveur distant, si l'empreinte renvoyée
     *                      ne correspond pas, une exception sera levée. (défaut: `null`)
     * - `preferredAlgorithms`: Un tableau contenant les algorithmes de connexion à utiliser.
     *                          (@see https://phpseclib.com/docs/connect#using-a-custom-cipher-suite)
     * - `permissions`: Les permissions CHMOD à appliquer aux fichiers / dossiers publics / privés.
     *                  {@see https://flysystem.thephpleague.com/docs/usage/unix-visibility/}
     *
     * @param array $config Les options à appliquer au driver.
     *                      Voir "Options disponibles" ci-dessus.
     *
     * @return Storage Le manipulateur de stockage local.
     */
    public static function createSftpDriver(array $config): Storage
    {
        $root = $config['root'] ?? '/';
        $provider = SftpConnectionProvider::fromArray($config);
        $visibility = PortableVisibilityConverter::fromArray(
            $config['permissions'] ?? [],
        );

        $adapter = new SftpAdapter($provider, $root, $visibility);
        return static::createStorage($adapter, $config);
    }

    /**
     * Permet de créer un manipulateur de stockage AWS S3.
     *
     * NOTE: Pour utiliser ce driver, un profil IAM correctement configuré du côté de AWS est nécessaire.
     *       Voir {@see https://flysystem.thephpleague.com/docs/adapter/aws-s3-v3/} à ce sujet.
     *
     * Options disponibles:
     * - `root`: Le "dossier" racine à partir duquel tous les chemins seront résolus (défaut: racine du bucket).
     * - `key`: La clé AWS à utiliser pour la connexion (requis).
     * - `secret`: Le secret AWS à utiliser pour la connexion (requis).
     * - `token`: Le token AWS à utiliser pour la connexion.
     * - `bucket`: Le nom du bucket (requis).
     * - `region`: La région AWS qui héberge le bucket (requis).
     * - `retries`: Nom de tentative de connexion avant de lever une exception. (défaut: 3)
     * - `options`: Les options AWS par défaut à appliquer aux requêtes.
     *              Options AWS disponibles:
     *              'ACL', 'CacheControl', 'ContentDisposition', 'ContentEncoding',
     *              'ContentLength', 'ContentType', 'Expires', 'GrantFullControl',
     *              'GrantRead', 'GrantReadACP', 'GrantWriteACP', 'Metadata',
     *              'MetadataDirective', 'RequestPayer', 'SSECustomerAlgorithm',
     *              'SSECustomerKey', 'SSECustomerKeyMD5', 'SSEKMSKeyId',
     *              'ServerSideEncryption', 'StorageClass', 'Tagging',
     *              'WebsiteRedirectLocation',
     * - `visibility`: La visibilité par défaut des dossiers. (`public` ou `private` | défaut: `public`)
     * - `stream_reads`: Doit-on utiliser le streaming lors de la lecture ? (défaut: `true`)
     * - `forwardedOptions`: Les options (de la clé `options`) transmises à AWS (défaut: Toutes).
     * - `metadataFields`: Les métadonnées à récupérer pour chaque fichier.
     *                     (défaut: `Metadata`, `StorageClass`, `ETag` et `VersionId`)
     * - `multipartUploadOptions`: Les éventuelles options d'upload multi-part à transmettre à AWS (défaut: Toutes).
     * - ... d'autres options bas-niveaux propres à AWS sont aussi utilisables pour la connexion.
     *       Voir {@see https://docs.aws.amazon.com/sdk-for-php/v3/developer-guide/guide_configuration.html}
     *
     * @param array $config Les options à appliquer au driver.
     *                      Voir "Options disponibles" ci-dessus.
     *
     * @return Storage Le manipulateur de stockage local.
     */
    public function createS3Driver(array $config): Storage
    {
        $s3Config = $config + ['version' => 'latest'];
        if (!empty($s3Config['key']) && !empty($s3Config['secret'])) {
            $s3Config['credentials'] = Arr::only($s3Config, ['key', 'secret', 'token']);
        }

        $root = (string) ($s3Config['root'] ?? '');
        $visibility = new AwsS3PortableVisibilityConverter(
            $config['visibility'] ?? Visibility::PUBLIC,
        );

        // - Autres options bas niveau.
        $s3Config['stream_reads'] ??= true;
        $s3Config['forwardedOptions'] ??= S3Adapter::AVAILABLE_OPTIONS;
        $s3Config['metadataFields'] ??= ['Metadata', 'StorageClass', 'ETag', 'VersionId'];
        $s3Config['multipartUploadOptions'] ??= S3Adapter::MUP_AVAILABLE_OPTIONS;

        $client = new S3Client($s3Config);
        $adapter = new S3Adapter(
            $client,
            $s3Config['bucket'],
            $root,
            $visibility,
            null,
            $config['options'] ?? [],
            $s3Config['stream_reads'],
            $s3Config['forwardedOptions'],
            $s3Config['metadataFields'],
            $s3Config['multipartUploadOptions'],
        );

        return static::createStorage($adapter, $config);
    }

    /**
     * Crée une instance de FlySystem wrappée par une implémentation ajoutant
     * diverses méthodes utiles au fonctionnement de l'application.
     *
     * @param FlysystemAdapter $adapter L'instance de l'adapter Flysystem bas-niveau.
     * @param array            $config  La configuration Flysystem / du wrapper haut-niveau.
     *
     * @return Storage L'instance du wrapper FlySystem haut-niveau.
     */
    protected static function createStorage(FlysystemAdapter $adapter, array $config): Storage
    {
        $flysystemConfig = Arr::only($config, ['directory_visibility', 'visibility']);
        return new Storage(new Flysystem($adapter, $flysystemConfig));
    }
}
