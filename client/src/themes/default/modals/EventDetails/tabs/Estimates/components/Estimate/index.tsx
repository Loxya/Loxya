import './index.scss';
import { defineComponent } from 'vue';
import { confirm } from '@/utils/alert';
import apiEstimates from '@/stores/api/estimates';
import { Group } from '@/stores/api/groups';
import formatAmount from '@/utils/formatAmount';
import Icon from '@/themes/default/components/Icon';
import Button from '@/themes/default/components/Button';

import type { PropType } from 'vue';
import type { Estimate } from '@/stores/api/estimates';

type Props = {
    /** Le devis à afficher. */
    estimate: Estimate,

    /**
     * Le devis est-il obsolète ?
     *
     * Par exemple si un nouveau devis pour la même
     * "cible" a été régénéré depuis.
     */
    outdated?: boolean,

    /**
     * Fonction appelée lorsque le devis a été supprimé.
     *
     * @param id - L'identifiant du devis supprimé.
     */
    onDeleted?(id: Estimate['id']): void,
};

type Data = {
    isDeleting: boolean,
};

/** Un devis d'événement dans l'onglet des devis. */
const EventDetailsEstimate = defineComponent({
    name: 'EventDetailsEstimate',
    props: {
        estimate: {
            type: Object as PropType<Props['estimate']>,
            required: true,
        },
        outdated: {
            type: Boolean as PropType<Required<Props>['outdated']>,
            default: false,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onDeleted: {
            type: Function as PropType<Props['onDeleted']>,
            default: undefined,
        },
    },
    emits: ['deleted'],
    data: (): Data => ({
        isDeleting: false,
    }),
    computed: {
        hasTaxes(): boolean {
            const { total_taxes: totalTaxes } = this.estimate;
            return totalTaxes.length > 0;
        },

        userCanDelete(): boolean {
            return this.$store.getters['auth/is']([
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
            ]);
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        async handleDelete() {
            if (!this.userCanDelete || this.isDeleting) {
                return;
            }

            const { __, estimate: { id } } = this;
            const isConfirmed = await confirm({
                type: 'danger',
                text: __('confirm-delete'),
                confirmButtonText: __('global.yes-delete'),
            });
            if (!isConfirmed) {
                return;
            }

            this.isDeleting = true;
            try {
                await apiEstimates.remove(id);

                this.$emit('deleted', id);
                this.$toasted.success(__('deleted'));
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-deleting'));
            } finally {
                this.isDeleting = false;
            }
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.event-details.estimates.item.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            estimate,
            isDeleting,
            userCanDelete,
            handleDelete,
            outdated,
            hasTaxes,
        } = this;

        const {
            url,
            date,
            currency,
            total_without_taxes: totalWithoutTaxes,
        } = estimate;

        const className = ['EventDetailsEstimate', {
            'EventDetailsEstimate--outdated': outdated,
        }];

        return (
            <div class={className}>
                <Icon name="file-signature" class="EventDetailsEstimate__icon" />
                <div class="EventDetailsEstimate__text">
                    {__('title', { date: date.format('L'), hour: date.format('HH:mm') })}<br />
                    <strong>{formatAmount(totalWithoutTaxes, currency)} {hasTaxes && __('global.excl-tax')}</strong>
                </div>
                <div class="EventDetailsEstimate__actions">
                    <Button
                        icon="download"
                        type={!outdated ? 'primary' : 'secondary'}
                        class="EventDetailsEstimate__download"
                        disabled={isDeleting}
                        to={url}
                        download
                    >
                        {__('global.download')}
                    </Button>
                    {userCanDelete && (
                        <Button
                            type="delete"
                            class="EventDetailsEstimate__delete"
                            loading={isDeleting}
                            onClick={handleDelete}
                        />
                    )}
                </div>
            </div>
        );
    },
});

export default EventDetailsEstimate;
