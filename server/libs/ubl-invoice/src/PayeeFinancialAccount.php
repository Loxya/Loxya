<?php
declare(strict_types=1);

namespace NumNum\UBL;

use Sabre\Xml\Reader;
use Sabre\Xml\Writer;
use Sabre\Xml\XmlDeserializable;
use Sabre\Xml\XmlSerializable;
use function Sabre\Xml\Deserializer\keyValue;

class PayeeFinancialAccount implements XmlSerializable, XmlDeserializable
{
    private $id;

    private $name;

    private $financialInstitutionBranch;

    // phpcs:ignore SlevomatCodingStandard.Functions.DisallowEmptyFunction
    final public function __construct() {}

    /**
     * @return string
     */
    public function getId(): ?string
    {
        return $this->id;
    }

    /**
     * @param string $id
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
     * @return FinancialInstitutionBranch
     */
    public function getFinancialInstitutionBranch(): ?FinancialInstitutionBranch
    {
        return $this->financialInstitutionBranch;
    }

    /**
     * @param FinancialInstitutionBranch $financialInstitutionBranch
     *
     * @return static
     */
    public function setFinancialInstitutionBranch(?FinancialInstitutionBranch $financialInstitutionBranch)
    {
        $this->financialInstitutionBranch = $financialInstitutionBranch;
        return $this;
    }

    public function xmlSerialize(Writer $writer): void
    {
        if ($this->getId() !== null) {
            $writer->write([
                'name' => Schema::CBC . 'ID',
                'value' => $this->id,
                'attributes' => [
                    //'schemeID' => 'IBAN'
                ],
            ]);
        }
        if ($this->getName() !== null) {
            $writer->write([
                Schema::CBC . 'Name' => $this->getName(),
            ]);
        }
        if ($this->getFinancialInstitutionBranch() !== null) {
            $writer->write([
                Schema::CAC . 'FinancialInstitutionBranch' => $this->getFinancialInstitutionBranch(),
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
            ->setName($keyValues[Schema::CBC . 'Name'] ?? null)
            ->setFinancialInstitutionBranch($keyValues[Schema::CAC . 'FinancialInstitutionBranch'] ?? null);
    }
}
