import type { Company } from '@/stores/api/companies';
import type { Beneficiary } from '@/stores/api/beneficiaries';
import type LegalEntityType from '@/stores/api/@enums/legal-entity-type';

/** Représente un acheteur (personne physique ou morale). */
export type Buyer = (
    | { type: LegalEntityType.INDIVIDUAL, data: Beneficiary }
    | { type: LegalEntityType.COMPANY, data: Company }
);
