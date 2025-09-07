import './index.scss';
import { defineComponent } from 'vue';
import pick from 'lodash/pick';
import cloneDeep from 'lodash/cloneDeep';
import FormField from '@/themes/default/components/FormField';
import Fieldset from '@/themes/default/components/Fieldset';
import Button from '@/themes/default/components/Button';

import type { ComponentRef, PropType } from 'vue';
import type { Options } from '@/utils/formatOptions';
import type { Country } from '@/stores/api/countries';
import type { Company, CompanyEdit } from '@/stores/api/companies';

type Props = {
    /** Les données déjà sauvegardées de la société (s'il existait déjà). */
    savedData?: Company | null,

    /** Permet d'indiquer que la sauvegarde est en cours. */
    isSaving?: boolean,

    /** Liste des erreurs de validation éventuelles. */
    errors?: Partial<Record<keyof CompanyEdit, string>> | null,

    /**
     * Fonction appelée lorsque l'utilisateur soumet les changements.
     *
     * @param data - Les données soumises.
     */
    onSubmit?(data: CompanyEdit): void,

    /**
     * Fonction appelée lorsque l'utilisateur manifeste
     * son souhait d'annuler l'edition.
     */
    onCancel?(): void,
};

type Data = {
    data: CompanyEdit,
};

const DEFAULT_VALUES: CompanyEdit = Object.freeze({
    legal_name: '',
    registration_id: '',
    phone: '',
    street: '',
    postal_code: '',
    locality: '',
    country_id: null,
    note: '',
});

/** Formulaire d'édition d'une société. */
const CompanyEditForm = defineComponent({
    name: 'CompanyEditForm',
    provide: {
        verticalForm: true,
    },
    props: {
        savedData: {
            type: Object as PropType<Required<Props>['savedData']>,
            default: null,
        },
        isSaving: {
            type: Boolean as PropType<Required<Props>['isSaving']>,
            default: false,
        },
        errors: {
            type: Object as PropType<Required<Props>['errors']>,
            default: null,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onSubmit: {
            type: Function as PropType<Props['onSubmit']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onCancel: {
            type: Function as PropType<Props['onCancel']>,
            default: undefined,
        },
    },
    emits: ['submit', 'cancel'],
    data(): Data {
        const requestedName = this.$route.query.name ?? null;
        const defaultLegalName = (requestedName !== null && typeof requestedName === 'string')
            ? requestedName
            : DEFAULT_VALUES.legal_name;

        const data = {
            ...DEFAULT_VALUES,
            legal_name: defaultLegalName,
            ...pick(this.savedData ?? {}, Object.keys(DEFAULT_VALUES)),
        };

        return { data };
    },
    computed: {
        isLegalNameFilled(): boolean {
            return this.data.legal_name !== '';
        },

        countriesOptions(): Options<Country> {
            return this.$store.getters['countries/options'];
        },
    },
    created() {
        this.$store.dispatch('countries/fetch');
    },
    mounted() {
        if (!this.isLegalNameFilled) {
            this.$nextTick(() => {
                const $inputLegalName = this.$refs.inputLegalName as ComponentRef<typeof FormField>;
                $inputLegalName?.focus();
            });
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleSubmit(e: SubmitEvent) {
            e?.preventDefault();

            this.$emit('submit', cloneDeep(this.data));
        },

        handleCancel() {
            this.$emit('cancel');
        },
    },
    render() {
        const {
            $t: __,
            data,
            errors,
            countriesOptions,
            isSaving,
            handleSubmit,
            handleCancel,
        } = this;

        return (
            <form
                class="Form Form--fixed-actions CompanyEditForm"
                onSubmit={handleSubmit}
            >
                <Fieldset>
                    <FormField
                        ref="inputLegalName"
                        label="legal-name"
                        autocomplete="off"
                        v-model={data.legal_name}
                        error={errors?.legal_name}
                        required
                    />
                    <FormField
                        label="registration-id"
                        autocomplete="off"
                        v-model={data.registration_id}
                        error={errors?.registration_id}
                    />
                    <FormField
                        label="phone"
                        type="tel"
                        autocomplete="off"
                        v-model={data.phone}
                        error={errors?.phone}
                    />
                </Fieldset>
                <Fieldset title={__('address')}>
                    <FormField
                        label="street"
                        autocomplete="off"
                        v-model={data.street}
                        error={errors?.street}
                    />
                    <div class="CompanyEditForm__locality">
                        <FormField
                            label="postal-code"
                            autocomplete="off"
                            class="CompanyEditForm__postal-code"
                            v-model={data.postal_code}
                            error={errors?.postal_code}
                        />
                        <FormField
                            label="city"
                            class="CompanyEditForm__city"
                            autocomplete="off"
                            v-model={data.locality}
                            error={errors?.locality}
                        />
                    </div>
                    <FormField
                        label="country"
                        type="select"
                        autocomplete="off"
                        options={countriesOptions}
                        v-model={data.country_id}
                        error={errors?.country_id}
                    />
                </Fieldset>
                <Fieldset title={__('other-infos')}>
                    <FormField
                        v-model={data.note}
                        label="notes"
                        rows={5}
                        type="textarea"
                        error={errors?.note}
                    />
                </Fieldset>
                <section class="Form__actions">
                    <Button htmlType="submit" type="primary" icon="save" loading={isSaving}>
                        {isSaving ? __('saving') : __('save')}
                    </Button>
                    <Button icon="ban" onClick={handleCancel}>
                        {__('cancel')}
                    </Button>
                </section>
            </form>
        );
    },
});

export default CompanyEditForm;
