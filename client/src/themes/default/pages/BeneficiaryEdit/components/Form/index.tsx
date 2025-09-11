import './index.scss';
import { defineComponent } from 'vue';
import pick from 'lodash/pick';
import cloneDeep from 'lodash/cloneDeep';
import FormField from '@/themes/default/components/FormField';
import Fieldset from '@/themes/default/components/Fieldset';
import Button from '@/themes/default/components/Button';
import CompanySelect from './CompanySelect';

import type { ComponentRef, PropType } from 'vue';
import type { Options } from '@/utils/formatOptions';
import type { Country } from '@/stores/api/countries';
import type { Company } from '@/stores/api/companies';
import type {
    BeneficiaryEdit,
    BeneficiaryDetails as Beneficiary,
} from '@/stores/api/beneficiaries';

type Props = {
    /** Les données déjà sauvegardées du bénéficiaire (s'il existait déjà). */
    savedData?: Beneficiary | null,

    /** Permet d'indiquer que la sauvegarde est en cours. */
    isSaving?: boolean,

    /** Liste des erreurs de validation éventuelles. */
    errors?: Record<string, string> | null,

    /**
     * Fonction appelée lorsque l'utilisateur soumet les changements.
     *
     * @param data - Les données soumises.
     */
    onSubmit?(data: BeneficiaryEdit): void,

    /**
     * Fonction appelée lorsque l'utilisateur manifeste
     * son souhait d'annuler l'edition.
     */
    onCancel?(): void,
};

type Data = {
    data: BeneficiaryEdit,
};

const DEFAULT_VALUES: BeneficiaryEdit = Object.freeze({
    first_name: '',
    last_name: '',
    reference: '',
    company_id: null,
    phone: '',
    email: '',
    street: '',
    postal_code: '',
    locality: '',
    country_id: null,
    note: '',
    pseudo: '',
    password: '',
});

/** Formulaire d'édition d'un bénéficiaire. */
const BeneficiaryEditForm = defineComponent({
    name: 'BeneficiaryEditForm',
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
    emits: ['cancel', 'submit'],
    data(): Data {
        const data = {
            ...DEFAULT_VALUES,
            ...pick(this.savedData ?? {}, Object.keys(DEFAULT_VALUES)),
            email: this.savedData?.user?.email ?? this.savedData?.email ?? null,
        };

        return {
            data,
        };
    },
    computed: {
        isNew(): boolean {
            return this.savedData === null;
        },

        hasUserAccount(): boolean {
            return !!this.savedData?.user;
        },

        countriesOptions(): Options<Country> {
            return this.$store.getters['countries/options'];
        },
    },
    created() {
        this.$store.dispatch('countries/fetch');
    },
    mounted() {
        if (this.isNew) {
            this.$nextTick(() => {
                const $inputFirstName = this.$refs.inputFirstName as ComponentRef<typeof FormField>;
                $inputFirstName?.focus();
            });
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleChangeCompany(companyId: Company['id'] | null) {
            this.data.company_id = companyId || null;
        },

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
            savedData,
            countriesOptions,
            hasUserAccount,
            isSaving,
            handleChangeCompany,
            handleSubmit,
            handleCancel,
        } = this;

        const renderUserAccountSection = (): JSX.Element | null => {
            if (!hasUserAccount) {
                return null;
            }
            const user = savedData!.user!;

            return (
                <Fieldset title={__('page.beneficiary-edit.user-account')}>
                    <div class="BeneficiaryEditForm__existing-user-help">
                        {__('page.beneficiary-edit.existing-user-help')}
                    </div>
                    <div class="BeneficiaryEditForm__existing-user">
                        <div class="BeneficiaryEditForm__existing-user__pseudo">
                            <div class="BeneficiaryEditForm__existing-user__label">
                                {__('pseudo')}
                            </div>
                            <div class="BeneficiaryEditForm__existing-user__value">
                                {user.pseudo}
                            </div>
                        </div>
                        <div class="BeneficiaryEditForm__existing-user__email">
                            <div class="BeneficiaryEditForm__existing-user__label">
                                {__('email')}
                            </div>
                            <div class="BeneficiaryEditForm__existing-user__value">
                                {user.email}
                            </div>
                        </div>
                    </div>
                </Fieldset>
            );
        };

        return (
            <form
                class="Form Form--fixed-actions BeneficiaryEditForm"
                onSubmit={handleSubmit}
            >
                <Fieldset>
                    <div class="BeneficiaryEditForm__name">
                        <FormField
                            ref="inputFirstName"
                            label="first-name"
                            class="BeneficiaryEditForm__first-name"
                            v-model={data.first_name}
                            error={errors?.first_name}
                            autocomplete="off"
                            required
                        />
                        <FormField
                            label="last-name"
                            class="BeneficiaryEditForm__last-name"
                            v-model={data.last_name}
                            error={errors?.last_name}
                            autocomplete="off"
                            required
                        />
                    </div>
                    <FormField
                        label="reference"
                        v-model={data.reference}
                        error={errors?.reference}
                        help={__('page.beneficiary-edit.help-reference')}
                    />
                </Fieldset>
                <Fieldset title={__('company')}>
                    <CompanySelect
                        defaultCompany={savedData?.company ?? null}
                        onChange={handleChangeCompany}
                    />
                </Fieldset>
                <Fieldset title={__('contact-details')}>
                    <FormField
                        label="phone"
                        type="tel"
                        autocomplete="off"
                        v-model={data.phone}
                        error={errors?.phone}
                    />
                    <FormField
                        label="email"
                        type="email"
                        autocomplete="off"
                        v-model={data.email}
                        error={errors?.email}
                    />
                    <FormField
                        label="street"
                        autocomplete="off"
                        v-model={data.street}
                        error={errors?.street}
                    />
                    <div class="BeneficiaryEditForm__locality">
                        <FormField
                            label="postal-code"
                            class="BeneficiaryEditForm__postal-code"
                            autocomplete="off"
                            v-model={data.postal_code}
                            error={errors?.postal_code}
                        />
                        <FormField
                            label="city"
                            class="BeneficiaryEditForm__city"
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
                        label="notes"
                        type="textarea"
                        rows={4}
                        v-model={data.note}
                        error={errors?.note}
                    />
                </Fieldset>
                {renderUserAccountSection()}
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

export default BeneficiaryEditForm;
