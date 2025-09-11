import './index.scss';
import Period from '@/utils/period';
import DateTime from '@/utils/datetime';
import apiEvents from '@/stores/api/events';
import apiRoles from '@/stores/api/roles';
import stringCompare from '@/utils/stringCompare';
import formatOptions from '@/utils/formatOptions';
import { ApiErrorCode } from '@/stores/api/@codes';
import { RequestError } from '@/globals/requester';
import { defineComponent, markRaw } from 'vue';
import Button from '@/themes/default/components/Button';
import FormField from '@/themes/default/components/FormField';
import { MIN_TECHNICIAN_ASSIGNMENT_DURATION } from '@/globals/constants';

import type { PropType } from 'vue';
import type { TechnicianWithEvents } from '@/stores/api/technicians';
import type { Options } from '@/utils/formatOptions';
import type { DisableDateFunction } from '@/themes/default/components/DatePicker';
import type { Role } from '@/stores/api/roles';
import type { EventDetails, EventAssignmentEdit } from '@/stores/api/events';

type Props = {
    /** L'événement en cours d'édition. */
    event: EventDetails,

    /** Le technicien que l'on souhaite assigner à l'événement. */
    technician: TechnicianWithEvents,

    /** La date de début d'assignation à utiliser par défaut (si disponible). */
    defaultStartDate?: DateTime,
};

type EditData = Omit<EventAssignmentEdit, 'technician_id'>;

type Data = {
    data: EditData,
    isSaving: boolean,
    isCreatingRole: boolean,
    validationErrors: Record<string, string> | null,
    additionalRoles: Role[],
};

/**
 * Modale d'édition de création d'une assignation d'un technician
 * à l'étape 3 de l'édition d'un événement.
 */
