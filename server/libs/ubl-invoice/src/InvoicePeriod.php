<?php
declare(strict_types=1);

namespace NumNum\UBL;

use Carbon\Carbon;
use DateTime;
use InvalidArgumentException;
use Sabre\Xml\Reader;
use Sabre\Xml\Writer;
use Sabre\Xml\XmlDeserializable;
use Sabre\Xml\XmlSerializable;
use function Sabre\Xml\Deserializer\keyValue;

class InvoicePeriod implements XmlSerializable, XmlDeserializable
{
    private $startDate;

    private $endDate;

    private $descriptionCode;

    // phpcs:ignore SlevomatCodingStandard.Functions.DisallowEmptyFunction
    final public function __construct() {}

    /**
     * @return DateTime
     */
    public function getStartDate(): ?DateTime
    {
        return $this->startDate;
    }

    /**
     * @param DateTime $startDate
     *
     * @return static
     */
    public function setStartDate(?DateTime $startDate)
    {
        $this->startDate = $startDate;
        return $this;
    }

    /**
     * @return DateTime
     */
    public function getEndDate(): ?DateTime
    {
        return $this->endDate;
    }

    /**
     * @param DateTime $endDate
     *
     * @return static
     */
    public function setEndDate(?DateTime $endDate)
    {
        $this->endDate = $endDate;
        return $this;
    }

    /**
     * @return int
     */
    public function getDescriptionCode(): ?int
    {
        return $this->descriptionCode;
    }

    /**
     * @param int $descriptionCode
     *
     * @return static
     */
    public function setDescriptionCode(?int $descriptionCode)
    {
        $this->descriptionCode = $descriptionCode;
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
        if ($this->descriptionCode === null && ($this->startDate === null && $this->endDate === null)) {
            throw new InvalidArgumentException('Missing startDate or endDate or descriptionCode');
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

        if ($this->startDate !== null) {
            $writer->write([
                Schema::CBC . 'StartDate' => $this->startDate->format('Y-m-d'),
            ]);
        }
        if ($this->endDate !== null) {
            $writer->write([
                Schema::CBC . 'EndDate' => $this->endDate->format('Y-m-d'),
            ]);
        }
        if ($this->descriptionCode !== null) {
            $writer->write([
                Schema::CBC . 'DescriptionCode' => $this->descriptionCode,
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
            ->setStartDate((
                ($keyValues[Schema::CBC . 'StartDate'] ?? null) !== null
                    ? Carbon::parse($keyValues[Schema::CBC . 'StartDate'])->toDateTime()
                    : null
            ))
            ->setEndDate((
                ($keyValues[Schema::CBC . 'EndDate'] ?? null) !== null
                    ? Carbon::parse($keyValues[Schema::CBC . 'EndDate'])->toDateTime()
                    : null
            ))
            ->setDescriptionCode((
                ($keyValues[Schema::CBC . 'DescriptionCode'] ?? null) !== null
                    ? intval($keyValues[Schema::CBC . 'DescriptionCode'])
                    : null
            ))
        ;
    }
}
