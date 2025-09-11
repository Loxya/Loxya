import './index.scss';
import Day, { DayReadableFormat } from '@/utils/day';
import { DateTimeReadableFormat } from '@/utils/datetime';
import { defineComponent } from 'vue';
import Button from '@/themes/default/components/Button';
import MultiSwitch from '@/themes/default/components/MultiSwitch';
import { DisplayGroup } from '../Inventory';

import type DateTime from '@/utils/datetime';
import type { PropType } from 'vue';
import type { EventDetails } from '@/stores/api/events';
import type { Beneficiary } from '@/stores/api/beneficiaries';

type Props = {
    /** L'événement concerné par l'inventaire de départ. */
    event: EventDetails,

    /** L'affichage par groupe actuellement utilisé. */
    displayGroup: DisplayGroup,

    /** Doit-on afficher le sélecteur d'affichage par groupe ? */
    showDisplayGroupSelector: boolean,

    /** Doit-on afficher le bouton de modification du matériel ? */
    showMaterialEditAction: boolean,

    /**
     * Fonction appelée lorsque l'affichage par groupe a changé.
     *
     * @param newGroup - Le nouvel affichage par groupe sélectionné
     */
    onDisplayGroupChange?(newGroup: DisplayGroup): void,

    /**
     * Fonction appelée lorsque l'utilisateur demande à accéder
     * à la modification du matériel de l'événement.
     */
    onUpdateMaterialClick?(): void,
};

/** Header de la page d'inventaire de départ d'événement. */
const EventDepartureHeader = defineComponent({
    name: 'EventDepartureHeader',
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
        showMaterialEditAction: {
            type: Boolean as PropType<Required<Props>['showMaterialEditAction']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onDisplayGroupChange: {
            type: Function as PropType<Props['onDisplayGroupChange']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onUpdateMaterialClick: {
            type: Function as PropType<Props['onUpdateMaterialClick']>,
            default: undefined,
        },
    },
    emits: [
        'displayGroupChange',
        'updateMaterialClick',
    ],
    computed: {
        // hasMultipleParks(): boolean {
        //     return this.$store.state.parks.list.length > 1;
        // },

        startDate(): DateTime | Day {
            // NOTE: On utilise la date de début d'événement pour la date de
            //       début (et non la date de début de mobilisation).
            return this.event.operation_period.start;
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

        handleUpdateMaterialClick() {
            this.$emit('updateMaterialClick');
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.event-departure.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            event,
            startDate,
            mainBeneficiary,
            displayGroup,
            showMaterialEditAction,
            showDisplayGroupSelector,
            // hasMultipleParks,
            handleDisplayGroupChange,
            handleUpdateMaterialClick,
        } = this;

        return (
            <div class="EventDepartureHeader">
                <dl class="EventDepartureHeader__infos">
                    <div class="EventDepartureHeader__infos__item">
                        <dt class="EventDepartureHeader__infos__item__name">
                            {__('global.start-on')}
                        </dt>
                        <dd class="EventDepartureHeader__infos__item__value">
                            {(
                                startDate instanceof Day
                                    ? startDate.toReadable(DayReadableFormat.LONG)
                                    : startDate.toReadable(DateTimeReadableFormat.LONG)
                            )}
                        </dd>
                    </div>
                    {mainBeneficiary !== null && (
                        <div class="EventDepartureHeader__infos__item">
                            <dt class="EventDepartureHeader__infos__item__name">
                                {__('global.main-beneficiary')}
                            </dt>
                            <dd class="EventDepartureHeader__infos__item__value">
                                <span class="EventDepartureHeader__infos__main-beneficiary">
                                    <span class="EventDepartureHeader__infos__main-beneficiary__name">
                                        {`${mainBeneficiary.full_name}${mainBeneficiary.company ? ` (${mainBeneficiary.company.legal_name})` : ''}`}
                                    </span>
                                </span>
                            </dd>
                        </div>
                    )}
                    {!!event.location && (
                        <div class="EventDepartureHeader__infos__item">
                            <dt class="EventDepartureHeader__infos__item__name">
                                {__('global.location')}
                            </dt>
                            <dd class="EventDepartureHeader__infos__item__value">
                                {event.location}
                            </dd>
                        </div>
                    )}
                </dl>
                {(showMaterialEditAction || showDisplayGroupSelector) && (
                    <div class="EventDepartureHeader__actions">
                        {showDisplayGroupSelector && (
                            <div class="EventDepartureHeader__group-by">
                                <span class="EventDepartureHeader__group-by__label">{__('global.grouped-by')}</span>
                                <span class="EventDepartureHeader__group-by__input">
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
                        {showMaterialEditAction && (
                            <div class="EventDepartureHeader__buttons">
                                <Button
                                    type="secondary"
                                    icon="edit"
                                    onClick={handleUpdateMaterialClick}
                                >
                                    {__('actions.update-materials')}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    },
});

export default EventDepartureHeader;
