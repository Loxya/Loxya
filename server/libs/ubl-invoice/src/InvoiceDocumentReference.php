<?php
declare(strict_types=1);

namespace NumNum\UBL;

use DateTime;
use InvalidArgumentException;
use Sabre\Xml\Reader;
use Sabre\Xml\Writer;
use Sabre\Xml\XmlDeserializable;
use Sabre\Xml\XmlSerializable;
use function Sabre\Xml\Deserializer\keyValue;

class InvoiceDocumentReference implements XmlSerializable, XmlDeserializable
{
    private $originalInvoiceId;

    private $issueDate;

    private ?int $documentTypeCode = null;

    // phpcs:ignore SlevomatCodingStandard.Functions.DisallowEmptyFunction
    final public function __construct() {}

    /**
     * Get the id of the invoice that is being credited
     *
     * @return string
     */
    public function getOriginalInvoiceId(): ?string
    {
        return $this->originalInvoiceId;
    }

    /**
     * Set the id of the invoice that is being credited
     *
     * @param string|null $invoiceRef
     *
     * @return static
     */
    public function setOriginalInvoiceId(?string $invoiceRef)
    {
        $this->originalInvoiceId = $invoiceRef;
        return $this;
    }

    /**
     * Get the issue date of the original invoice that is being credited
     *
     * @return ?DateTime
     */
    public function getIssueDate(): ?DateTime
    {
        return $this->issueDate;
    }

    /**
     * Set the issue date of the original invoice that is being credited
     *
     * @return static
     */
    public function setIssueDate(?DateTime $issueDate)
    {
        $this->issueDate = $issueDate;
        return $this;
    }

    /**
     * Get the document type code (UNTDID 1001) of the referenced invoice.
     */
    public function getDocumentTypeCode(): ?int
    {
        return $this->documentTypeCode;
    }

    /**
     * Set the document type code (UNTDID 1001) of the referenced invoice.
     *
     * @return static
     */
    public function setDocumentTypeCode(?int $documentTypeCode)
    {
        $this->documentTypeCode = $documentTypeCode;
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
        if ($this->originalInvoiceId === null) {
            throw new InvalidArgumentException('Missing invoicedocumentreference originalinvoiceid');
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

        $writer->write([
            [
                'name' => Schema::CBC . 'ID',
                'value' => $this->originalInvoiceId,
            ],
        ]);

        if ($this->issueDate !== null) {
            $writer->write([
                [
                    'name' => Schema::CBC . 'IssueDate',
                    'value' => $this->issueDate->format('Y-m-d'),
                ],
            ]);
        }

        if ($this->documentTypeCode !== null) {
            $writer->write([
                [
                    'name' => Schema::CBC . 'DocumentTypeCode',
                    'value' => (string) $this->documentTypeCode,
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
        $mixedContent = keyValue($reader);

        return (new static())
            ->setOriginalInvoiceId($mixedContent[Schema::CBC . 'ID'] ?? null)
            ->setIssueDate((
                ($mixedContent[Schema::CBC . 'IssueDate'] ?? null) !== null
                    ? new DateTime($mixedContent[Schema::CBC . 'IssueDate'])
                    : null
            ))
            ->setDocumentTypeCode((
                ($mixedContent[Schema::CBC . 'DocumentTypeCode'] ?? null) !== null
                    ? (int) $mixedContent[Schema::CBC . 'DocumentTypeCode']
                    : null
            ))
        ;
    }
}
