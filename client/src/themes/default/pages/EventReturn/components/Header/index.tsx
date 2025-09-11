import './index.scss';
import Day, { DayReadableFormat } from '@/utils/day';
import { DateTimeReadableFormat } from '@/utils/datetime';
import { defineComponent } from 'vue';
import MultiSwitch from '@/themes/default/components/MultiSwitch';
import { DisplayGroup } from '../Inventory';

import type DateTime from '@/utils/datetime';
import type { PropType } from 'vue';
import type { EventDetails } from '@/stores/api/events';
import type { Beneficiary } from '@/stores/api/beneficiaries';

type Props = {
    /** L'événement concerné par l'inventaire de retour. */
    event: EventDetails,

    /** L'affichage par groupe actuellement utilisé. */
    displayGroup: DisplayGroup,

    /** Doit-on afficher le sélecteur d'affichage par groupe ? */
    showDisplayGroupSelector: boolean,

    /**
     * Fonction appelée lorsque l'affichage par groupe a changé.
     *
     * @param newGroup - Le nouvel affichage par groupe sélectionné
     */
    onDisplayGroupChange?(newGroup: DisplayGroup): void,
};

/** Header de la page d'inventaire de retour d'événement. */
const EventReturnHeader = defineComponent({
    name: 'EventReturnHeader',
    props: {
        event: {
            type: Object as PropType<Props['event']>,
            required: true,
        },
        displayGroup: {
            type: String as PropType<Required<Props>['displayGroup']>,
            required: true,
            validator: (displayGroup: unknown): boolean => (
                typeof displayGroup === 'string' &&
                (Object.values(DisplayGroup) as string[]).includes(displayGroup)
            ),
        },
        showDisplayGroupSelector: {
            type: Boolean as PropType<Required<Props>['showDisplayGroupSelector']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onDisplayGroupChange: {
            type: Function as PropType<Props['onDisplayGroupChange']>,
            default: undefined,
        },
    },
    emits: ['displayGroupChange'],
    computed: {
        // hasMultipleParks(): boolean {
        //     return this.$store.state.parks.list.length > 1;
        // },

        endDate(): DateTime | Day {
            // NOTE: On utilise la date de fin d'événement pour la date de
            //       fin prévue (et non la date de fin de mobilisation).
            return this.event.operation_period.end;
        },

        mainBeneficiary(): Beneficiary | null {
            const { event } = this;

            return event.beneficiaries.length > 0
                ? ([...event.beneficiaries].shift() ?? null)
                : null;
        },
    },
    created() {
        // this.$store.dispatch('parks/fetch');
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleDisplayGroupChange(newGroup: DisplayGroup) {
            if (newGroup === this.displayGroup) {
                return;
            }
            this.$emit('displayGroupChange', newGroup);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.event-return.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            event,
            endDate,
            mainBeneficiary,
            displayGroup,
            showDisplayGroupSelector,
            // hasMultipleParks,
            handleDisplayGroupChange,
        } = this;

        return (
            <div class="EventReturnHeader">
                <dl class="EventReturnHeader__infos">
                    <div class="EventReturnHeader__infos__item">
                        <dt class="EventReturnHeader__infos__item__name">
                            {__('global.expected-end-on')}
                        </dt>
                        <dd class="EventReturnHeader__infos__item__value">
                            {(
                                endDate instanceof Day
                                    ? endDate.toReadable(DayReadableFormat.LONG)
                                    : endDate.toReadable(DateTimeReadableFormat.LONG)
                            )}
                        </dd>
                    </div>
                    {mainBeneficiary !== null && (
                        <div class="EventReturnHeader__infos__item">
                            <dt class="EventReturnHeader__infos__item__name">
                                {__('global.main-beneficiary')}
                            </dt>
                            <dd class="EventReturnHeader__infos__item__value">
                                <span class="EventReturnHeader__infos__main-beneficiary">
                                    <span class="EventReturnHeader__infos__main-beneficiary__name">
                                        {`${mainBeneficiary.full_name}${mainBeneficiary.company ? ` (${mainBeneficiary.company.legal_name})` : ''}`}
                                    </span>
                                </span>
                            </dd>
                        </div>
                    )}
                    {!!event.location && (
                        <div class="EventReturnHeader__infos__item">
                            <dt class="EventReturnHeader__infos__item__name">
                                {__('global.location')}
                            </dt>
                            <dd class="EventReturnHeader__infos__item__value">
                                {event.location}
                            </dd>
                        </div>
                    )}
                </dl>
                {showDisplayGroupSelector && (
                    <div class="EventReturnHeader__group-by">
                        <span class="EventReturnHeader__group-by__label">{__('global.grouped-by')}</span>
                        <span class="EventReturnHeader__group-by__input">
                            <MultiSwitch
                                options={[
                                    { value: DisplayGroup.CATEGORIES, label: __('global.categories') },
                                    // { value: DisplayGroup.PARKS, label: __('global.parks'), isDisplayed: hasMultipleParks },
                                    { value: DisplayGroup.NONE, label: __('global.not-grouped') },
                                ]}
                                value={displayGroup}
                                onChange={handleDisplayGroupChange}
                            />
                        </span>
                    </div>
                )}
            </div>
        );
    },
});

export default EventReturnHeader;
