import './index.scss';
import { RequestError } from '@/globals/requester';
import omit from 'lodash/omit';
import config from '@/globals/config';
import uniqueId from 'lodash/uniqueId';
import apiTaxes from '@/stores/api/taxes';
import { ApiErrorCode } from '@/stores/api/@codes';
import { defineComponent } from 'vue';
import Fragment from '@/components/Fragment';
import FormField from '@/themes/default/components/FormField';
import Input from '@/themes/default/components/Input';
import EmptyMessage from '@/themes/default/components/EmptyMessage';
import { ClientTable, Variant as TableVariant } from '@/themes/default/components/Table';
import SwitchToggle from '@/themes/default/components/SwitchToggle';
import Fieldset from '@/themes/default/components/Fieldset';
import Button from '@/themes/default/components/Button';

import type { ComponentRef, CreateElement, PropType } from 'vue';
import type { Simplify } from 'type-fest';
import type { Columns } from '@/themes/default/components/Table/Client';
import type {
    Tax,
    TaxComponent,
    TaxEdit as TaxEditCore,
    TaxComponentEdit as TaxComponentEditCore,
} from '@/stores/api/taxes';

type TaxComponentEdit = TaxComponentEditCore & { key: string };

type TaxEdit = Simplify<(
    & Omit<TaxEditCore, 'components'>
    & { components: TaxComponentEdit[] }
)>;

type Props = {
    /** La taxe à éditer. */
    tax?: Tax,
};

type Data = {
    data: TaxEdit,
    isSaving: boolean,
    validationErrors: Record<string, any> | undefined,
};

const getComponentDefaults = (savedData?: TaxComponent): TaxComponentEdit => ({
    key: uniqueId(),
    name: savedData?.name ?? null,
    is_rate: savedData?.is_rate ?? true,
    value: savedData?.value.toString() ?? null,
});

const getDefaults = (savedData?: Tax): TaxEdit => ({
    name: savedData?.name ?? null,
    is_group: savedData?.is_group ?? false,
    is_rate: savedData?.is_group ? null : (savedData?.is_rate ?? true),
    value: savedData?.is_group ? null : (savedData?.value.toString() ?? null),
    components: !savedData?.is_group ? [] : (
        (savedData.components ?? []).map((component: TaxComponent) => (
            getComponentDefaults(component)
        ))
    ),
});

