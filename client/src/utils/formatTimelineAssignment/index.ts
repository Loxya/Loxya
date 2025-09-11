import DateTime from '@/utils/datetime';
import getClassNames from './_utils/getClassNames';

import type Color from '@/utils/color';
import type { TimelineItem } from '@/themes/default/components/Timeline';
import type { I18nTranslate } from 'vuex-i18n';
import type { Technician, TechnicianEvent } from '@/stores/api/technicians';
import type { Beneficiary } from '@/stores/api/beneficiaries';

//
// - Types
//

type Formatter = (
    & ((technician: Technician, assignment: TechnicianEvent) => TimelineItem)
);

//
// - Factory
//

const withIcon = (iconName: string | null, text: string): string => (
    iconName ? `<i class="fas fa-${iconName}"></i> ${text}` : text
);

const factory = (__: I18nTranslate, now: DateTime = DateTime.now()): Formatter => (
    /**
     * Permet de formater une assignation de technicien pour une timeline.
     *
     * @param technician - Le technicien concerné par l'assignation.
     * @param assignment - L'assignation de technicien à un événement que l'on veut formater.
     *
     * @returns L'assignation dans un format accepté par une timeline.
     *          (= `<Timeline items={[>> ICI <<]} />`)
     */
    (technician: Technician, assignment: TechnicianEvent): TimelineItem => {
        const { title, location, beneficiaries } = assignment.event;
        const hasBorrower = beneficiaries.length > 0;

        // - Couleur.
        const color: Color | null = assignment.event.color ?? null;

        // - Rôle.
        const hasPosition = assignment.role !== null;
        const positionText = hasPosition ? withIcon('tools', assignment.role!.name) : undefined;

        // - Lieu.
        const hasLocation = (location ?? '').length > 0;
        const locationText = hasLocation ? withIcon('map-marker-alt', location!) : undefined;

        // - Summary
        const summaryParts = [title];
        if (hasPosition) {
            summaryParts.push(positionText!);
        }
        if (hasLocation) {
            summaryParts.push(locationText!);
        }
        if (hasBorrower) {
            const firstBeneficiary = [...beneficiaries].shift()!;

            const firstBeneficiaryIsCompany = !!firstBeneficiary.company;
            let beneficiaryExcerpt = firstBeneficiaryIsCompany
                ? firstBeneficiary.company!.legal_name
                : firstBeneficiary.full_name;

            if (beneficiaries.length > 1) {
                const countSecondaryBeneficiaries = beneficiaries.length - 1;
                beneficiaryExcerpt = withIcon('users', __(
                    'name-and-n-others',
                    {
                        name: beneficiaryExcerpt,
                        count: countSecondaryBeneficiaries,
                    },
                    countSecondaryBeneficiaries,
                ));
            } else {
                beneficiaryExcerpt = withIcon(
                    firstBeneficiaryIsCompany ? 'industry' : 'user',
                    beneficiaryExcerpt,
                );
            }
            summaryParts.push(beneficiaryExcerpt);
        }
        const summary = summaryParts.join(' - ');

        const tooltip: string = (() => {
            // - Période d'intervention.
            const assignmentPeriodText = withIcon('business-time', assignment.period.toReadable(__));

            // - Bénéficiaire
            let borrowerText = withIcon('exclamation-triangle', `<em>(${__('missing-beneficiary')})</em>`);
            if (hasBorrower) {
                const beneficiariesNames = beneficiaries.map((beneficiary: Beneficiary) => {
                    if (!beneficiary.company) {
                        return beneficiary.full_name;
                    }
                    return `${beneficiary.full_name} (${beneficiary.company.legal_name})`;
                });
                borrowerText = withIcon('address-book', __('for', { beneficiary: beneficiariesNames.join(', ') }));
            }

            return [
                `<strong>${title}</strong>`,
                [
                    assignmentPeriodText,
                    locationText,
                    borrowerText,
                ]
                    .filter(Boolean)
                    .join('\n'),
            ].filter(Boolean).join('\n\n');
        })();

        return {
            id: assignment.id,
            summary,
            tooltip,
            period: assignment.period,
            group: technician.id,
            color: color?.toHexString() ?? null,
            className: getClassNames(assignment, now),
        };
    }
);

export default factory;
