<?php
declare(strict_types=1);

namespace NumNum\UBL;

use Doctrine\Common\Collections\ArrayCollection;
use InvalidArgumentException;
use Sabre\Xml\Reader;
use Sabre\Xml\Writer;
use Sabre\Xml\XmlDeserializable;
use Sabre\Xml\XmlSerializable;
use function Sabre\Xml\Deserializer\mixedContent;

class TaxCategory implements XmlSerializable, XmlDeserializable
{
    private $id;

    private $idAttributes = [];
    private $name;

    private $percent;

    private $taxScheme;

    private $taxExemptionReason;

    private $taxExemptionReasonCode;

    // phpcs:ignore SlevomatCodingStandard.Functions.DisallowEmptyFunction
    final public function __construct() {}

    /**
     * @return string
     */
    public function getId(): ?string
    {
        if (!empty($this->id)) {
            return $this->id;
        }

        // Default behaviour, overrrule by using setId()
        if ($this->getPercent() !== null) {
            return ($this->getPercent() > 0)
                ? UNCL5305::STANDARD_RATE
                : UNCL5305::ZERO_RATED_GOODS;
        }

        return null;
    }

    /**
     * @param string $id
     * @param array $attributes
     *
     * @return static
     */
    public function setId(?string $id, $attributes = null)
    {
        $this->id = $id;
        if (isset($attributes)) {
            $this->idAttributes = $attributes;
        }
        return $this;
    }

    /**
     * @return string
     */
    public function getName(): ?string
    {
        return $this->name;
    }

    /**
     * @param string $name
     *
     * @return static
     */
    public function setName(?string $name)
    {
        $this->name = $name;
        return $this;
    }

    /**
     * @return float|null
     */
    public function getPercent(): ?float
    {
        return $this->percent;
    }

    /**
     * @param float|null $percent
     *
     * @return static
     */
    public function setPercent(?float $percent)
    {
        $this->percent = $percent;
        return $this;
    }

    /**
     * @return TaxScheme|null
     */
    public function getTaxScheme(): ?TaxScheme
    {
        return $this->taxScheme;
    }

    /**
     * @param TaxScheme $taxScheme
     *
     * @return static
     */
    public function setTaxScheme(?TaxScheme $taxScheme)
    {
        $this->taxScheme = $taxScheme;
        return $this;
    }

    /**
     * @return string
     */
    public function getTaxExemptionReason(): ?string
    {
        return $this->taxExemptionReason;
    }

    /**
     * @param string $taxExemptionReason
     *
     * @return static
     */
    public function setTaxExemptionReason(?string $taxExemptionReason)
    {
        $this->taxExemptionReason = $taxExemptionReason;
        return $this;
    }

    /**
     * @return string
     */
    public function getTaxExemptionReasonCode(): ?string
    {
        return $this->taxExemptionReasonCode;
    }

    /**
     * @param string $taxExemptionReasonCode
     *
     * @return static
     */
    public function setTaxExemptionReasonCode(?string $taxExemptionReasonCode)
    {
        $this->taxExemptionReasonCode = $taxExemptionReasonCode;
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
        if ($this->getId() === null) {
            throw new InvalidArgumentException('Missing taxcategory id');
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
                'value' => $this->getId(),
                'attributes' => $this->idAttributes,
            ],
        ]);

        if ($this->name !== null) {
            $writer->write([
                Schema::CBC . 'Name' => $this->name,
            ]);
        }

        if ($this->percent !== null) {
            $writer->write([
                Schema::CBC . 'Percent' => NumberFormatter::format($this->percent, 2),
            ]);
        }

        if ($this->taxExemptionReasonCode !== null) {
            $writer->write([
                Schema::CBC . 'TaxExemptionReasonCode' => $this->taxExemptionReasonCode,
            ]);
        }

        if ($this->taxExemptionReason !== null) {
            $writer->write([
                Schema::CBC . 'TaxExemptionReason' => $this->taxExemptionReason,
            ]);
        }

        if ($this->taxScheme !== null) {
            $writer->write([Schema::CAC . 'TaxScheme' => $this->taxScheme]);
        } else {
            $writer->write([
                Schema::CAC . 'TaxScheme' => null,
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
        $mixedContent = mixedContent($reader);
        $collection = new ArrayCollection($mixedContent);

        $idTag = ReaderHelper::getTag(Schema::CBC . 'ID', $collection);
        $nameTag = ReaderHelper::getTag(Schema::CBC . 'Name', $collection);
        $percentTag = ReaderHelper::getTag(Schema::CBC . 'Percent', $collection);
        $taxSchemeTag = ReaderHelper::getTag(Schema::CAC . 'TaxScheme', $collection);
        $taxExemptionReasonTag = ReaderHelper::getTag(Schema::CBC . 'TaxExemptionReason', $collection);
        $taxExemptionReasonCodeTag = ReaderHelper::getTag(Schema::CBC . 'TaxExemptionReasonCode', $collection);

        return (new static())
            ->setId($idTag['value'] ?? null, $idTag['attributes'] ?? null)
            ->setName($nameTag['value'] ?? null)
            ->setPercent(isset($percentTag['value']) ? floatval($percentTag['value']) : null)
            ->setTaxScheme($taxSchemeTag['value'] ?? null)
            ->setTaxExemptionReason($taxExemptionReasonTag['value'] ?? null)
            ->setTaxExemptionReasonCode($taxExemptionReasonCodeTag['value'] ?? null)
        ;
    }
}
