<?php
declare(strict_types=1);

namespace Loxya\Services\I18n;

use Adbar\Dot as DotArray;
use Loxya\Services\I18n\Exceptions\ContainerException;
use Loxya\Services\I18n\Exceptions\NotFoundException;

class Loader implements LoaderInterface
{
    /** Chemin vers le dossier contenant les messages de traduction. */
    protected string $path;

    /** Messages de traductions par langue (= cache). */
    protected array $messages = [];

    /** Code de la langue courante. */
    protected string $language;

    /**
     * Constructeur.
     *
     * @param string $path Chemin vers le dossier contenant les messages de traduction.
     */
    public function __construct(string $path)
    {
        $this->path = rtrim($path, '\\/');
    }

    /**
     * Change la langue actuellement chargée.
     *
     * @param string $language Code de la langue à charger.
     *
     * @throws ContainerException
     */
    public function setLanguage(string $language): void
    {
        $this->language = $language;

        if (!isset($this->messages[$this->language])) {
            $languageFile = $this->getLanguageFile($this->language);
            if ($this->isLanguageFileExists($this->language)) {
                $this->messages[$this->language] = new DotArray(include $languageFile);
            } else {
                throw new ContainerException(vsprintf(
                    'Translations file "%s" for language "%s" not found.',
                    [$languageFile, $this->language],
                ));
            }
        }
    }

    /**
     * Permet de savoir si une langue est disponible.
     *
     * @param string $language Code de la langue à verifier.
     *
     * @return bool `true` si la langue est disponible, `false` sinon.
     */
    public function hasLanguage(string $language): bool
    {
        return !empty($this->messages[$language]) || $this->isLanguageFileExists($language);
    }

    /**
     * Récupère le message de traduction lié à la clé de traduction passée.
     *
     * @param string $key La clé de traduction pour laquelle on souhaite
     *                    récupérer le message de traduction dans la langue
     *                    actuellement chargée.
     *
     * @return string|array Le message de traduction (un tableau si gestion du pluriel).
     *
     * @throws ContainerException
     * @throws NotFoundException
     */
    public function get(string $key): string|array
    {
        if (!$this->has($key)) {
            throw new NotFoundException('Message not found.');
        }
        return $this->messages[$this->language]->get($key);
    }

    /**
     * Permet de savoir si un message de traduction est disponible pour une clé donnée.
     *
     * @param string $key La clé de traduction pour laquelle on souhaite
     *                    savoir si un message de traduction est disponible
     *                    dans la langue actuellement chargée.
     *
     * @return bool `true` si le message de traduction existe, `false` sinon.
     */
    public function has(string $key): bool
    {
        if (empty($key)) {
            throw new ContainerException('The translation key must be a non-empty string.');
        }
        return isset($this->messages[$this->language]) && $this->messages[$this->language]->has($key);
    }

    // ------------------------------------------------------
    // -
    // -    Méthodes internes.
    // -
    // ------------------------------------------------------

    protected function getLanguageFile(string $language): string
    {
        return $this->path . DS . $language . DS . 'messages.php';
    }

    protected function isLanguageFileExists(string $language): bool
    {
        return file_exists($this->getLanguageFile($language));
    }
}
