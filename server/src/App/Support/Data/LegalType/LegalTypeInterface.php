<?php
declare(strict_types=1);

namespace Loxya\Support\Data\LegalType;

interface LegalTypeInterface extends \BackedEnum
{
    /**
     * La forme juridique peut t'elle avoir un capital social ?
     *
     * @return bool `true` si oui, `false` sinon.
     */
    public function canHaveShareCapital(): bool;

    /**
     * La forme juridique est-elle potentiellement non assujetti à la T.V.A. ?
     *
     * @return bool `true` si oui, `false` sinon.
     */
    public function maybeExemptedFromVAT(): bool;
}
