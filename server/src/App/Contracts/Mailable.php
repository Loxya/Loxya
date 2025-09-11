<?php
declare(strict_types=1);

namespace Loxya\Contracts;

use Loxya\Config\Config;
use Loxya\Services\I18n;
use Loxya\Services\View;

abstract class Mailable
{
    private I18n $i18n;

    /**
     * Retourne le sujet du mail sous forme de chaîne de caractères.
     *
     * @return string Le sujet du mail, sous forme de chaîne de caractères.
     */
    public function getSubject(): string
    {
        if (!method_exists($this, 'getRawSubject')) {
            throw new \LogicException(
                'Either `getSubject()` or `getRawSubject()` should be ' .
                'defined in concrete class.',
            );
        }

        /** @disregard P1013 - L'existence de la constante est vérifiée plus. */
        $rawSubject = $this->getRawSubject();
        if (!is_string($rawSubject) && !is_array($rawSubject)) {
            throw new \LogicException('`getRawSubject()` should return a translation key.');
        }

        return $this->getI18n()->translate(...(array) $rawSubject);
    }

    /**
     * Retourne le contenu du mail sous forme de chaîne de caractères.
     *
     * @return string Le contenu du mail, sous forme de chaîne de caractères.
     */
    public function getContent(): string
    {
        $reflectionClass = new \ReflectionClass(static::class);
        if (!array_key_exists('VIEW', $reflectionClass->getConstants())) {
            throw new \LogicException('The view path should be defined in the constant `VIEW`.');
        }

        $data = [];
        if (!method_exists($this, 'getViewData')) {
            foreach ((new \ReflectionClass($this))->getProperties(\ReflectionProperty::IS_PUBLIC) as $property) {
                if ($property->isInitialized($this) && $property->getDeclaringClass()->getName() !== self::class) {
                    $data[$property->getName()] = $property->getValue($this);
                }
            }
        } else {
            $data = call_user_func([$this, 'getViewData']);
            if (!is_array($data)) {
                throw new \LogicException('`getViewData()` should return an associative array.');
            }
        }

        /** @disregard P1012 */ // @phpstan-ignore-next-line classConstant.notFound
        return (new View($this->getI18n(), 'emails'))->fetch(static::VIEW, $data);
    }

    /**
     * Retourne les éventuelles pièces-jointes du mail.
     *
     * @return array Les pièces-jointes, sous forme de tableau.
     */
    public function getAttachments(): array
    {
        return [];
    }

    /**
     * Permet de changer la locale utilisée par le mail.
     *
     * Cette méthode, si elle est appelée, doit l'être avant toute récupération
     * du contenu du mail qui nécessite d'avoir la langue de celui-ci.
     *
     * Par ailleurs, une fois cette méthode appelée, la locale n'est plus
     * modifiable pour le mail.
     *
     * @param string $locale La locale à utiliser pour le mail.
     */
    public function setLocale(string $locale)
    {
        if (isset($this->i18n)) {
            throw new \LogicException('Cannot change locale once initialized.');
        }
        $this->i18n = new I18n($locale);
    }

    protected function getI18n(): I18n
    {
        $this->i18n ??= new I18n(Config::get('defaultLang'));
        return $this->i18n;
    }
}
