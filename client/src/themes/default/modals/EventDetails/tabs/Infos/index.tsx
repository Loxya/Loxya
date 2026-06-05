import './index.scss';
import DateTime from '@/utils/datetime';
import config, { ReturnPolicy } from '@/globals/config';
import { defineComponent, markRaw } from 'vue';
import { Group } from '@/stores/api/groups';
import Link from '@/themes/default/components/Link';
import Button from '@/themes/default/components/Button';
import Totals from '@/themes/default/components/Totals';

import type Phone from '@/utils/phone';
import type Period from '@/utils/period';
import type { PropType, Raw } from 'vue';
import type { EventDetails, EventTechnician } from '@/stores/api/events';
import type { Beneficiary } from '@/stores/api/beneficiaries';
import type Country from '@/utils/country';

type Props = {
    /** L'événement dont on veut afficher les informations. */
    event: EventDetails,
};

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
};

type Data = {
    now: Raw<DateTime>,
};

/** Onglet "Informations" de la modale de détails d'un événement. */
const EventDetailsInfos = defineComponent({
    name: 'EventDetailsInfos',
    props: {
        event: {
            type: Object as PropType<Props['event']>,
            required: true,
        },
    },
    setup: (): InstanceProperties => ({
        nowTimer: undefined,
    }),
    data: (): Data => ({
        now: markRaw(DateTime.now()),
    }),
    computed: {
        hasBeneficiaries(): boolean {
            return this.event.beneficiaries.length > 0;
        },

        hasTechnicians(): boolean {
            if (!this.isTechniciansEnabled) {
                return false;
            }
            return this.event.technicians.length > 0;
        },

        beneficiaryAddress(): string | null {
            if (!this.hasBeneficiaries) {
                return null;
            }
            const mainBeneficiary = [...this.event.beneficiaries].shift()!;
            const subject = mainBeneficiary.company !== null
                ? mainBeneficiary.company
                : mainBeneficiary;

            let { address } = subject;
            if (address !== null && !subject.country.isSame(config.mainCountry)) {
                address += `\n${subject.country.name}`;
            }
            return address;
        },

        beneficiaryCountry(): Country | null {
            if (!this.hasBeneficiaries) {
                return null;
            }
            const mainBeneficiary = [...this.event.beneficiaries].shift()!;
            const { company } = mainBeneficiary;

            return company === null
                ? mainBeneficiary.country
                : company.country;
        },

        beneficiaryPhone(): Phone | null {
            if (!this.hasBeneficiaries) {
                return null;
            }
            const mainBeneficiary = [...this.event.beneficiaries].shift()!;
            const { company } = mainBeneficiary;

            return company === null || !company.phone
                ? mainBeneficiary.phone
                : company.phone;
        },

        beneficiaryEmail(): string | null {
            if (!this.hasBeneficiaries) {
                return null;
            }
            const mainBeneficiary = [...this.event.beneficiaries].shift()!;
            return mainBeneficiary.email;
        },

        isTeamMember(): boolean {
            return this.$store.getters['auth/is']([
                Group.ADMINISTRATION,
                Group.SUPERVISION,
                Group.OPERATION,
            ]);
        },

        isTechniciansEnabled(): boolean {
            return config.features.technicians;
        },

        arePeriodsUnified(): boolean {
            const {
                operation_period: operationPeriod,
                mobilization_period: mobilizationPeriod,
            } = this.event;

            return operationPeriod
                .setFullDays(false)
                .isSame(mobilizationPeriod);
        },

        uniqueTechnicians(): EventTechnician[] {
            if (!this.isTechniciansEnabled) {
                return [];
            }

            const knownIds = new Set<number>();
            return this.event.technicians.filter(({ technician }: EventTechnician) => {
                if (!technician || knownIds.has(technician.id)) {
                    return false;
                }
                knownIds.add(technician.id);
                return true;
            });
        },

        hasMaterials(): boolean {
            return this.event.materials.length > 0;
        },

        isPast(): boolean {
            return this.event.mobilization_period.isBefore(this.now);
        },

        isEditable(): boolean {
            const { event } = this;

            return (
                // - Un événement archivé n'est pas modifiable.
                !event.is_archived &&

                // - Un événement ne peut être modifié que si son inventaire de retour
                //   n'a pas été effectué (sans quoi celui-ci n'aurait plus aucun sens,
                //   d'autant que le stock global a pu être impacté suite à cet inventaire).
                !event.is_return_inventory_done
            );
        },

        isOverdue(): boolean {
            const useManualReturn = config.returnPolicy === ReturnPolicy.MANUAL;
            if (!this.isPast || !useManualReturn) {
                return false;
            }

            return (
                !this.event.is_archived &&
                !this.event.is_return_inventory_done &&
                this.event.has_materials
            );
        },

        wasOverdue(): boolean {
            const useManualReturn = config.returnPolicy === ReturnPolicy.MANUAL;
            if (!this.isPast || !useManualReturn) {
                return false;
            }

            return (
                this.event.is_return_inventory_done &&
                this.event.return_inventory_datetime !== null &&
                this.event.mobilization_period.end.isBefore(
                    this.event.return_inventory_datetime,
                )
            );
        },

        hasOverdue(): boolean {
            return this.isOverdue || this.wasOverdue;
        },

        overduePeriod(): Period<false> | null {
            if (!this.hasOverdue) {
                return null;
            }

            return (
                this.isOverdue
                    ? this.event.mobilization_period.tail(this.now)
                    : this.event.mobilization_period.tail(
                        this.event.return_inventory_datetime!,
                    )
            ) as Period<false>;
        },
    },
    mounted() {
        // - Actualise le timestamp courant toutes les minutes.
        this.nowTimer = setInterval(() => { this.now = markRaw(DateTime.now()); }, 60_000);
    },
    beforeDestroy() {
        if (this.nowTimer) {
            clearInterval(this.nowTimer);
        }
    },
    render() {
        const {
            $t: __,
            event,
            hasOverdue,
            overduePeriod,
            hasBeneficiaries,
            beneficiaryAddress,
            beneficiaryPhone,
            beneficiaryEmail,
            isTechniciansEnabled,
            arePeriodsUnified,
            hasTechnicians,
            uniqueTechnicians,
            hasMaterials,
            isTeamMember,
            wasOverdue,
            isEditable,
            isOverdue,
            isPast,
        } = this;
        const {
            location,
            beneficiaries,
            author,
            manager,
            description,
            is_confirmed: isConfirmed,
            mobilization_period: mobilizationPeriod,
        } = event;

        const details = ((): JSX.Element[] => {
            const items: JSX.Element[] = [];

            if (location) {
                items.push(
                    <p
                        class={[
                            'EventDetailsInfos__summary__details__item',
                            'EventDetailsInfos__summary__details__item--location',
                        ]}
                    >
                        <span class="EventDetailsInfos__summary__details__item__value">
                            {__('in', { location })}
                            <Link
                                icon="external-link-alt"
                                to={`https://maps.google.com/?q=${location}`}
                                class="EventDetailsInfos__summary__details__item__external-link"
                                tooltip={{ placement: 'bottom', content: __('open-in-google-maps') }}
                                external
                            />
                        </span>
                    </p>,
                );
            }

            if (author) {
                items.push(
                    <p
                        class={[
                            'EventDetailsInfos__summary__details__item',
                            'EventDetailsInfos__summary__details__item--author',
                        ]}
                    >
                        <span class="EventDetailsInfos__summary__details__item__value">
                            {__('modal.event-details.infos.created-by', {
                                author: author.full_name,
                            })}
                        </span>
                    </p>,
                );
            }

            if (manager !== null) {
                items.push(
                    <p
                        class={[
                            'EventDetailsInfos__summary__details__item',
                            'EventDetailsInfos__summary__details__item--manager',
                        ]}
                    >
                        <span class="EventDetailsInfos__summary__details__item__value">
                            {__('modal.event-details.infos.manager', {
                                manager: manager.full_name,
                            })}
                        </span>
                    </p>,
                );
            }

            if (!arePeriodsUnified || hasOverdue) {
                items.push(
                    <p
                        class={[
                            'EventDetailsInfos__summary__details__item',
                            'EventDetailsInfos__summary__details__item--mobilization-period',
                        ]}
                    >
                        <span class="EventDetailsInfos__summary__details__item__value">
                            {__('modal.event-details.infos.mobilization-period', {
                                period: !hasOverdue
                                    ? mobilizationPeriod.toReadable(__)
                                    : __('modal.event-details.infos.initially-planned-period', {
                                        period: mobilizationPeriod.toReadable(__),
                                    }),
                            })}
                        </span>
                    </p>,
                );
            }

            if (isOverdue) {
                items.push(
                    <p
                        class={[
                            'EventDetailsInfos__summary__details__item',
                            'EventDetailsInfos__summary__details__item--ongoing-overdue',
                        ]}
                    >
                        <span class="EventDetailsInfos__summary__details__item__value">
                            {__('modal.event-details.infos.overdue-since', {
                                duration: overduePeriod!.toReadableDuration(__),
                            })}
                        </span>
                    </p>,
                );
            }

            if (!isOverdue && wasOverdue) {
                items.push(
                    <p
                        class={[
                            'EventDetailsInfos__summary__details__item',
                            'EventDetailsInfos__summary__details__item--past-overdue',
                        ]}
                    >
                        <span class="EventDetailsInfos__summary__details__item__value">
                            {__('modal.quick-scan.late-return-on', {
                                date: event.return_inventory_datetime!.toReadable(),
                                duration: overduePeriod!.toReadableDuration(__),
                            })}
                        </span>
                    </p>,
                );
            }

            if (isTechniciansEnabled && hasTechnicians) {
                items.push(
                    <p
                        class={[
                            'EventDetailsInfos__summary__details__item',
                            'EventDetailsInfos__summary__details__item--technicians',
                        ]}
                    >
                        <div class="EventDetailsInfos__summary__details__item__value">
                            <span class="EventDetailsInfos__summary__technician-label">
                                {__('modal.event-details.infos.with-technicians')}
                            </span>
                            <ul class="EventDetailsInfos__summary__technicians">
                                {uniqueTechnicians.map(({ id, technician }: EventTechnician) => (
                                    <li key={id} class="EventDetailsInfos__summary__technicians__item">
                                        {!isTeamMember ? technician.full_name : (
                                            <router-link
                                                to={{ name: 'view-technician', params: { id: technician.id } }}
                                                title={__('action-view')}
                                            >
                                                {technician.full_name}
                                            </router-link>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </p>,
                );
            }

            return items;
        })();

        return (
            <div class="EventDetailsInfos">
                <div class="EventDetailsInfos__main">
                    <div class="EventDetailsInfos__summary">
                        {hasBeneficiaries && (
                            <div class="EventDetailsInfos__summary__beneficiary">
                                <div class="EventDetailsInfos__summary__beneficiary__content">
                                    <ul class="EventDetailsInfos__summary__beneficiary__names">
                                        {beneficiaries.map((beneficiary: Beneficiary) => {
                                            const { company, full_name: fullName } = beneficiary;
                                            return (
                                                <li class="EventDetailsInfos__summary__beneficiary__names__item">
                                                    <span class="EventDetailsInfos__summary__beneficiary__names__item__name">
                                                        {`${fullName}${company ? ` (${company.legal_name})` : ''}`}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {!!(beneficiaryAddress || beneficiaryPhone || beneficiaryEmail) && (
                                        <div class="EventDetailsInfos__summary__beneficiary__infos">
                                            {!!beneficiaryAddress && (
                                                <address class="EventDetailsInfos__summary__beneficiary__address">
                                                    {beneficiaryAddress}
                                                </address>
                                            )}
                                            {!!(beneficiaryPhone || beneficiaryEmail) && (
                                                <div class="EventDetailsInfos__summary__beneficiary__reachability">
                                                    {!!beneficiaryPhone && (
                                                        <p class="EventDetailsInfos__summary__beneficiary__phone">
                                                            {__('modal.event-details.infos.beneficiary-phone')}{' '}
                                                            <a href={beneficiaryPhone.toURI()}>{beneficiaryPhone.toReadable()}</a>
                                                        </p>
                                                    )}
                                                    {!!beneficiaryEmail && (
                                                        <p class="EventDetailsInfos__summary__beneficiary__email">
                                                            {__('modal.event-details.infos.beneficiary-email')}{' '}
                                                            <a href={`mailto:${beneficiaryEmail}`}>{beneficiaryEmail}</a>
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                        {!hasBeneficiaries && (
                            <div class="EventDetailsInfos__summary__no-beneficiary">
                                {__('@event.warning-no-beneficiary')}
                            </div>
                        )}
                        {details.length > 0 && (
                            <div class="EventDetailsInfos__summary__details">
                                {details}
                            </div>
                        )}
                    </div>
                    {description && (
                        <div class="EventDetailsInfos__description">
                            <p class="EventDetailsInfos__description__content">
                                {description}
                            </p>
                        </div>
                    )}
                    {isOverdue && (
                        <div class="EventDetailsInfos__overdue">
                            {__('modal.event-details.infos.warning-overdue', {
                                date: event.mobilization_period.end.toReadable(),
                                duration: overduePeriod!.toReadableDuration(__),
                            })}
                        </div>
                    )}
                    {!hasMaterials && (
                        <div class="EventDetailsInfos__no-material">
                            {__('@event.warning-no-material')}
                            {(isTeamMember && isEditable && !isPast) && (
                                <p>
                                    <Button
                                        type="primary"
                                        to={{
                                            name: 'edit-event',
                                            params: { id: event.id.toString() },
                                        }}
                                        icon="edit"
                                    >
                                        {__('modal.event-details.edit')}
                                    </Button>
                                </p>
                            )}
                        </div>
                    )}
                    {hasMaterials && !isPast && (
                        <div
                            class={[
                                'EventDetailsInfos__confirmation',
                                { 'EventDetailsInfos__confirmation--confirmed': isConfirmed },
                            ]}
                        >
                            {(
                                isConfirmed
                                    ? __('@event.event-confirmed-help')
                                    : __('@event.event-not-confirmed-help')
                            )}
                        </div>
                    )}
                </div>
                <Totals
                    class="EventDetailsInfos__totals"
                    booking={event}
                    withDuration
                />
            </div>
        );
    },
});

export default EventDetailsInfos;
