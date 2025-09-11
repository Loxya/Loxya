import './index.scss';
import apiEvents from '@/stores/api/events';
import apiRoles from '@/stores/api/roles';
import stringCompare from '@/utils/stringCompare';
import formatOptions from '@/utils/formatOptions';
import { confirm } from '@/utils/alert';
import { defineComponent } from 'vue';
import { ApiErrorCode } from '@/stores/api/@codes';
import { RequestError } from '@/globals/requester';
import Button from '@/themes/default/components/Button';
import FormField from '@/themes/default/components/FormField';

import type Period from '@/utils/period';
import type DateTime from '@/utils/datetime';
import type { PropType } from 'vue';
import type { Options } from '@/utils/formatOptions';
import type { DisableDateFunction } from '@/themes/default/components/DatePicker';
import type { Role } from '@/stores/api/roles';
import type {
    EventDetails,
    EventTechnician,
    EventAssignmentEdit,
} from '@/stores/api/events';

type Props = {
    /** L'événement en cours d'édition. */
    event: EventDetails,

    /** L'assignation à éditer. */
    assignment: EventTechnician,
};

type EditData = Omit<EventAssignmentEdit, 'technician_id'>;

type Data = {
    data: EditData,
    isSaving: boolean,
    isDeleting: boolean,
    isCreatingRole: boolean,
    validationErrors: Record<string, string> | null,
    additionalRoles: Role[],
};

/**
 * Modale d'édition de l'assignation d'un technician à
 * l'étape 3 de l'édition d'un événement.
 */
const EventEditStepTechniciansAssignmentEdition = defineComponent({
    name: 'EventEditStepTechniciansAssignmentEdition',
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
        assignment: {
            type: Object as PropType<Props['assignment']>,
            required: true,
        },
    },
    emits: ['close'],
    data(): Data {
        return {
            data: {
                period: this.assignment.period,
                role_id: this.assignment.role?.id ?? null,
            },
            isSaving: false,
            isDeleting: false,
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
            const { allRoles, assignment } = this;

            const possibleRoleIds = new Set(assignment.technician.roles.map(({ id }: Role) => id));
            if (assignment.role !== null) {
                possibleRoleIds.add(assignment.role.id);
            }

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
            return this.assignment.technician.full_name;
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
    mounted() {
        this.$store.dispatch('roles/fetch');
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

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

        handleSubmit(e: Event) {
            e?.preventDefault();

            this.save();
        },

        handleClose() {
            this.$emit('close', undefined);
        },

        handleDelete() {
            this.remove();
        },

        // ------------------------------------------------------
        // -
        // -    Methods
        // -
        // ------------------------------------------------------

        async save() {
            if (this.isSaving || this.isDeleting) {
                return;
            }
            this.isSaving = true;
            const { __, event, assignment } = this;

            try {
                const data: EventAssignmentEdit = { ...this.data, technician_id: assignment.technician_id };
                const updatedAssignment = await apiEvents.updateAssignment(event.id, assignment.id, data);
                this.validationErrors = null;

                this.$toasted.success(__('assignation-saved'));
                this.$emit('close', updatedAssignment);
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

        async remove() {
            if (this.isDeleting || this.isSaving) {
                return;
            }
            this.isDeleting = true;
            const { __, event, assignment } = this;

            const isConfirmed = await confirm({
                type: 'danger',
                text: __('technician-item.confirm-permanently-delete'),
                confirmButtonText: __('global.yes-permanently-delete'),
            });
            if (!isConfirmed) {
                this.isDeleting = false;
                return;
            }

            try {
                await apiEvents.deleteAssignment(event.id, assignment.id);

                this.$toasted.success(__('assignation-removed'));
                this.$emit('close', null);
            } catch {
                this.$toasted.error(__('global.errors.unexpected-while-deleting'));
                this.isDeleting = false;
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
            rolesOptions,
            isSaving,
            isDeleting,
            validationErrors,
            disabledDateFactory,
            handleCreateRole,
            handleSubmit,
            handleClose,
            handleDelete,
        } = this;

        return (
            <div class="EventEditStepTechniciansAssignmentEdition">
                <header class="EventEditStepTechniciansAssignmentEdition__header">
                    <h2 class="EventEditStepTechniciansAssignmentEdition__header__title">
                        {__('assign-technician', { name })}
                    </h2>
                    <Button
                        type="close"
                        class="EventEditStepTechniciansAssignmentEdition__header__close-button"
                        onClick={handleClose}
                    />
                </header>
                <div class="EventEditStepTechniciansAssignmentEdition__body">
                    <form class="Form EventEditStepTechniciansAssignmentEdition__form" onSubmit={handleSubmit}>
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
                <div class="EventEditStepTechniciansAssignmentEdition__footer">
                    <Button type="primary" loading={isSaving} onClick={handleSubmit}>
                        {isSaving ? __('global.saving') : __('modify-assignment')}
                    </Button>
                    <Button type="delete" loading={isDeleting} onClick={handleDelete}>
                        {isDeleting ? __('global.deleting') : __('remove-assignment')}
                    </Button>
                </div>
            </div>
        );
    },
});

export default EventEditStepTechniciansAssignmentEdition;
