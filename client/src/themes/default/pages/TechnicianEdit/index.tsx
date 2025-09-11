import './index.scss';
import config from '@/globals/config';
import { RequestError, HttpCode } from '@/globals/requester';
import { defineComponent } from 'vue';
import { ApiErrorCode } from '@/stores/api/@codes';
import Page from '@/themes/default/components/Page';
import CriticalError, { ErrorType } from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import Form from './components/Form';
import apiTechnicians from '@/stores/api/technicians';
import parseInteger from '@/utils/parseInteger';

import type { ComponentRef } from 'vue';
import type {
    TechnicianDetails,
    TechnicianEdit as TechnicianEditType,
} from '@/stores/api/technicians';

type Data = {
    id: number | null,
    isFetched: boolean,
    isSaving: boolean,
    technician: TechnicianDetails | null,
    criticalError: ErrorType | null,
    validationErrors: Record<keyof TechnicianEditType, string> | null,
};

/** Page d'edition d'un technicien. */
const TechnicianEdit = defineComponent({
    name: 'TechnicianEdit',
    data(): Data {
        return {
            id: parseInteger(this.$route.params.id),
            isFetched: false,
            isSaving: false,
            technician: null,
            criticalError: null,
            validationErrors: null,
        };
    },
    computed: {
        isEnabled(): boolean {
            return config.features.technicians;
        },

        isNew(): boolean {
            return this.id === null;
        },

        pageTitle(): string {
            const { $t: __, isNew, isFetched, technician } = this;

            if (isNew) {
                return __('page.technician-edit.title-create');
            }

            if (!isFetched || !technician) {
                return __('page.technician-edit.title-edit-simple');
            }

            return __('page.technician-edit.title-edit', { name: technician.full_name });
        },
    },
    errorCaptured(error: unknown) {
        this.criticalError = ErrorType.UNKNOWN;

        // eslint-disable-next-line no-console
        console.error(error);

        return false;
    },
    mounted() {
        if (!this.isEnabled) {
            this.$router.replace({ name: 'home' });
        }

        this.fetchData();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSubmit(data: TechnicianEditType) {
            this.save(data);
        },

        handleCancel() {
            this.$router.back();
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData() {
            if (this.isNew) {
                this.isFetched = true;
                return;
            }

            try {
                this.technician = await apiTechnicians.one(this.id!);
                this.isFetched = true;
            } catch (error) {
                if (error instanceof RequestError && error.httpCode === HttpCode.NotFound) {
                    this.criticalError = ErrorType.NOT_FOUND;
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving technician #${this.id!} data`, error);
                this.criticalError = ErrorType.UNKNOWN;
            }
        },

        async save(data: TechnicianEditType) {
            if (this.isSaving) {
                return;
            }

            const { $t: __ } = this;
            this.isSaving = true;

            const doRequest = (): Promise<TechnicianDetails> => (
                !this.isNew
                    ? apiTechnicians.update(this.id!, data)
                    : apiTechnicians.create(data)
            );

            try {
                const technician = await doRequest();
                if (!this.isNew) {
                    this.technician = technician;
                }

                this.validationErrors = null;

                // - Redirection...
                this.$toasted.success(__('page.technician-edit.saved'));
                this.$router.replace({ name: 'view-technician', params: { id: technician.id.toString() } });
            } catch (error) {
                this.isSaving = false;

                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    (this.$refs.page as ComponentRef<typeof Page>)?.scrollToTop();
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the technician`, error);
                this.$toasted.error(__('errors.unexpected-while-saving'));
            }
        },
    },
    render() {
        const {
            pageTitle,
            isSaving,
            isFetched,
            technician,
            handleSubmit,
            handleCancel,
            criticalError,
            validationErrors,
        } = this;

        if (criticalError || !isFetched) {
            return (
                <Page name="technician-edit" title={pageTitle} centered>
                    {criticalError ? <CriticalError type={criticalError} /> : <Loading />}
                </Page>
            );
        }

        return (
            <Page
                ref="page"
                title={pageTitle}
                name="technician-edit"
                hasValidationError={!!validationErrors}
            >
                <div class="TechnicianEdit">
                    <Form
                        savedData={technician}
                        isSaving={isSaving}
                        errors={validationErrors}
                        onSubmit={handleSubmit}
                        onCancel={handleCancel}
                    />
                </div>
            </Page>
        );
    },
});

export default TechnicianEdit;
