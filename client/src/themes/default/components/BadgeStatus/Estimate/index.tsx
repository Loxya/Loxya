import { defineComponent } from 'vue';
import { EstimateStatus } from '@/stores/api/estimates';
import Badge, { Type as BadgeType, Size } from '@/themes/default/components/Badge';

import type { PropType } from 'vue';
import type { EstimateExcerpt } from '@/stores/api/estimates';

type Props = {
    /** Le devis dont on veut afficher le statut. */
    estimate: EstimateExcerpt,

    /** La taille du badge. */
    size?: Size | `${Size}`,
};

/** Un badge représentant le statut d'un devis. */
const BadgeStatusEstimate = defineComponent({
    name: 'BadgeStatusEstimate',
    props: {
        estimate: {
            type: Object as PropType<Props['estimate']>,
            required: true,
        },
        size: {
            type: String as PropType<Required<Props>['size']>,
            default: Size.NORMAL,
        },
    },
    render() {
        const { $t: __, size, estimate } = this;

        return (
            <Badge
                size={size}
                label={__(`estimate-status.${estimate.status}`)}
                type={(() => {
                    const statusBadgeType = {
                        [EstimateStatus.DRAFT]: BadgeType.DEFAULT,
                        [EstimateStatus.OBSOLETE]: BadgeType.DANGER,
                        [EstimateStatus.PENDING]: BadgeType.WARNING,
                        [EstimateStatus.SENT]: BadgeType.INFO,
                        [EstimateStatus.ACCEPTED]: BadgeType.SUCCESS,
                        [EstimateStatus.PARTIALLY_INVOICED]: BadgeType.INFO,
                        [EstimateStatus.INVOICED]: BadgeType.SUCCESS,
                        [EstimateStatus.EXPIRED]: BadgeType.DANGER,
                        [EstimateStatus.REJECTED]: BadgeType.DANGER,
                    } as const;
                    return statusBadgeType[estimate.status];
                })()}
            />
        );
    },
});

export { Size };
export default BadgeStatusEstimate;