const EventEditStepTechniciansAssignmentCreation = defineComponent({
    name: 'EventEditStepTechniciansAssignmentCreation',
    modal: {
        width: 600,
        clickToClose: false,
    },
    provide: {
        verticalForm: true,
    },
    props: {
        event: {
            type: Object as PropType<Props['event']>,
            required: true,
        },
        technician: {
            type: Object as PropType<Props['technician']>,
            required: true,
        },
        defaultStartDate: {
            type: DateTime as PropType<Props['defaultStartDate']>,
            default: undefined,
        },
    },
    emits: ['close'],
    data(): Data {
        const data: EditData = {
            role_id: null,
            period: this.defaultStartDate !== undefined
                ? markRaw(new Period(
                    this.defaultStartDate,
                    this.defaultStartDate.add(MIN_TECHNICIAN_ASSIGNMENT_DURATION),
                ))
                : null,
        };

        return {
            data,
            isSaving: false,
            isCreatingRole: false,
            validationErrors: null,
            additionalRoles: [],
        };
    },
    computed: {
        allRoles(): Role[] {
            return this.$store.state.roles.list ?? [];
        },

        selectableRoles(): Role[] {
            const { allRoles, technician } = this;
            const possibleRoleIds = new Set(technician.roles.map(({ id }: Role) => id));
            return allRoles.filter(({ id }: Role) => possibleRoleIds.has(id));
        },

        rolesOptions(): Options<Role> {
            const { selectableRoles, additionalRoles } = this;

            const roles = [
                ...selectableRoles,

                // - On ajoute les rôles additionnels qui ne font pas
                //   partie des rôles sélectionnables (demandés explicitement,
                //   ajoutés à la volée, ...).
                ...additionalRoles,
            ];
            roles.sort((a: Role, b: Role) => (
                stringCompare(a.name, b.name)
            ));

            return formatOptions(roles);
        },

        name(): string {
            return this.technician.full_name;
        },

        assignationPeriod(): Period<false> {
            return this.event.mobilization_period
                .merge(this.event.operation_period)
                .setFullDays(false);
        },

        disabledDateFactory(): DisableDateFunction {
            const { assignationPeriod } = this;

            return (date: DateTime, granularity: 'day' | 'minute'): boolean => (
                // - Si la date est avant le début de la période d'assignation => Désactivée.
                date.isBefore(assignationPeriod.start, granularity) ||

                // - Si la date est après la fin de la période d'assignation => Désactivée.
                date.isAfter(assignationPeriod.end, granularity)
            );
        },
    },
    watch: {
        selectableRoles() {
            const existingIds = new Set(this.selectableRoles.map(({ id }: Role) => id));
            this.additionalRoles = this.additionalRoles.filter(({ id }: Role) => !existingIds.has(id));
        },
    },
    created() {
        this.$store.dispatch('roles/fetch');
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSubmit(e: Event) {
            e?.preventDefault();

            this.save();
        },

        handleClose() {
            this.$emit('close', undefined);
        },

        async handleCreateRole(name: string) {
            if (this.isCreatingRole) {
                return;
            }
            this.isCreatingRole = true;
            const { __, allRoles, selectableRoles } = this;

            const existingRole = allRoles.find((_role: Role) => (
                _role.name.toLocaleLowerCase() === name.toLocaleLowerCase()
            ));
            if (existingRole !== undefined) {
                // - Si ce n'est un rôle déjà sélectionnable, on l'ajoute aux rôles additionnels.
                if (!selectableRoles.includes(existingRole)) {
                    this.additionalRoles.push(existingRole);
                }

                this.data.role_id = existingRole.id;
                this.isCreatingRole = false;
                return;
            }

            try {
                const newRole = await apiRoles.create({ name });
                this.$store.dispatch('roles/refresh');

                this.additionalRoles.push(newRole);
                this.data.role_id = newRole.id;

                this.$toasted.success(__('global.quick-creation.role.success', { name: newRole.name }));
            } catch {
                this.$toasted.error(__('global.quick-creation.role.failure'));
            } finally {
                this.isCreatingRole = false;
            }
        },

        // ------------------------------------------------------
        // -
        // -    Methods
        // -
        // ------------------------------------------------------

        async save() {
            if (this.isSaving) {
                return;
            }
            this.isSaving = true;
            const { __, event } = this;

            try {
                const data: EventAssignmentEdit = { ...this.data, technician_id: this.technician.id };
                const assignment = await apiEvents.createAssignment(event.id, data);
                this.validationErrors = null;

                this.$toasted.success(__('assignation-saved'));
                this.$emit('close', assignment);
            } catch (error) {
                this.isSaving = false;

                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the assignment`, error);
                this.$toasted.error(__('global.errors.unexpected-while-saving'));
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.event-edit.steps.technicians.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            name,
            data,
            isSaving,
            rolesOptions,
            validationErrors,
            disabledDateFactory,
            handleCreateRole,
            handleSubmit,
            handleClose,
        } = this;

        return (
            <div class="EventEditStepTechniciansAssignmentCreation">
                <header class="EventEditStepTechniciansAssignmentCreation__header">
                    <h2 class="EventEditStepTechniciansAssignmentCreation__header__title">
                        {__('assign-technician', { name })}
                    </h2>
                    <Button
                        type="close"
                        class="EventEditStepTechniciansAssignmentCreation__header__close-button"
                        onClick={handleClose}
                    />
                </header>
                <div class="EventEditStepTechniciansAssignmentCreation__body">
                    <form class="EventEditStepTechniciansAssignmentCreation__form" onSubmit={handleSubmit}>
                        <FormField
                            type="datetime"
                            v-model={data.period}
                            label={__('period-assigned')}
                            placeholder={__('start-end-dates-and-time')}
                            error={validationErrors?.period}
                            disabledDate={disabledDateFactory}
                            range
                        />
                        <FormField
                            type="select"
                            options={rolesOptions}
                            v-model={data.role_id}
                            label={`${__('global.position-held')} (${__('global.optional')})`}
                            error={validationErrors?.role_id}
                            onCreate={handleCreateRole}
                            canCreate
                        />
                    </form>
                </div>
                <div class="EventEditStepTechniciansAssignmentCreation__footer">
                    <Button type="primary" onClick={handleSubmit} loading={isSaving}>
                        {isSaving ? __('global.saving') : __('assign-name', { name })}
                    </Button>
                </div>
            </div>
        );
    },
});

export default EventEditStepTechniciansAssignmentCreation;
