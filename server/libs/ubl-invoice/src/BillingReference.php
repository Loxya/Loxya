<?php
declare(strict_types=1);

namespace NumNum\UBL;

use InvalidArgumentException;
use Sabre\Xml\Reader;
use Sabre\Xml\Writer;
use Sabre\Xml\XmlDeserializable;
use Sabre\Xml\XmlSerializable;
use function Sabre\Xml\Deserializer\keyValue;

class BillingReference implements XmlSerializable, XmlDeserializable
{
    private $invoiceDocumentReference;

    private ?string $lineId = null;

    // phpcs:ignore SlevomatCodingStandard.Functions.DisallowEmptyFunction
    final public function __construct() {}

    /**
     * @return ?InvoiceDocumentReference
     */
    public function getInvoiceDocumentReference(): ?InvoiceDocumentReference
    {
        return $this->invoiceDocumentReference;
    }

    /**
     * @return static
     */
    public function setInvoiceDocumentReference($invoiceDocumentReference)
    {
        $this->invoiceDocumentReference = $invoiceDocumentReference;
        return $this;
    }

    /**
     * Get the line identifier inside the previous invoice (cac:BillingReferenceLine/cbc:ID).
     */
    public function getLineId(): ?string
    {
        return $this->lineId;
    }

    /**
     * Set the line identifier inside the previous invoice (cac:BillingReferenceLine/cbc:ID).
     *
     * @return static
     */
    public function setLineId(?string $lineId)
    {
        $this->lineId = $lineId;
        return $this;
    }

    /**
     * The validate function that is called during xml writing to valid the data of the object.
     *
     * @throws InvalidArgumentException An error with information about required data that is missing to write the XML
     *
     * @return void
     */
    public function validate()
    {
        if ($this->invoiceDocumentReference === null) {
            throw new InvalidArgumentException('Missing billingreference invoicedocumentreference');
        }
    }

    /**
     * The xmlSerialize method is called during xml writing.
     *
     * @param Writer $writer
     *
     * @return void
     */
    public function xmlSerialize(Writer $writer): void
    {
        $this->validate();

        $writer->write([Schema::CAC . 'InvoiceDocumentReference' => $this->invoiceDocumentReference]);

        if ($this->lineId !== null) {
            $writer->write([
                Schema::CAC . 'BillingReferenceLine' => [
                    Schema::CBC . 'ID' => $this->lineId,
                ],
            ]);
        }
    }

    /**
     * The xmlDeserialize method is called during xml reading.
     *
     * @param Reader $reader
     *
     * @return static
     */
    public static function xmlDeserialize(Reader $reader)
    {
        $keyValues = keyValue($reader);

        return (new static())
            ->setInvoiceDocumentReference($keyValues[Schema::CAC . 'InvoiceDocumentReference'] ?? null)
            ->setLineId($keyValues[Schema::CAC . 'BillingReferenceLine'] ?? null)
        ;
    }
}
