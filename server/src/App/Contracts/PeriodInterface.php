<?php
declare(strict_types=1);

namespace Loxya\Contracts;

use Carbon\CarbonImmutable;

interface PeriodInterface
{
    /**
     * Permet d'obtenir, pour les objets référençant une "période", la date de début.
     *
     * @return CarbonImmutable La date de début de la période représentée.
     */
    public function getStartDate(): CarbonImmutable;

    /**
     * Permet d'obtenir, pour les objets référençant une "période", la date de fin.
     *
     * @return CarbonImmutable|null La date de fin de la période représentée,
     *                              `null` s'il n'y a pas de fin.
     */
    public function getEndDate(): CarbonImmutable|null;
}
