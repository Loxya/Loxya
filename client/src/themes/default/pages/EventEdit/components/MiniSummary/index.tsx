import './index.scss';
import Decimal from 'decimal.js';
import { defineComponent } from 'vue';
import config, { BillingMode } from '@/globals/config';
import formatAmount from '@/utils/formatAmount';
import Icon from '@/themes/default/components/Icon';
import Fragment from '@/components/Fragment';
import IconMessage from '@/themes/default/components/IconMessage';

import type Currency from '@/utils/currency';
import type { PropType } from 'vue';
import type { EventDetails } from '@/stores/api/events';

type Props = {
    /**
     * L'événement en cours d'édition.
     *
     * Si l'événement n'a pas encore été sauvegardé, cette prop. doit être à `null`.
     */
    event: EventDetails | null,

    /**
     * L'édition en cours est-t'elle "dirty" ?
     *
     * On entend par "dirty" des données modifiées mais pas encore persistées.
     */
    isDirty: boolean,
};

/** Résumé rapide de l'événement en cours d'édition.  */
const EventEditMiniSummary = defineComponent({
    name: 'EventEditMiniSummary',
    props: {
        event: {
            type: Object as PropType<Props['event']>,
            default: null,
        },
        isDirty: {
            type: Boolean as PropType<Props['isDirty']>,
            required: true,
        },
    },
    computed: {
        duration(): number | undefined {
            return this.event?.operation_period.asDays();
        },

        isConfirmed(): boolean {
            return this.event?.is_confirmed ?? false;
        },

        showBillingAmounts(): boolean {
            return this.event !== null
                ? this.event.is_billable
                : config.billingMode !== BillingMode.NONE;
        },

        hasTaxes(): boolean {
            if (this.event === null || !this.event.is_billable) {
                return false;
            }

            const { total_taxes: totalTaxes } = this.event;
            return totalTaxes.length > 0;
        },

        totalWithoutTaxes(): Decimal | undefined {
            if (!this.showBillingAmounts) {
                return undefined;
            }

            return this.event?.is_billable
                ? this.event.total_without_taxes
                : new Decimal(0);
        },

        currency(): Currency {
            return this.event !== null
                ? this.event.currency
                : config.currency;
        },
    },
    render() {
        const {
            $t: __,
            event,
            duration,
            currency,
            hasTaxes,
            isDirty,
            isConfirmed,
            totalWithoutTaxes,
            showBillingAmounts,
        } = this;

        return (
            <div
                class={['EventEditMiniSummary', {
                    'EventEditMiniSummary--confirmed': isConfirmed,
                    'EventEditMiniSummary--not-saved': isDirty,
                }]}
            >
                {isDirty && (
                    <Icon
                        name="exclamation-triangle"
                        class="EventEditMiniSummary__not-saved"
                        tooltip={{
                            placement: 'right',
                            content: __('page.event-edit.not-saved'),
                        }}
                    />
                )}
                <div class="EventEditMiniSummary__content">
                    {event !== null && (
                        <Fragment>
                            <div class="EventEditMiniSummary__title">
                                {event.title}
                            </div>
                            {!!(event?.location && event.location.length > 0) && (
                                <div class="EventEditMiniSummary__detail">
                                    {__('in', { location: event.location })}
                                </div>
                            )}
                            <div class="EventEditMiniSummary__detail">
                                {event.operation_period.toReadable(__)}
                                <br />
                                {__('duration-days', { duration }, duration)}
                            </div>
                        </Fragment>
                    )}
                    {showBillingAmounts && (
                        <div class="EventEditMiniSummary__total">
                            {__(hasTaxes ? 'total-without-taxes' : 'total')}{' '}
                            <strong>{formatAmount(totalWithoutTaxes, currency)}</strong>
                        </div>
                    )}
                    <div class="EventEditMiniSummary__detail">
                        <IconMessage
                            name={isConfirmed ? 'check' : 'question-circle'}
                            message={isConfirmed ? __('confirmed') : __('not-confirmed')}
                        />
                    </div>
                </div>
            </div>
        );
    },
});

export default EventEditMiniSummary;
