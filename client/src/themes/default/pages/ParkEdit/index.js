import './index.scss';
import { defineComponent } from 'vue';
import { RequestError, HttpCode } from '@/globals/requester';
import Page from '@/themes/default/components/Page';
import CriticalError, { ErrorType } from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import Form from './components/Form';
import apiParks from '@/stores/api/parks';
import { ApiErrorCode } from '@/stores/api/@codes';
import parseInteger from '@/utils/parseInteger';

/** Page d'edition d'un parc. */
const ParkEdit = defineComponent({
    name: 'ParkEdit',
    data() {
        const id = parseInteger(this.$route.params.id);

        return {
            id,
            isFetched: id === null,
            isSaving: false,
            park: null,
            criticalError: null,
            validationErrors: null,
        };
    },
    computed: {
        isNew() {
            return this.id === null;
        },

        pageTitle() {
            const { $t: __, isNew, isFetched, park } = this;

            if (isNew) {
                return __('page.park.title-create');
            }

            return isFetched
                ? __('page.park.title-edit', { name: park.name })
                : __('page.park.title-edit-simple');
        },
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

        handleSubmit(data) {
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
                this.park = await apiParks.one(this.id);
                this.isFetched = true;
            } catch (error) {
                if (error instanceof RequestError && error.httpCode === HttpCode.NotFound) {
                    this.criticalError = ErrorType.NOT_FOUND;
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving park #${this.id} data`, error);
                this.criticalError = ErrorType.UNKNOWN;
            }
        },

        async save(data) {
            if (this.isSaving) {
                return;
            }

            const { $t: __ } = this;
            this.isSaving = true;

            const doRequest = () => (
                !this.isNew
                    ? apiParks.update(this.id, data)
                    : apiParks.create(data)
            );

            try {
                const park = await doRequest();
                if (!this.isNew) {
                    this.park = park;
                }

                this.validationErrors = null;

                // - On actualise le "cache global" des parcs.
                this.$store.dispatch('parks/refresh');

                // - Redirection...
                this.$toasted.success(__('page.park.saved'));
                this.$router.replace({ name: 'parks' });
            } catch (error) {
                this.isSaving = false;

                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    this.$refs.page.scrollToTop();
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the park`, error);
                this.$toasted.error(__('errors.unexpected-while-saving'));
            }
        },
    },
    render() {
        const {
            pageTitle,
            park,
            isSaving,
            isFetched,
            criticalError,
            validationErrors,
            handleSubmit,
            handleCancel,
        } = this;

        if (criticalError || !isFetched) {
            return (
                <Page name="park-edit" title={pageTitle}>
                    {criticalError ? <CriticalError type={criticalError} /> : <Loading />}
                </Page>
            );
        }

        return (
            <Page
                ref="page"
                name="park-edit"
                title={pageTitle}
                hasValidationError={!!validationErrors}
            >
                <div class="ParkEdit">
                    <Form
                        savedData={park}
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

export default ParkEdit;
