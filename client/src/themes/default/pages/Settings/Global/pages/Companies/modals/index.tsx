import { defineComponent } from 'vue';
import { RequestError } from '@/globals/requester';
import './index.scss';
import apiBillingCompanies from '@/stores/api/billing-companies';
import { ApiErrorCode } from '@/stores/api/@codes';
import FormField from '@/themes/default/components/FormField';
import Button from '@/themes/default/components/Button';
import Fieldset from '@/themes/default/components/Fieldset';

import type { ComponentRef, PropType, Raw } from 'vue';
import type { BillingCompany, BillingCompanyEdit } from '@/stores/api/billing-companies';
import type { Country } from '@/stores/api/countries';
import type { Options } from '@/utils/formatOptions';
import InputImage from '@/themes/default/components/InputImage';

type Props = {
  company?: BillingCompany,
};

type Data = {
  data: BillingCompanyEdit,
  isSaving: boolean,
  validationErrors: Record<string, string> | undefined,
  saveProgress: number,
  newLogo: Raw<File> | null | undefined,
};

const getDefaults = (savedData?: BillingCompany): BillingCompanyEdit => ({
  name: savedData?.name ?? '',
  street: savedData?.street ?? '',
  postal_code: savedData?.postal_code ?? '',
  locality: savedData?.locality ?? '',
  country_id: savedData?.country_id ?? null,
  phone: savedData?.phone ?? '',
  email: savedData?.email ?? '',
  website: savedData?.website ?? '',
  vat_number: savedData?.vat_number ?? null,
  code1_label: savedData?.code1_label ?? null,
  code1_value: savedData?.code1_value ?? null,
  code2_label: savedData?.code2_label ?? null,
  code2_value: savedData?.code2_value ?? null,
});

