<?php
declare(strict_types=1);

namespace Loxya\Models\Traits;

trait TransientAttributes
{
    private $transientAttributes = [];

    protected function setTransientAttribute(string $key, $value): void
    {
        $this->transientAttributes[$key] = $value;
    }

    protected function getTransientAttribute(string $key, $default = null)
    {
        return array_key_exists($key, $this->transientAttributes)
            ? $this->transientAttributes[$key]
            : $default;
    }

    protected function hasTransientAttribute(string $key): bool
    {
        return array_key_exists($key, $this->transientAttributes);
    }
}
