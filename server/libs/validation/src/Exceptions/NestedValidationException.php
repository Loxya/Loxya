<?php
/*
 * Copyright (c) Alexandre Gomes Gaigalas <alganet@gmail.com>
 * SPDX-License-Identifier: MIT
 */
declare(strict_types=1);

namespace Respect\Validation\Exceptions;

use IteratorAggregate;
use RecursiveIteratorIterator;
use SplObjectStorage;
use function array_shift;
use function count;
use function current;
use function implode;
use function spl_object_hash;
use function sprintf;
use function str_repeat;
use const PHP_EOL;

/**
 * Exception for nested validations.
 *
 * This exception allows to have exceptions inside itself and providers methods
 * to handle them and to retrieve nested messages based on itself and its
 * children.
 *
 * @author Alexandre Gomes Gaigalas <alganet@gmail.com>
 * @author Henrique Moody <henriquemoody@gmail.com>
 * @author Jonathan Stewmon <jstewmon@rmn.com>
 * @author Wojciech Frącz <fraczwojciech@gmail.com>
 *
 * @implements IteratorAggregate<ValidationException>
 */
class NestedValidationException extends ValidationException implements IteratorAggregate
{
    /** @var ValidationException[] */
    private $exceptions = [];

    /**
     * Returns the exceptions that are children of the exception.
     *
     * @return ValidationException[]
     */
    public function getChildren(): array
    {
        return $this->exceptions;
    }

    /**
     * Adds a child to the exception.
     */
    public function addChild(ValidationException $exception): self
    {
        $this->exceptions[spl_object_hash($exception)] = $exception;

        return $this;
    }

    /**
     * Adds children to the exception.
     *
     * @param ValidationException[] $exceptions
     */
    public function addChildren(array $exceptions): self
    {
        foreach ($exceptions as $exception) {
            $this->addChild($exception);
        }

        return $this;
    }

    /**
     * @return SplObjectStorage<ValidationException, int>
     */
    public function getIterator(): SplObjectStorage
    {
        /** @var SplObjectStorage<ValidationException, int> $childrenExceptions */
        $childrenExceptions = new SplObjectStorage();
        $recursiveIteratorIterator = $this->getRecursiveIterator();

        $lastDepth = 0;
        $lastDepthOriginal = 0;
        $knownDepths = [];
        foreach ($recursiveIteratorIterator as $childException) {
            if ($this->isOmissible($childException)) {
                continue;
            }

            $currentDepth = $lastDepth;
            $currentDepthOriginal = $recursiveIteratorIterator->getDepth() + 1;

            if (isset($knownDepths[$currentDepthOriginal])) {
                $currentDepth = $knownDepths[$currentDepthOriginal];
            } elseif ($currentDepthOriginal > $lastDepthOriginal) {
                ++$currentDepth;
            }

            if (!isset($knownDepths[$currentDepthOriginal])) {
                $knownDepths[$currentDepthOriginal] = $currentDepth;
            }

            $lastDepth = $currentDepth;
            $lastDepthOriginal = $currentDepthOriginal;

            $childrenExceptions->attach($childException, $currentDepth);
        }

        return $childrenExceptions;
    }

    public function getMessages()
    {
        $messages = [$this->getMessage()];
        foreach ($this as $exception) {
            $messages[] = $exception->getMessage();
        }

        if (count($messages) > 1) {
            array_shift($messages);
        }

        return $messages;
    }

    /**
     * Returns a string with all the messages of the exception.
     */
    public function getFullMessage(): string
    {
        $messages = [];
        $leveler = 1;

        if (!$this->isOmissible($this)) {
            $leveler = 0;
            $messages[] = sprintf('- %s', $this->getMessage());
        }

        $exceptions = $this->getIterator();
        /** @var ValidationException $exception */
        foreach ($exceptions as $exception) {
            $messages[] = sprintf(
                '%s- %s',
                str_repeat(' ', (int) ($exceptions[$exception] - $leveler) * 2),
                $exception->getMessage(),
            );
        }

        return implode(PHP_EOL, $messages);
    }

    /**
     * @return RecursiveIteratorIterator<RecursiveExceptionIterator>
     */
    private function getRecursiveIterator(): RecursiveIteratorIterator
    {
        return new RecursiveIteratorIterator(
            new RecursiveExceptionIterator($this),
            RecursiveIteratorIterator::SELF_FIRST,
        );
    }

    private function isOmissible(Exception $exception): bool
    {
        if (!$exception instanceof self) {
            return false;
        }

        if (count($exception->getChildren()) !== 1) {
            return false;
        }

        /** @var ValidationException $childException */
        $childException = current($exception->getChildren());
        if ($childException->getMessage() === $exception->getMessage()) {
            return true;
        }

        if ($exception->hasCustomTemplate()) {
            return $childException->hasCustomTemplate();
        }

        return !$childException instanceof NonOmissibleException;
    }

    public function setName(string $name): void
    {
        parent::setName($name);

        foreach ($this->getChildren() as $exception) {
            if ($exception instanceof KeyException) {
                continue;
            }
            $exception->setName($name);
        }
    }
}
