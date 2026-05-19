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

class PartyIdentification implements XmlSerializable, XmlDeserializable
{
    private ?string $id = null;

    private ?string $schemeId = null;

    private ?string $schemeName = null;

    // phpcs:ignore SlevomatCodingStandard.Functions.DisallowEmptyFunction
    final public function __construct() {}

    public function getId(): ?string
    {
        return $this->id;
    }

    /**
     * @return static
     */
    public function setId(?string $id)
    {
        $this->id = $id;
        return $this;
    }

    public function getSchemeId(): ?string
    {
        return $this->schemeId;
    }

    /**
     * @return static
     */
    public function setSchemeId(?string $schemeId)
    {
        $this->schemeId = $schemeId;
        return $this;
    }

    public function getSchemeName(): ?string
    {
        return $this->schemeName;
    }

    /**
     * @return static
     */
    public function setSchemeName(?string $schemeName)
    {
        $this->schemeName = $schemeName;
        return $this;
    }

    /**
     * The validate function that is called during xml writing to valid the data of the object.
     *
     * @return void
     *
     * @throws InvalidArgumentException An error with information about required data that is missing to write the XML
     */
    public function validate()
    {
        if ($this->id === null) {
            throw new InvalidArgumentException('Missing PartyIdentification ID');
        }
    }

    public function xmlSerialize(Writer $writer): void
    {
        $this->validate();

        $attributes = [];
        if ($this->schemeId !== null) {
            $attributes['schemeID'] = $this->schemeId;
        }
        if ($this->schemeName !== null) {
            $attributes['schemeName'] = $this->schemeName;
        }

        $writer->write([
            [
                'name' => Schema::CBC . 'ID',
                'value' => $this->id,
                'attributes' => $attributes,
            ],
        ]);
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
        $collection = new ArrayCollection(mixedContent($reader));
        $idTag = ReaderHelper::getTag(Schema::CBC . 'ID', $collection);

        return (new static())
            ->setId($idTag['value'] ?? null)
            ->setSchemeId($idTag['attributes']['schemeID'] ?? null)
            ->setSchemeName($idTag['attributes']['schemeName'] ?? null)
        ;
    }
}
