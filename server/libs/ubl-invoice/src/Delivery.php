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

class Delivery implements XmlSerializable, XmlDeserializable
{
    private $actualDeliveryDate;

    private $deliveryLocation;

    private $deliveryParty;

    // phpcs:ignore SlevomatCodingStandard.Functions.DisallowEmptyFunction
    final public function __construct() {}

    /**
     * @return DateTime
     */
    public function getActualDeliveryDate(): ?DateTime
    {
        return $this->actualDeliveryDate;
    }

    /**
     * @param DateTime $actualDeliveryDate
     *
     * @return static
     */
    public function setActualDeliveryDate(?DateTime $actualDeliveryDate)
    {
        $this->actualDeliveryDate = $actualDeliveryDate;
        return $this;
    }

    /**
     * @return Address
     */
    public function getDeliveryLocation()
    {
        return $this->deliveryLocation;
    }

    /**
     * @param Address $deliveryLocation
     *
     * @return static
     */
    public function setDeliveryLocation($deliveryLocation)
    {
        $this->deliveryLocation = $deliveryLocation;
        return $this;
    }

    /**
     * @return Party
     */
    public function getDeliveryParty()
    {
        return $this->deliveryParty;
    }

    /**
     * @param Party $deliveryParty
     *
     * @return static
     */
    public function setDeliveryParty($deliveryParty)
    {
        $this->deliveryParty = $deliveryParty;
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
        if ($this->actualDeliveryDate !== null) {
            $writer->write([
               Schema::CBC . 'ActualDeliveryDate' => $this->actualDeliveryDate->format('Y-m-d'),
            ]);
        }
        if ($this->deliveryLocation !== null) {
            $writer->write([
               Schema::CAC . 'DeliveryLocation' => [ Schema::CAC . 'Address' => $this->deliveryLocation ],
            ]);
        }
        if ($this->deliveryParty !== null) {
            $writer->write([
               Schema::CAC . 'DeliveryParty' => $this->deliveryParty,
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
            ->setActualDeliveryDate((
                ($keyValues[Schema::CBC . 'ActualDeliveryDate'] ?? null) !== null
                    ? Carbon::parse($keyValues[Schema::CBC . 'ActualDeliveryDate'])->toDateTime()
                    : null
            ))
            ->setDeliveryLocation($keyValues[Schema::CAC . 'DeliveryLocation'] ?? null)
            ->setDeliveryParty($keyValues[Schema::CAC . 'DeliveryParty'] ?? null)
        ;
    }
}
