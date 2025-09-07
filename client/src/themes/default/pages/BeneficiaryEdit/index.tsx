import './index.scss';
import { defineComponent } from 'vue';
import parseInteger from '@/utils/parseInteger';
import { ApiErrorCode } from '@/stores/api/@codes';
import apiBeneficiaries from '@/stores/api/beneficiaries';
import { RequestError, HttpCode } from '@/globals/requester';
import Page from '@/themes/default/components/Page';
import CriticalError, { ErrorType } from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import Form from './components/Form';

import type { ComponentRef } from 'vue';
import type {
    BeneficiaryDetails as Beneficiary,
    BeneficiaryEdit as BeneficiaryEditType,
} from '@/stores/api/beneficiaries';

type Data = {
    id: Beneficiary['id'] | null,
    isFetched: boolean,
    isSaving: boolean,
    beneficiary: Beneficiary | null,
    criticalError: ErrorType | null,
    validationErrors: Record<string, string> | null,
};

/** Page d'edition d'un bénéficiaire. */
const BeneficiaryEdit = defineComponent({
    name: 'BeneficiaryEdit',
    data(): Data {
        return {
            id: parseInteger(this.$route.params.id),
            isFetched: false,
            isSaving: false,
            beneficiary: null,
            criticalError: null,
            validationErrors: null,
        };
    },
    computed: {
        isNew(): boolean {
            return this.id === null;
        },

        pageTitle(): string {
            const { $t: __, isNew, isFetched, beneficiary } = this;

            if (isNew) {
                return __('page.beneficiary-edit.title-create');
            }

            if (!isFetched || !beneficiary) {
                return __('page.beneficiary-edit.title-edit-simple');
            }

            return __('page.beneficiary-edit.title-edit', {
                name: beneficiary.full_name,
            });
        },
    },
    errorCaptured(error: Error) {
        this.criticalError = ErrorType.UNKNOWN;

        // eslint-disable-next-line no-console
        console.error(error);

        return false;
    },
    mounted() {
        this.fetchData();
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSubmit(data: BeneficiaryEditType) {
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
            const { isNew, id } = this;
            if (isNew) {
                this.isFetched = true;
                return;
            }

            try {
                this.beneficiary = await apiBeneficiaries.one(id!);
                this.isFetched = true;
            } catch (error) {
                if (error instanceof RequestError && error.httpCode === HttpCode.NotFound) {
                    this.criticalError = ErrorType.NOT_FOUND;
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving beneficiary #${id!} data`, error);
                this.criticalError = ErrorType.UNKNOWN;
            }
        },

        async save(data: BeneficiaryEditType) {
            if (this.isSaving) {
                return;
            }
            this.isSaving = true;
            const { $t: __ } = this;

            const doRequest = (): Promise<Beneficiary> => (
                !this.isNew
                    ? apiBeneficiaries.update(this.id!, data)
                    : apiBeneficiaries.create(data)
            );

            try {
                const beneficiary = await doRequest();
                if (!this.isNew) {
                    this.beneficiary = beneficiary;
                }

                this.validationErrors = null;

                // - Redirection...
                this.$toasted.success(__('page.beneficiary-edit.saved'));
                this.$router.replace({
                    name: 'view-beneficiary',
                    params: { id: beneficiary.id.toString() },
                });
            } catch (error) {
                this.isSaving = false;

                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    (this.$refs.page as ComponentRef<typeof Page>)?.scrollToTop();
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the beneficiary`, error);
                this.$toasted.error(__('errors.unexpected-while-saving'));
            }
        },
    },
    render() {
        const {
            pageTitle,
            isSaving,
            isFetched,
            beneficiary,
            handleSubmit,
            handleCancel,
            criticalError,
            validationErrors,
        } = this;

        if (criticalError || !isFetched) {
            return (
                <Page name="beneficiary-edit" title={pageTitle} centered>
                    {criticalError ? <CriticalError type={criticalError} /> : <Loading />}
                </Page>
            );
        }

        return (
            <Page
                ref="page"
                name="beneficiary-edit"
                title={pageTitle}
                hasValidationError={!!validationErrors}
            >
                <div class="BeneficiaryEdit">
                    <Form
                        savedData={beneficiary}
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

export default BeneficiaryEdit;
