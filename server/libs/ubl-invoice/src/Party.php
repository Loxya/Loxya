<?php
declare(strict_types=1);

namespace NumNum\UBL;

use Doctrine\Common\Collections\ArrayCollection;
use Sabre\Xml\Reader;
use Sabre\Xml\Writer;
use Sabre\Xml\XmlDeserializable;
use Sabre\Xml\XmlSerializable;
use function Sabre\Xml\Deserializer\mixedContent;

class Party implements XmlSerializable, XmlDeserializable
{
    private $name;

    /** @var PartyIdentification[] */
    private array $partyIdentifications = [];

    private $postalAddress;

    private $physicalLocation;

    private $contact;

    private $partyTaxScheme;

    private $legalEntity;

    private $endpointID;

    private $endpointID_schemeID;

    // phpcs:ignore SlevomatCodingStandard.Functions.DisallowEmptyFunction
    final public function __construct() {}

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
     * Get all party identifications.
     *
     * @return PartyIdentification[]
     */
    public function getPartyIdentifications(): array
    {
        return $this->partyIdentifications;
    }

    /**
     * Replace any existing party identifications with the given list.
     *
     * @param PartyIdentification[] $partyIdentifications
     *
     * @return static
     */
    public function setPartyIdentifications(array $partyIdentifications)
    {
        $this->partyIdentifications = array_values($partyIdentifications);
        return $this;
    }

    /**
     * Add a party identification.
     *
     * @return static
     */
    public function addPartyIdentification(PartyIdentification $partyIdentification)
    {
        $this->partyIdentifications[] = $partyIdentification;
        return $this;
    }

    /**
     * @return Address
     */
    public function getPostalAddress(): ?Address
    {
        return $this->postalAddress;
    }

    /**
     * @param Address $postalAddress
     *
     * @return static
     */
    public function setPostalAddress(?Address $postalAddress)
    {
        $this->postalAddress = $postalAddress;
        return $this;
    }

    /**
     * @return LegalEntity
     */
    public function getLegalEntity(): ?LegalEntity
    {
        return $this->legalEntity;
    }

    /**
     * @param LegalEntity $legalEntity
     *
     * @return static
     */
    public function setLegalEntity(?LegalEntity $legalEntity)
    {
        $this->legalEntity = $legalEntity;
        return $this;
    }

    /**
     * @return Address
     */
    public function getPhysicalLocation(): ?Address
    {
        return $this->physicalLocation;
    }

    /**
     * @param Address $physicalLocation
     *
     * @return static
     */
    public function setPhysicalLocation(?Address $physicalLocation)
    {
        $this->physicalLocation = $physicalLocation;
        return $this;
    }

    /**
     * @return PartyTaxScheme|null
     */
    public function getPartyTaxScheme(): ?PartyTaxScheme
    {
        return $this->partyTaxScheme;
    }

    /**
     * @param PartyTaxScheme $partyTaxScheme
     *
     * @return static
     */
    public function setPartyTaxScheme(?PartyTaxScheme $partyTaxScheme)
    {
        $this->partyTaxScheme = $partyTaxScheme;
        return $this;
    }

    /**
     * @return Contact
     */
    public function getContact(): ?Contact
    {
        return $this->contact;
    }

    /**
     * @param Contact $contact
     *
     * @return static
     */
    public function setContact(?Contact $contact)
    {
        $this->contact = $contact;
        return $this;
    }

    /**
     * @param $endpointID
     * @param string|int $schemeID See list at https://docs.peppol.eu/poacc/billing/3.0/codelist/eas/ and use \NumNum\UBL\EASCode
     *
     * @return static
     */
    public function setEndpointId($endpointID, $schemeID)
    {
        $this->endpointID = $endpointID;
        $this->endpointID_schemeID = $schemeID;
        return $this;
    }

    public function getEndpointId(): ?string
    {
        return $this->endpointID;
    }

    public function getEndpointIDSchemeId(): ?string
    {
        return $this->endpointID_schemeID;
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
        if ($this->endpointID !== null && $this->endpointID_schemeID !== null) {
            $writer->write([
                [
                    'name' => Schema::CBC . 'EndpointID',
                    'value' => $this->endpointID,
                    'attributes' => [
                        'schemeID' => is_numeric($this->endpointID_schemeID)
                            ? sprintf('%04d', +$this->endpointID_schemeID)
                            : $this->endpointID_schemeID,
                    ],
                ],
            ]);
        }
        foreach ($this->partyIdentifications as $partyIdentification) {
            $writer->write([
                Schema::CAC . 'PartyIdentification' => $partyIdentification,
            ]);
        }
        if ($this->name !== null) {
            $writer->write([
                Schema::CAC . 'PartyName' => [
                    Schema::CBC . 'Name' => $this->name,
                ],
            ]);
        }
        if ($this->postalAddress !== null) {
            $writer->write([
                Schema::CAC . 'PostalAddress' => $this->postalAddress,
            ]);
        }
        if ($this->physicalLocation !== null) {
            $writer->write([
               Schema::CAC . 'PhysicalLocation' => [Schema::CAC . 'Address' => $this->physicalLocation],
            ]);
        }
        if ($this->partyTaxScheme !== null) {
            $writer->write([
                Schema::CAC . 'PartyTaxScheme' => $this->partyTaxScheme,
            ]);
        }
        if ($this->legalEntity !== null) {
            $writer->write([
                Schema::CAC . 'PartyLegalEntity' => $this->legalEntity,
            ]);
        }
        if ($this->contact !== null) {
            $writer->write([
                Schema::CAC . 'Contact' => $this->contact,
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

        $partyName = ReaderHelper::getTag(Schema::CAC . 'PartyName', $collection);
        $partyNameName = ReaderHelper::getTag(Schema::CBC . 'Name', new ArrayCollection($partyName['value'] ?? []));

        $endpointId = ReaderHelper::getTag(Schema::CBC . 'EndpointID', $collection);
        $postalAddress = ReaderHelper::getTag(Schema::CAC . 'PostalAddress', $collection);
        $physicalLocation = ReaderHelper::getTag(Schema::CAC . 'PhysicalLocation', $collection);
        $physicalLocationAddress = ReaderHelper::getTag(
            Schema::CAC . 'Address',
            new ArrayCollection($physicalLocation['value'] ?? []),
        );

        $partyTaxScheme = ReaderHelper::getTag(Schema::CAC . 'PartyTaxScheme', $collection);
        $partyLegalEntity = ReaderHelper::getTag(Schema::CAC . 'PartyLegalEntity', $collection);
        $partyContact = ReaderHelper::getTag(Schema::CAC . 'Contact', $collection);

        $partyIdentifications = ReaderHelper::getArrayValue(Schema::CAC . 'PartyIdentification', $collection);

        return (new static())
            ->setName($partyNameName['value'] ?? null)
            ->setPostalAddress($postalAddress['value'] ?? null)
            ->setPhysicalLocation($physicalLocationAddress['value'] ?? null)
            ->setPartyTaxScheme($partyTaxScheme['value'] ?? null)
            ->setLegalEntity($partyLegalEntity['value'] ?? null)
            ->setContact($partyContact['value'] ?? null)
            ->setEndpointId($endpointId['value'] ?? null, $endpointId['attributes']['schemeID'] ?? null)
            ->setPartyIdentifications($partyIdentifications)
        ;
    }
}
