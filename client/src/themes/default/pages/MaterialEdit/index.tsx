import './index.scss';
import { defineComponent } from 'vue';
import { RequestError, HttpCode } from '@/globals/requester';
import parseInteger from '@/utils/parseInteger';
import { ApiErrorCode } from '@/stores/api/@codes';
import apiMaterials from '@/stores/api/materials';
import FormField from '@/themes/default/components/FormField';
import InputImage from '@/themes/default/components/InputImage';
import Page from '@/themes/default/components/Page';
import CriticalError, { ErrorType } from '@/themes/default/components/CriticalError';
import Loading from '@/themes/default/components/Loading';
import Form from './components/Form';

import type { ComponentRef, Raw } from 'vue';
import type {
    MaterialDetails as Material,
    MaterialEdit as MaterialEditType,
} from '@/stores/api/materials';

type Data = {
    id: Material['id'] | null,
    wasNew: boolean,
    material: Material | null,
    isFetched: boolean,
    isSaving: boolean,
    saveProgress: number,
    criticalError: ErrorType | null,
    validationErrors: Record<string, string> | null,
    newPicture: Raw<File> | null | undefined,
};

/** Page d'edition d'un matériel. */
const MaterialEdit = defineComponent({
    name: 'MaterialEdit',
    provide: {
        verticalForm: true,
    },
    data(): Data {
        const id = parseInteger(this.$route.params.id);

        return {
            id,
            wasNew: id === null,
            material: null,
            isFetched: false,
            isSaving: false,
            saveProgress: 0,
            criticalError: null,
            validationErrors: null,
            newPicture: undefined,
        };
    },
    computed: {
        isNew() {
            return this.id === null;
        },

        pageTitle(): string {
            const { $t: __, isNew, wasNew, isFetched, material } = this;

            if (isNew || wasNew) {
                return __('page.material-edit.title-create');
            }

            if (!isFetched || !material) {
                return __('page.material-edit.title-simple');
            }

            return __('page.material-edit.title', { name: material.name });
        },

        picture(): File | string | null {
            if (this.newPicture !== undefined) {
                return this.newPicture;
            }

            const { material } = this;
            return material?.picture ?? null;
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

        handleChangePicture(newPicture: Raw<File> | null) {
            this.newPicture = newPicture;
        },

        handleSubmit(data: MaterialEditType) {
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
                this.material = await apiMaterials.one(id!);
                this.isFetched = true;
            } catch (error) {
                if (error instanceof RequestError && error.httpCode === HttpCode.NotFound) {
                    this.criticalError = ErrorType.NOT_FOUND;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving material #${id!} data`, error);
                this.criticalError = ErrorType.UNKNOWN;
            }
        },

        async save(data: MaterialEditType) {
            if (this.isSaving) {
                return;
            }
            this.isSaving = true;
            this.saveProgress = 0;
            const { $t: __, newPicture } = this;

            const postData = { ...data };
            if (newPicture !== undefined) {
                postData.picture = newPicture ?? null;
            }

            const handleProgress = (percent: number): void => {
                this.saveProgress = percent;
            };

            const doRequest = (): Promise<Material> => (
                this.isNew
                    ? apiMaterials.create(postData, handleProgress)
                    : apiMaterials.update(this.id!, postData, handleProgress)
            );

            try {
                const material = await doRequest();
                if (!this.isNew) {
                    this.material = material;
                }

                this.validationErrors = null;

                // - Redirection...
                this.$toasted.success(__('page.material-edit.saved'));
                this.$router.push({
                    name: 'view-material',
                    params: { id: material.id.toString() },
                });
            } catch (error) {
                this.isSaving = false;

                if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
                    this.validationErrors = { ...error.details };
                    (this.$refs.page as ComponentRef<typeof Page>)?.scrollToTop();
                    return;
                }

                // eslint-disable-next-line no-console
                console.error(`Error occurred while saving the material`, error);
                this.$toasted.error(__('errors.unexpected-while-saving'));
            }
        },
    },
    render() {
        const {
            $t: __,
            criticalError,
            pageTitle,
            material,
            picture,
            isFetched,
            isSaving,
            saveProgress,
            validationErrors,
            handleChangePicture,
            handleSubmit,
            handleCancel,
        } = this;

        if (criticalError || !isFetched) {
            return (
                <Page name="material-edit" title={pageTitle} centered>
                    {criticalError ? <CriticalError type={criticalError} /> : <Loading />}
                </Page>
            );
        }

        return (
            <Page
                ref="page"
                name="material-edit"
                title={pageTitle}
                hasValidationError={!!validationErrors}
            >
                <div class="MaterialEdit">
                    <Form
                        class="MaterialEdit__body"
                        savedData={material}
                        isSaving={isSaving}
                        errors={validationErrors}
                        onSubmit={handleSubmit}
                        onCancel={handleCancel}
                    />
                    <div class="MaterialEdit__side">
                        <FormField
                            type="custom"
                            label={__('picture')}
                            error={validationErrors?.picture}
                        >
                            <InputImage
                                value={picture}
                                uploading={isSaving ? saveProgress : false}
                                onChange={handleChangePicture}
                            />
                        </FormField>
                    </div>
                </div>
            </Page>
        );
    },
});

export default MaterialEdit;
