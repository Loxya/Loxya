<?php
declare(strict_types=1);

namespace NumNum\UBL;

use Carbon\Carbon;
use DateTime;
use Sabre\Xml\Reader;
use Sabre\Xml\Writer;
use Sabre\Xml\XmlDeserializable;
use Sabre\Xml\XmlSerializable;
use function Sabre\Xml\Deserializer\keyValue;

class OrderReference implements XmlSerializable, XmlDeserializable
{
    private $id;

    private $salesOrderId;

    private $issueDate;

    // phpcs:ignore SlevomatCodingStandard.Functions.DisallowEmptyFunction
    final public function __construct() {}

    /**
     * @return string|null
     */
    public function getId(): ?string
    {
        return $this->id;
    }

    /**
     * @param string|null $id
     *
     * @return static
     */
    public function setId(?string $id)
    {
        $this->id = $id;
        return $this;
    }

    /**
     * @return string
     */
    public function getSalesOrderId(): string
    {
        return $this->salesOrderId;
    }

    /**
     * @return DateTime
     */
    public function getIssueDate(): ?DateTime
    {
        return $this->issueDate;
    }

    /**
     * @param DateTime $issueDate
     *
     * @return static
     */
    public function setIssueDate(?DateTime $issueDate)
    {
        $this->issueDate = $issueDate;
        return $this;
    }

    /**
     * @param string $salesOrderId
     *
     * @return static
     */
    public function setSalesOrderId(?string $salesOrderId)
    {
        $this->salesOrderId = $salesOrderId;
        return $this;
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
        if ($this->id !== null) {
            $writer->write([Schema::CBC . 'ID' => $this->id]);
        }
        if ($this->salesOrderId !== null) {
            $writer->write([Schema::CBC . 'SalesOrderID' => $this->salesOrderId]);
        }
        if ($this->issueDate !== null) {
            $writer->write([
                Schema::CBC . 'IssueDate' => $this->issueDate->format('Y-m-d'),
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
            ->setId($keyValues[Schema::CBC . 'ID'] ?? null)
            ->setIssueDate((
                ($keyValues[Schema::CBC . 'IssueDate'] ?? null) !== null
                    ? Carbon::parse($keyValues[Schema::CBC . 'IssueDate'])->toDateTime()
                    : null
            ))
            ->setSalesOrderId($keyValues[Schema::CBC . 'SalesOrderID'] ?? null)
        ;
    }
}