const ModalBillingCompanyEdition = defineComponent({
  name: 'ModalBillingCompanyEdition',
  modal: {
    width: 800,
    clickToClose: false,
  },
  props: {
    company: {
      type: Object as PropType<Props['company']>,
      default: undefined,
    },
  },
  emits: ['close'],
  data(): Data {
    return {
      data: getDefaults(this.company),
      isSaving: false,
      validationErrors: undefined,
      newLogo: undefined,
      saveProgress: 0,
    };
  },

  computed: {
    isNew(): boolean {
      return this.company === undefined;
    },

    title(): string {
      const { __, company } = this;
      return this.isNew ? __('modal-title.new-company') : __('modal-title.edit', { name: company!.name });
    },
    countriesOptions(): Options<Country> {
      return this.$store.getters['countries/options'];
    },
    logo(): File | string | null {
      if(this.newLogo !== undefined) {
        return this.newLogo;
      }
      return this.company?.logo ?? null;
    },
  },
  created() {
    this.$store.dispatch('countries/refresh');
  },

  mounted() {
    if(this.isNew) {
      this.$nextTick(() => {
        const $inputName = this.$refs.inputName as ComponentRef<typeof FormField>;
        $inputName?.focus();
      });
    }
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

    handleChangeLogo(newLogo: File | null) {
      this.newLogo = newLogo;
    },

    async save() {
      if(this.isSaving) {
        return;
      }

      const { __, isNew, company, data, newLogo } = this;
      this.isSaving = true;
      this.saveProgress = 0;

      const postData: BillingCompanyEdit = {
        ...data,
      };

      if(newLogo !== undefined) {
        postData.logo = newLogo ?? null;
      }

      const handleProgress = (progress: number) => {
        this.saveProgress = progress;
      };

      const doRequest = (): Promise<BillingCompany> => (
        isNew
          ? apiBillingCompanies.create(postData, handleProgress)
          : apiBillingCompanies.update(company!.id, postData, handleProgress)
      );

      try {
        const updatedCompany = await doRequest();
        this.validationErrors = undefined;

        this.$toasted.success(__('saved'));
        this.$emit('close', updatedCompany);
      } catch (error) {
        this.isSaving = false;

        if (error instanceof RequestError && error.code === ApiErrorCode.VALIDATION_FAILED) {
          this.validationErrors = { ...error.details };
          return;
        }

        this.$toasted.error(__('global.errors.unexpected-while-saving'));
      }
    },

    __(key: string, params?: Record<string, number | string>, count?: number): string {
      key = !key.startsWith('global.')
        ? `page.settings.companies.modals.company-edition.${key}`
        : key.replace(/^global\./, '');
      return this.$t(key, params, count);
    },
  },

  render() {
    const {
      __,
      data,
      title,
      isSaving,
      validationErrors,
      handleSubmit,
      handleClose,
      countriesOptions,
      saveProgress,
      handleChangeLogo,
      logo,
    } = this;

    return (
      <div class="ModalBillingCompanyEdition">
        <div class="ModalBillingCompanyEdition__header">
          <h2 class="ModalBillingCompanyEdition__header__title">{title}</h2>

          <Button
            type="close"
            class="ModalBillingCompanyEdition__header__close-button"
            onClick={handleClose}
          />
        </div>
        <div class="ModalBillingCompanyEdition__body">
          <form class="Form ModalBillingCompanyEdition__form" onSubmit={handleSubmit}>
            <Fieldset>
              <FormField
                type="custom"
                class="ModalBillingCompanyEdition__logo"
                error={validationErrors?.logo}
              >
                <InputImage
                  value={logo}
                  uploading={isSaving ? saveProgress : false}
                  onChange={handleChangeLogo}
                />
              </FormField>
            </Fieldset>

            <Fieldset>
              <FormField
                type="text"
                ref="inputName"
                label={__('fields.name.label')}
                value={data.name}
                placeholder={__('fields.name.placeholder')}
                autocomplete="off"
                error={validationErrors?.name}
                onInput={(value: string) => { data.name = value; }}
                required
              />

              <FormField
                type="tel"
                label={__('fields.phone.label')}
                value={data.phone}
                placeholder={__('fields.phone.placeholder')}
                autocomplete="off"
                error={validationErrors?.phone}
                onInput={(value: string) => { data.phone = value; }}
              />

              <FormField
                type="email"
                label={__('fields.email.label')}
                value={data.email}
                placeholder={__('fields.email.placeholder')}
                autocomplete="off"
                error={validationErrors?.email}
                onInput={(value: string) => { data.email = value; }}
              />
              <FormField
                type="text"
                label={__('fields.website.label')}
                value={data.website ?? ''}
                placeholder={__('fields.website.placeholder')}
                autocomplete="off"
                error={validationErrors?.website}
                onInput={(value: string) => { data.website = value; }}
              />
              <FormField
                type="text"
                label={__('fields.vat-number.label')}
                value={data.vat_number ?? ''}
                placeholder={__('fields.vat-number.placeholder')}
                autocomplete="off"
                error={validationErrors?.vat_number}
                onInput={(value: string) => { data.vat_number = value; }}
              />
            </Fieldset>
            <Fieldset title={__('fields.address.label')}>
              <FormField
                type="text"
                label={__('fields.street.label')}
                value={data.street}
                placeholder={__('fields.street.placeholder')}
                autocomplete="off"
                error={validationErrors?.street}
                onInput={(value: string) => { data.street = value; }}
                required
              />
              <div class="ModalBillingCompanyEdition__locality">
                <FormField
                  type="text"
                  label={__('fields.postal-code.label')}
                  value={data.postal_code}
                  placeholder={__('fields.postal-code.placeholder')}
                  autocomplete="off"
                  class="ModalBillingCompanyEdition__postal-code"
                  error={validationErrors?.postal_code}
                  onInput={(value: string) => { data.postal_code = value; }}
                  required
                />
                <FormField
                  type="text"
                  label={__('fields.locality.label')}
                  value={data.locality}
                  placeholder={__('fields.locality.placeholder')}
                  autocomplete="off"
                  class="ModalBillingCompanyEdition__city"
                  error={validationErrors?.locality}
                  onInput={(value: string) => { data.locality = value; }}
                  required
                />
              </div>

              <FormField
                label="country"
                type="select"
                autocomplete="off"
                value={data.country_id}
                options={countriesOptions}
                error={validationErrors?.country_id}
                onInput={(value: number) => { data.country_id = value; }}
                required
              />
            </Fieldset>
            <Fieldset title={__('fields.legal-numbers.label')} class="ModalBillingCompanyEdition__legal-numbers">
              <FormField
                type="text"
                label={__('fields.code-label.label')}
                value={data.code1_label ?? ''}
                placeholder={__('fields.code-label.placeholder')}
                autocomplete="off"
                error={validationErrors?.code1_label}
                onInput={(value: string) => { data.code1_label = value; }}
              />
              <FormField
                type="text"
                label={__('fields.code-value.label')}
                value={data.code1_value ?? ''}
                placeholder={__('fields.code-value.placeholder')}
                autocomplete="off"
                error={validationErrors?.code1_value}
                onInput={(value: string) => { data.code1_value = value; }}
              />
              <FormField
                type="text"
                label={__('fields.code-label.label')}
                value={data.code2_label ?? ''}
                placeholder={__('fields.code-label.placeholder')}
                autocomplete="off"
                error={validationErrors?.code2_label}
                onInput={(value: string) => { data.code2_label = value; }}
              />
              <FormField
                type="text"
                label={__('fields.code-value.label')}
                value={data.code2_value ?? ''}
                placeholder={__('fields.code-value.placeholder')}
                autocomplete="off"
                error={validationErrors?.code2_value}
                onInput={(value: string) => { data.code2_value = value; }}
              />
            </Fieldset>
          </form>
        </div>

        <div class="ModalBillingCompanyEdition__footer">
          <Button type="primary" onClick={handleSubmit} loading={isSaving}>
            {__('actions.save')}
          </Button>
        </div>
      </div>
    );
  },
});

export default ModalBillingCompanyEdition;
