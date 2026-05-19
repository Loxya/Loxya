<?php
declare(strict_types=1);

namespace Loxya\Support\Invoicing;

use horstoeko\zugferd\ZugferdDocumentBuilder;

final class FacturxBuilder extends ZugferdDocumentBuilder
{
    /** @return static */
    public static function createNew(int $profileId): static
    {
        return (new static($profileId))->initNewDocument();
    }

    /**
     * Set detailed information on the price of the item.
     *
     * @param  float       $amount                __BT-148+BT-146, From BASIC__ Price of the item
     * @param  float|null  $basisQuantity         __BT-149+BT-149-1, From BASIC__ Base quantity at the item price
     * @param  string|null $basisQuantityUnitCode __BT-150+BT-150-1, From BASIC__ Code of the unit of measurement of the base quantity at the item price
     *
     * @return static
     */
    public function setDocumentPositionPrice(
        float $amount,
        ?float $basisQuantity = null,
        ?string $basisQuantityUnitCode = null,
    ): static {
        $this->setDocumentPositionGrossPrice($amount, $basisQuantity, $basisQuantityUnitCode);
        $this->setDocumentPositionNetPrice($amount, $basisQuantity, $basisQuantityUnitCode);

        return $this;
    }

    /**
     * Add information about surcharges and charges applicable to the bill as a whole, Deductions,
     * such as for withheld taxes may also be specified in this group
     *
     * @param float       $actualAmount             __BT-92/BT-99, From BASIC WL__ Amount of the surcharge or discount at document level
     * @param bool        $isCharge                 __BT-20-1/BT-21-1, From BASIC WL__ Switch that indicates whether the following data refer to an surcharge or a discount, true means that this an charge
     * @param string      $taxCategoryCode          __BT-95/BT-102, From BASIC WL__ A coded indication of which sales tax category applies to the surcharge or deduction at document level
     *
     *                                              The following entries from UNTDID 5305 are used (details in brackets):
     *                                              - Standard rate (sales tax is due according to the normal procedure)
     *                                              - Goods to be taxed according to the zero rate (sales tax is charged with a percentage of zero)
     *                                              - Tax exempt (USt./IGIC/IPSI)
     *                                              - Reversal of the tax liability (the rules for reversing the tax liability at USt./IGIC/IPSI apply)
     *                                              - VAT exempt for intra-community deliveries of goods (USt./IGIC/IPSI not levied due to rules on intra-community deliveries)
     *                                              - Free export item, tax not levied (VAT / IGIC/IPSI not levied due to export outside the EU)
     *                                              - Services outside the tax scope (sales are not subject to VAT / IGIC/IPSI)
     *                                              - Canary Islands general indirect tax (IGIC tax applies)
     *                                              - IPSI (tax for Ceuta / Melilla) applies.
     *
     *                                              The codes for the VAT category are as follows:
     *                                              - S = sales tax is due at the normal rate
     *                                              - Z = goods to be taxed according to the zero rate
     *                                              - E = tax exempt
     *                                              - AE = reversal of tax liability
     *                                              - K = VAT is not shown for intra-community deliveries
     *                                              - G = tax not levied due to export outside the EU
     *                                              - O = Outside the tax scope
     *                                              - L = IGIC (Canary Islands)
     *                                              - M = IPSI (Ceuta/Melilla)
     *
     * @param string      $taxTypeCode              __BT-95-0/BT-102-0, From BASIC WL__ Code for the VAT category of the surcharge or charge at document level. Note: Fixed value = "VAT"
     * @param float       $taxRateApplicablePercent __BT-96/BT-103, From BASIC WL__ VAT rate for the surcharge or discount on document level. Note: The code of the sales tax category and the category-specific sales tax rate must correspond to one another. The value to be given is the percentage. For example, the value 20 is given for 20% (and not 0.2)

     * @param string|null $taxExemptionReason       __EXT-FR-FE-187, From EXTENDED__ Reason for tax exemption (free text)
     * @param string|null $taxExemptionReasonCode   __EXT-FR-FE-188, From EXTENDED__ Reason given in code form for the exemption of the amount from VAT. Note: Code list issued and maintained by the Connecting Europe Facility.
     *
     * @param float|null  $sequence                 __BT-X-265, From EXTENDED__ Calculation order
     * @param float|null  $calculationPercent       __BT-94/BT-101, From BASIC WL__ Percentage surcharge or discount at document level
     * @param float|null  $basisAmount              __BT-93/BT-100, From BASIC WL__ The base amount that may be used in conjunction with the percentage of the surcharge or discount at document level to calculate the amount of the discount at document level
     * @param float|null  $basisQuantity            __BT-X-266, From EXTENDED__ Base quantity of the discount
     * @param string|null $basisQuantityUnitCode    __BT-X-267, From EXTENDED__ Unit of the price base quantity
     * @param string|null $reasonCode               __BT-98/BT-105, From BASIC WL__ The reason given as a code for the surcharge or discount at document level. Note: Use entries from the UNTDID 5189 code list. The code of the reason for the surcharge or discount at document level and the reason for the surcharge or discount at document level must correspond to each other
     *
     *                                              Code list: UNTDID 7161 Complete list, code list: UNTDID 5189 Restricted
     *                                              Include PEPPOL subset:
     *                                              - 41 - Bonus for works ahead of schedule
     *                                              - 42 - Other bonus
     *                                              - 60 - Manufacturer’s consumer discount
     *                                              - 62 - Due to military status
     *                                              - 63 - Due to work accident
     *                                              - 64 - Special agreement
     *                                              - 65 - Production error discount
     *                                              - 66 - New outlet discount
     *                                              - 67 - Sample discount
     *                                              - 68 - End-of-range discount
     *                                              - 70 - Incoterm discount
     *                                              - 71 - Point of sales threshold allowance
     *                                              - 88 - Material surcharge/deduction
     *                                              - 95 - Discount
     *                                              - 100 - Special rebate
     *                                              - 102 - Fixed long term
     *                                              - 103 - Temporary
     *                                              - 104 - Standard
     *                                              - 105 - Yearly turnover
     *
     * @param  string|null $reason                  __BT-97/BT-104, From BASIC WL__ The reason given in text form for the surcharge or discount at document level
     *
     * @return static
     */
    public function addDocumentAllowanceChargeExtended(
        float $actualAmount,
        bool $isCharge,
        string $taxCategoryCode,
        string $taxTypeCode,
        ?float $taxRateApplicablePercent,
        ?string $taxExemptionReason = null,
        ?string $taxExemptionReasonCode = null,
        ?float $sequence = null,
        ?float $calculationPercent = null,
        ?float $basisAmount = null,
        ?float $basisQuantity = null,
        ?string $basisQuantityUnitCode = null,
        ?string $reasonCode = null,
        ?string $reason = null,
    ): static {
        if ($taxExemptionReason === null && $taxExemptionReasonCode === null) {
            return parent::addDocumentAllowanceCharge(
                $actualAmount,
                $isCharge,
                $taxCategoryCode,
                $taxTypeCode,
                $taxRateApplicablePercent,
                $sequence,
                $calculationPercent,
                $basisAmount,
                $basisQuantity,
                $basisQuantityUnitCode,
                $reasonCode,
                $reason,
            );
        }

        $objectHelper = $this->getObjectHelper();

        $allowanceCharge = $objectHelper->getTradeAllowanceChargeType(
            $actualAmount,
            $isCharge,
            $taxTypeCode,
            $taxCategoryCode,
            $taxRateApplicablePercent,
            $sequence,
            $calculationPercent,
            $basisAmount,
            $basisQuantity,
            $basisQuantityUnitCode,
            $reasonCode,
            $reason,
        );

        $objectHelper->tryCall(
            $allowanceCharge,
            'setCategoryTradeTax',
            $objectHelper->getTradeTaxType(
                $taxCategoryCode,
                $taxTypeCode,
                null,
                null,
                $taxRateApplicablePercent,
                $taxExemptionReason,
                $taxExemptionReasonCode,
            ),
        );

        $objectHelper->tryCall(
            $this->headerTradeSettlement,
            'addToSpecifiedTradeAllowanceCharge',
            $allowanceCharge,
        );

        return $this;
    }
}
