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
import { ClientTable } from '@/themes/default/components/Table';
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

    /**
     * Fonction appelée lorsque la modale est fermée.
     *
     * @param updatedTax - La taxe sauvegardée si la modification a été menée à son terme.
     */
    onClose?(updatedTax?: Tax): void,
};

type Data = {
    data: TaxEdit,
    isSaving: boolean,
    validationErrors: Record<string, any> | undefined,
};

const getComponentDefaults = (savedData?: TaxComponent): TaxComponentEdit => ({
    key: uniqueId(),
    name: savedData?.name ?? null,
    value: savedData?.value.toString() ?? null,
});

const getDefaults = (savedData?: Tax): TaxEdit => {
    const { country } = config.organization;
    const isSimpleVatSystem = !!country.hasSimpleVatSystem;

    if (isSimpleVatSystem) {
        return {
            name: null,
            is_group: false,
            value: (
                !savedData?.is_group
                    ? (savedData?.value.toString() ?? null)
                    : null
            ),
            components: [],
        };
    }

    return {
        name: savedData?.name ?? null,
        is_group: savedData?.is_group ?? false,
        value: savedData?.is_group ? null : (savedData?.value.toString() ?? null),
        components: !savedData?.is_group ? [] : (
            (savedData.components ?? []).map((component: TaxComponent) => (
                getComponentDefaults(component)
            ))
        ),
    };
};

/** Modale d'edition d'une taxe. */
const ModalTaxEdition = defineComponent({
    name: 'ModalTaxEdition',
    modal: {
        width: 800,
        dismissible: false,
    },
    props: {
        tax: {
            type: Object as PropType<Props['tax']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onClose: {
            type: Function as PropType<Props['onClose']>,
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
        isSimpleVatSystem(): boolean {
            const { country } = config.organization;
            return !!country.hasSimpleVatSystem;
        },

        isNew(): boolean {
            return this.tax === undefined;
        },

        title(): string {
            const { __, __s, isNew, isSimpleVatSystem, tax } = this;

            if (isNew || tax!.is_group) {
                return isNew
                    ? __s('modal-title.new')
                    : __('modal-title.edit.default', { name: tax!.name! });
            }

            return !isSimpleVatSystem
                ? __('modal-title.edit.default', { name: tax!.name ?? `${tax!.value.toString()}%` })
                : __('modal-title.edit.simple', { rate: `${tax!.value.toString()}%` });
        },

        componentsColumns(): Columns<TaxComponentEdit, 'key'> {
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
                                max={100}
                                addon="%"
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
            } else {
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
            //   et on décale les clés suivantes pour rester alignés avec les indexes.
            const componentErrors = this.validationErrors?.components;
            if (componentErrors !== undefined) {
                this.$set(this.validationErrors!, 'components', (() => {
                    const reindexed: Record<number, any> = {};
                    Object.entries(componentErrors).forEach(([rawKey, error]: [string, any]) => {
                        const errorIndex = Number(rawKey);
                        if (errorIndex === componentIndex) {
                            return;
                        }
                        reindexed[errorIndex > componentIndex ? errorIndex - 1 : errorIndex] = error;
                    });
                    return reindexed;
                })());
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

        __s(key: string, params?: Record<string, number | string>, count?: number): string {
            const systemSuffix = this.isSimpleVatSystem ? 'simple' : 'default';
            return this.__(`${key}.${systemSuffix}`, params, count);
        },
    },
    render() {
        const {
            __,
            data,
            title,
            componentsColumns,
            isSaving,
            isSimpleVatSystem,
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
                        {!isSimpleVatSystem && (
                            <FormField
                                type="text"
                                ref="inputName"
                                label={__('fields.name.label')}
                                placeholder={__('fields.name.placeholder')}
                                autocomplete="off"
                                error={validationErrors?.name}
                                value={data.name}
                                onInput={(value: string) => {
                                    data.name = value;
                                }}
                                required
                            />
                        )}
                        {!isSimpleVatSystem && (
                            <FormField
                                type="switch"
                                label={__('fields.is-group.label')}
                                help={__('fields.is-group.help')}
                                error={validationErrors?.is_group}
                                onChange={handleIsGroupChange}
                                value={data.is_group}
                                required
                            />
                        )}
                        {(!isSimpleVatSystem || !data.is_group) && (
                            <FormField
                                type="number"
                                class="ModalTaxEdition__rate"
                                ref={isSimpleVatSystem ? 'inputName' : undefined}
                                label={__('fields.value')}
                                error={validationErrors?.value}
                                value={data.value}
                                min={0}
                                max={100}
                                addon="%"
                                onInput={(value: string) => {
                                    data.value = value;
                                }}
                                required
                            />
                        )}
                        {(!isSimpleVatSystem && data.is_group) && (
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
                                            variant="minimalist"
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
