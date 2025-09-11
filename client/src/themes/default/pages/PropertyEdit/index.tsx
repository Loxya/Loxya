import './index.scss';
import diff from 'lodash/difference';
import { confirm } from '@/utils/alert';
import parseInteger from '@/utils/parseInteger';
import { defineComponent } from 'vue';
import { RequestError } from '@/globals/requester';
import { ApiErrorCode } from '@/stores/api/@codes';
import apiProperties from '@/stores/api/properties';
import Page from '@/themes/default/components/Page';
import CriticalError from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import Form from './components/Form';

import type { ComponentRef } from 'vue';
import type { Category } from '@/stores/api/categories';
import type {
    PropertyDetails as Property,
    PropertyEdit as PropertyEditType,
    PropertyCreate,
} from '@/stores/api/properties';

type Data = {
    id: Property['id'] | null,
    isFetched: boolean,
    isSaving: boolean,
    property: Property | null,
    hasCriticalError: boolean,
    validationErrors: Record<string, string> | undefined,
};

/** Page d'edition d'une caractéristique spéciale de matériel. */
const PropertyEdit = defineComponent({
    name: 'PropertyEdit',
    data(): Data {
        return {
            id: parseInteger(this.$route.params.id)!,
            isFetched: false,
            isSaving: false,
            property: null,
            hasCriticalError: false,
            validationErrors: undefined,
        };
    },
    computed: {
        isNew() {
            return this.id === null;
        },

        pageTitle() {
            const { $t: __, isNew, isFetched, property } = this;

            if (isNew) {
                return __('page.property-edit.title-create');
            }

            if (!isFetched) {
                return __('page.property-edit.title-simple');
            }

            return __('page.property-edit.title', { name: property!.name });
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

        handleSubmit(data: PropertyCreate | PropertyEditType) {
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
                this.property = await apiProperties.one(id!);
                this.isFetched = true;
            } catch {
                this.hasCriticalError = true;
            }
        },

        async save(data: PropertyCreate | PropertyEditType) {
            if (this.isSaving) {
                return;
            }

            const { $t: __, property, isNew } = this;

            if (!isNew) {
                let isConfirmed = true;

                const savedEntities = property?.entities ?? [];
                const haveEntitiesRemoved = diff(savedEntities, data.entities).length > 0;
                if (haveEntitiesRemoved) {
                    isConfirmed = await confirm({
                        type: 'danger',
                        text: __('page.property-edit.confirm-update-entities'),
                        confirmButtonText: __('page.property-edit.yes-update'),
                    });
                }

                const savedCategories = property?.categories?.map(({ id }: Category) => id) ?? [];
                const haveCategoriesChanged = (
                    data.categories.length > 0 && (
                        diff(savedCategories, data.categories).length > 0 ||
                        diff(data.categories, savedCategories).length > 0
                    )
                );
                if (haveCategoriesChanged) {
                    isConfirmed = await confirm({
                        type: 'danger',
                        text: __('page.property-edit.confirm-update-categories'),
                        confirmButtonText: __('page.property-edit.yes-update'),
                    });
                }

                if (!isConfirmed) {
                    return;
                }
            }

            this.isSaving = true;

            try {
                if (isNew) {
                    await apiProperties.create(data as PropertyCreate);
                } else {
                    this.property = await apiProperties.update(this.id!, data as PropertyEditType);
                }

                this.validationErrors = undefined;

                // - Redirection...
                this.$toasted.success(__('page.property-edit.saved'));
                this.$router.replace({ name: 'properties' });
            } catch (error) {
                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    (this.$refs.page as ComponentRef<typeof Page>)?.scrollToTop();
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the property`, error);
                this.$toasted.error(__('errors.unexpected-while-saving'));
            } finally {
                this.isSaving = false;
            }
        },
    },
    render() {
        const {
            hasCriticalError,
            isFetched,
            pageTitle,
            validationErrors,
            property,
            isSaving,
            handleSubmit,
            handleCancel,
        } = this;

        if (hasCriticalError || !isFetched) {
            return (
                <Page name="property-edit" title={pageTitle} centered>
                    {hasCriticalError ? <CriticalError /> : <Loading />}
                </Page>
            );
        }

        return (
            <Page
                ref="page"
                title={pageTitle}
                name="property-edit"
                hasValidationError={!!validationErrors}
            >
                <div class="PropertyEdit">
                    <Form
                        savedData={property}
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

export default PropertyEdit;