/** Modale d'edition d'une taxe. */
const ModalTaxEdition = defineComponent({
    name: 'ModalTaxEdition',
    modal: {
        width: 800,
        clickToClose: false,
    },
    props: {
        tax: {
            type: Object as PropType<Props['tax']>,
            default: undefined,
        },
    },
    emits: ['close'],
    data(): Data {
        return {
            data: getDefaults(this.tax),
            isSaving: false,
            validationErrors: undefined,
        };
    },
    computed: {
        isNew(): boolean {
            return this.tax === undefined;
        },

        title(): string {
            const { __, isNew, tax } = this;

            return !isNew
                ? __('modal-title.edit', { name: tax!.name })
                : __('modal-title.new');
        },

        componentsColumns(): Columns<TaxComponentEdit> {
            const { __, data, handleRemoveComponent } = this;
            const validationErrors = this.validationErrors?.components ?? [];

            return [
                {
                    key: 'name',
                    title: __('fields.components.fields.name.label'),
                    class: 'ModalTaxEdition__sub-taxes__item__name',
                    render: (h: CreateElement, { key }: TaxComponentEdit) => {
                        // - Récupère le composant depuis le state sans quoi il n'est pas réactif.
                        const component = data.components.find(
                            (_component: TaxComponentEdit) => _component.key === key,
                        );
                        if (!component) {
                            return null;
                        }
                        const index = data.components.indexOf(component);

                        return (
                            <Input
                                placeholder={__('fields.components.fields.name.placeholder')}
                                v-model={component.name}
                                invalid={!!validationErrors?.[index]?.name}
                            />
                        );
                    },
                },
                {
                    key: 'is_rate',
                    title: __('fields.components.fields.is-rate.label'),
                    class: 'ModalTaxEdition__sub-taxes__item__is-rate',
                    render: (h: CreateElement, { key }: TaxComponentEdit) => {
                        // - Récupère le composant depuis le state sans quoi il n'est pas réactif.
                        const component = data.components.find(
                            (_component: TaxComponentEdit) => _component.key === key,
                        );
                        if (!component) {
                            return null;
                        }

                        return (
                            <SwitchToggle
                                value={component.is_rate ?? false}
                                options={[
                                    { label: __('fields.components.fields.is-rate.options.rate'), value: true },
                                    { label: __('fields.components.fields.is-rate.options.fixed-price'), value: false },
                                ]}
                                onInput={(value: boolean) => {
                                    component.is_rate = value;
                                }}
                            />
                        );
                    },
                },
                {
                    key: 'value',
                    title: __('fields.components.fields.value'),
                    class: 'ModalTaxEdition__sub-taxes__item__value',
                    render: (h: CreateElement, { key }: TaxComponentEdit) => {
                        // - Récupère le composant depuis le state sans quoi il n'est pas réactif.
                        const component = data.components.find(
                            (_component: TaxComponentEdit) => _component.key === key,
                        );
                        if (!component) {
                            return null;
                        }
                        const index = data.components.indexOf(component);

                        return (
                            <Input
                                type="number"
                                min={0}
                                max={component.is_rate ? 100 : undefined}
                                addon={component.is_rate ? '%' : config.currency.symbol}
                                v-model={component.value}
                                invalid={!!validationErrors?.[index]?.value}
                            />
                        );
                    },
                },
                {
                    key: 'actions',
                    class: 'ModalTaxEdition__sub-taxes__item__actions',
                    render: (h: CreateElement, { key }: TaxComponentEdit) => (
                        <Button
                            type="transparent"
                            icon="times"
                            onClick={() => { handleRemoveComponent(key); }}
                        />
                    ),
                },
            ];
        },
    },
    mounted() {
        if (this.isNew) {
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

        handleIsGroupChange(isGroup: boolean) {
            this.data.is_group = isGroup;

            if (!isGroup) {
                this.data.components = [];
                this.data.is_rate ??= true;
            } else {
                this.data.is_rate = null;
                this.data.value = null;
            }
        },

        handleAddComponent() {
            if (!this.data.is_group) {
                this.data.components = [];
                return;
            }
            this.data.components.push(getComponentDefaults());
        },

        handleRemoveComponent(key: TaxComponentEdit['key']) {
            if (!this.data.is_group) {
                this.data.components = [];
                return;
            }

            // - Si le composant n'existe pas, on ne va pas plus loin, sinon on la récupère.
            const componentIndex = this.data.components.findIndex(
                (_component: TaxComponentEdit) => _component.key === key,
            );
            if (componentIndex === -1) {
                return;
            }

            // - On supprime l'erreur de validation liée à la ligne si elle existe,
            //   pour éviter qu'elle ne soit transférée à une autre ligne.
            if (this.validationErrors?.components !== undefined) {
                this.$delete(this.validationErrors?.components, componentIndex);
            }

            // - On supprime le composant.
            this.data.components.splice(componentIndex, 1);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async save() {
            if (this.isSaving) {
                return;
            }

            const { __, isNew, tax, data } = this;
            this.isSaving = true;

            const postData: TaxEditCore = (
                !data.is_group
                    ? { ...data, components: [] }
                    : {
                        ...data,
                        is_rate: null,
                        value: null,
                        components: data.components.map(
                            (component: TaxComponentEdit) => (
                                omit(component, ['key'])
                            ),
                        ),
                    }
            );

            const doRequest = (): Promise<Tax> => (
                isNew
                    ? apiTaxes.create(postData)
                    : apiTaxes.update(tax!.id, postData)
            );

            try {
                const updatedTax = await doRequest();
                this.validationErrors = undefined;

                this.$toasted.success(__('saved'));
                this.$store.dispatch('taxes/refresh');

                this.$emit('close', updatedTax);
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
                ? `page.settings.taxes.modals.tax-edition.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            data,
            title,
            componentsColumns,
            isSaving,
            validationErrors,
            handleAddComponent,
            handleIsGroupChange,
            handleClose,
            handleSubmit,
        } = this;

        return (
            <div class="ModalTaxEdition">
                <div class="ModalTaxEdition__header">
                    <h2 class="ModalTaxEdition__header__title">
                        {title}
                    </h2>
                    <Button
                        type="close"
                        class="ModalTaxEdition__header__close-button"
                        onClick={handleClose}
                    />
                </div>
                <div class="ModalTaxEdition__body">
                    <form class="ModalTaxEdition__form" onSubmit={handleSubmit}>
                        <FormField
                            type="text"
                            ref="inputName"
                            label={__('fields.name.label')}
                            placeholder={__('fields.name.placeholder')}
                            autocomplete="off"
                            error={validationErrors?.name}
                            v-model={data.name}
                            required
                        />
                        <FormField
                            type="switch"
                            label={__('fields.is-group.label')}
                            help={__('fields.is-group.help')}
                            error={validationErrors?.is_group}
                            onChange={handleIsGroupChange}
                            value={data.is_group}
                            required
                        />
                        {!data.is_group && (
                            <FormField
                                type="switch"
                                label={__('fields.is-rate.label')}
                                error={validationErrors?.is_rate}
                                v-model={data.is_rate}
                                options={[
                                    { label: __('fields.is-rate.options.rate'), value: true },
                                    { label: __('fields.is-rate.options.fixed-price'), value: false },
                                ]}
                                required
                            />
                        )}
                        {!data.is_group && (
                            <FormField
                                type="number"
                                label={(
                                    data.is_rate
                                        ? __('fields.value.label-rate')
                                        : __('fields.value.label-fixed-price')
                                )}
                                error={validationErrors?.value}
                                v-model={data.value}
                                min={0}
                                max={data.is_rate ? 100 : undefined}
                                addon={data.is_rate ? '%' : config.currency.symbol}
                                required
                            />
                        )}
                        {!!data.is_group && (
                            <Fieldset
                                class="ModalTaxEdition__sub-taxes"
                                title={__('fields.components.label')}
                            >
                                {data.components.length === 0 && (
                                    <EmptyMessage
                                        size="small"
                                        message={__('fields.components.empty')}
                                        action={{
                                            type: 'add',
                                            label: __('fields.components.add'),
                                            onClick: handleAddComponent,
                                        }}
                                    />
                                )}
                                {data.components.length > 0 && (
                                    <Fragment>
                                        <ClientTable
                                            uniqueKey="key"
                                            variant={TableVariant.MINIMALIST}
                                            resizable={false}
                                            paginated={false}
                                            columns={componentsColumns}
                                            data={data.components}
                                        />
                                        <Button
                                            type="add"
                                            onClick={handleAddComponent}
                                            class="ModalTaxEdition__sub-taxes__add-button"
                                        >
                                            {__('fields.components.add')}
                                        </Button>
                                    </Fragment>
                                )}
                            </Fieldset>
                        )}
                    </form>
                </div>
                <div class="ModalTaxEdition__footer">
                    <Button type="primary" onClick={handleSubmit} loading={isSaving}>
                        {__('save')}
                    </Button>
                </div>
            </div>
        );
    },
});

export default ModalTaxEdition;
