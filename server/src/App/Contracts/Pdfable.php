<?php
declare(strict_types=1);

namespace Loxya\Contracts;

use Loxya\Support\Pdf\PdfInterface;

interface Pdfable
{
    /**
     * Permet de convertir l'instance au format PDF.
     * Le contenu de ce PDF dépend du type d'objet.
     *
     * @return PdfInterface Le PDF lié à l'instance.
     */
    public function toPdf(): PdfInterface;
}
