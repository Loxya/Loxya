import './index.scss';
import pick from 'lodash/pick';
import { defineComponent } from 'vue';
import { PropertyEntity } from '@/stores/api/properties';
import { CustomFieldType } from '@/stores/api/@types';
import FormField from '@/themes/default/components/FormField';
import Fieldset from '@/themes/default/components/Fieldset';
import Button from '@/themes/default/components/Button';

import type { ComponentRef, PropType } from 'vue';
import type { Option, Options } from '@/utils/formatOptions';
import type { Category } from '@/stores/api/categories';
import type { PropertyDetails, PropertyCreate, PropertyEdit } from '@/stores/api/properties';

type EntityOption = {
    label: string,
    value: PropertyEntity,
};

enum PeriodPrecision {
    FREE = 'free',
    HOURLY = 'hourly',
    DAILY = 'daily',
}

type EditedData = Required<PropertyCreate>;

type Props = {
    /**
     * Les données déjà sauvegardées de la caractéristique
     * spéciales (si elle existait déjà).
     */
    savedData?: PropertyDetails | null,

    /** Permet d'indiquer que la sauvegarde est en cours. */
    isSaving?: boolean,

    /** Liste des erreurs de validation éventuelles. */
    errors?: Partial<Record<keyof PropertyCreate, string>> | null,

    /**
     * Fonction appelée lorsque l'utilisateur soumet les changements.
     *
     * @param data - Les données soumises.
     */
    onSubmit?(data: PropertyCreate | PropertyEdit): void,

    /**
     * Fonction appelée lorsque l'utilisateur manifeste
     * son souhait d'annuler l'edition.
     */
    onCancel?(): void,
};

type Data = {
    data: EditedData,
};

const getDefaults = (savedData: PropertyDetails | null): EditedData => {
    const BASE_DEFAULTS = {
        name: null,
        type: CustomFieldType.INTEGER,
        unit: null,
        max_length: null,
        full_days: null,
        options: null,
        is_totalisable: false,
    };

    return {
        ...BASE_DEFAULTS,
        ...pick(savedData ?? {}, Object.keys(BASE_DEFAULTS)),
        entities: [...(savedData?.entities ?? [PropertyEntity.MATERIAL])],
        categories: (savedData?.categories ?? []).map(({ id }: Category) => id),
        options: savedData?.type === CustomFieldType.LIST
            ? [...(savedData?.options ?? [])]
            : null,
    };
};

/**
 * Formulaire d'édition d'une caractéristique
 * spéciale de matériel.
 */
const PropertyEditForm = defineComponent({
    name: 'PropertyEditForm',
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
        return {
            data: getDefaults(this.savedData),
        };
    },
    computed: {
        isNew(): boolean {
            return this.savedData === null;
        },

        entitiesOptions(): EntityOption[] {
            const { __ } = this;

            return [
                {
                    label: __('entities.material'),
                    value: PropertyEntity.MATERIAL,
                },
            ];
        },

        categoriesOptions(): Options<Category> {
            return this.$store.getters['categories/options'];
        },

        typesOptions(): Array<{ value: CustomFieldType, label: string }> {
            const { __ } = this;

            return [
                {
                    label: __('types.integer'),
                    value: CustomFieldType.INTEGER,
                },
                {
                    label: __('types.float'),
                    value: CustomFieldType.FLOAT,
                },
                {
                    label: __('types.date'),
                    value: CustomFieldType.DATE,
                },
                {
                    label: __('types.period'),
                    value: CustomFieldType.PERIOD,
                },
                {
                    label: __('types.string'),
                    value: CustomFieldType.STRING,
                },
                {
                    label: __('types.text'),
                    value: CustomFieldType.TEXT,
                },
                {
                    label: __('types.boolean'),
                    value: CustomFieldType.BOOLEAN,
                },
                {
                    label: __('types.list'),
                    value: CustomFieldType.LIST,
                },
            ];
        },

        periodPrecision(): PeriodPrecision {
            const { full_days: fullDays } = this.data;
            if (fullDays === null) {
                return PeriodPrecision.FREE;
            }
            return fullDays ? PeriodPrecision.DAILY : PeriodPrecision.HOURLY;
        },
    },
    created() {
        this.$store.dispatch('categories/fetch');
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

        handleToggleEntity(entity: PropertyEntity) {
            const { entities } = this.data;

            const foundIndex = entities.indexOf(entity);
            if (foundIndex === -1) {
                entities.push(entity);
                return;
            }

            if (entities.length > 1) {
                entities.splice(foundIndex, 1);
            }
        },

        handleToggleCategory(categoryId: Category['id']) {
            const { categories } = this.data;

            const foundIndex = categories.indexOf(categoryId);
            if (foundIndex === -1) {
                categories.push(categoryId);
                return;
            }
            categories.splice(foundIndex, 1);
        },

        handlePeriodPrecisionChange(newValue: PeriodPrecision) {
            if (this.data.type !== CustomFieldType.PERIOD) {
                return;
            }

            this.data.full_days = ((): boolean | null => {
                if (newValue === PeriodPrecision.FREE) {
                    return null;
                }
                return newValue === PeriodPrecision.DAILY;
            })();
        },

        handleSubmit(e: SubmitEvent) {
            e.preventDefault();

            const { isNew, data: rawData } = this;
            const { name, type, entities, categories } = rawData;

            const data: PropertyCreate | PropertyEdit = (() => {
                const base: PropertyEdit = {
                    name,
                    entities,
                    categories,
                };
                return !isNew ? base : { ...base, type: type ?? null };
            })();

            if (type !== null && type !== undefined) {
                switch (type) {
                    case CustomFieldType.INTEGER:
                    case CustomFieldType.FLOAT: {
                        data.is_totalisable = !!rawData.is_totalisable;
                        data.unit = rawData.unit || null;
                        break;
                    }

                    case CustomFieldType.STRING: {
                        data.max_length = rawData.max_length ?? null;
                        break;
                    }

                    case CustomFieldType.LIST: {
                        data.options = rawData.options ?? [];
                        break;
                    }

                    case CustomFieldType.PERIOD: {
                        data.full_days = rawData.full_days;
                        break;
                    }

                    // - No default.
                }
            }

            this.$emit('submit', data);
        },

        handleCancel() {
            this.$emit('cancel');
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.property-edit.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            data,
            errors,
            isNew,
            periodPrecision,
            entitiesOptions,
            handleToggleEntity,
            typesOptions,
            isSaving,
            categoriesOptions,
            handleSubmit,
            handleCancel,
            handleToggleCategory,
            handlePeriodPrecisionChange,
        } = this;

        const configFields = ((): JSX.Element[] => {
            if (data.type === null || data.type === undefined) {
                return [];
            }

            if ([CustomFieldType.INTEGER, CustomFieldType.FLOAT].includes(data.type)) {
                return [
                    <FormField
                        label={__('unit')}
                        class="PropertyEditForm__unit"
                        v-model={data.unit}
                        error={errors?.unit}
                    />,
                    <FormField
                        type="switch"
                        label={__('totalisable.label')}
                        class="PropertyEditForm__is-totalisable"
                        v-model={data.is_totalisable}
                        error={errors?.is_totalisable}
                        help={__('totalisable.help')}
                    />,
                ];
            }

            if (data.type === CustomFieldType.STRING) {
                return [
                    <FormField
                        type="number"
                        label={__('max-length')}
                        class="PropertyEditForm__max-length"
                        v-model={data.max_length}
                        error={errors?.max_length}
                        step={1}
                    />,
                ];
            }

            if (data.type === CustomFieldType.PERIOD) {
                return [
                    <FormField
                        type="radio"
                        label={__('period-precision.label')}
                        error={errors?.full_days}
                        options={[
                            {
                                label: __('period-precision.options.free'),
                                value: PeriodPrecision.FREE,
                            },
                            {
                                label: __('period-precision.options.daily'),
                                value: PeriodPrecision.DAILY,
                            },
                            {
                                label: __('period-precision.options.hourly'),
                                value: PeriodPrecision.HOURLY,
                            },
                        ]}
                        value={periodPrecision}
                        help={!isNew ? __('period-precision.warning-edit') : undefined}
                        onChange={handlePeriodPrecisionChange}
                    />,
                ];
            }

            if (data.type === CustomFieldType.LIST) {
                return [
                    <FormField
                        type="multiple"
                        label={__('list-choices.label')}
                        error={errors?.options}
                        v-model={data.options}
                        help={!isNew ? __('list-choices.warning-edit') : undefined}
                        required
                    />,
                ];
            }

            return [];
        })();

        return (
            <form
                class="Form Form--fixed-actions PropertyEditForm"
                onSubmit={handleSubmit}
            >
                <Fieldset>
                    <FormField
                        ref="inputName"
                        label={__('name')}
                        class="PropertyEditForm__name"
                        v-model={data.name}
                        error={errors?.name}
                        autocomplete="off"
                        required
                    />
                    <FormField
                        type="custom"
                        label={__('define-entities')}
                        class="PropertyEditForm__entities"
                        error={errors?.entities}
                        help={__('define-entities-help')}
                        required
                    >
                        <div class="PropertyEditForm__entities__choices">
                            {entitiesOptions.map(({ label, value: entity }: EntityOption) => {
                                const isSelected = data.entities.includes(entity);
                                return (
                                    <span
                                        key={entity}
                                        onClick={() => { handleToggleEntity(entity); }}
                                        class={['PropertyEditForm__entities__item', {
                                            'PropertyEditForm__entities__item--selected': isSelected,
                                        }]}
                                    >
                                        {label}
                                    </span>
                                );
                            })}
                        </div>
                    </FormField>
                    <FormField
                        type="select"
                        label={__('type')}
                        class="PropertyEditForm__type"
                        options={typesOptions}
                        v-model={data.type}
                        error={errors?.type}
                        placeholder={false}
                        disabled={!isNew}
                        help={!isNew ? __('type-not-modifiable') : undefined}
                    />
                    {configFields.length > 0 && (
                        <div class="PropertyEditForm__config">
                            {configFields}
                        </div>
                    )}
                    {categoriesOptions.length > 0 && (
                        <FormField
                            type="custom"
                            label={__('limit-to-categories.label')}
                            class="PropertyEditForm__categories"
                            error={errors?.categories}
                            help={__('limit-to-categories.help')}
                            required
                        >
                            <div class="PropertyEditForm__categories__choices">
                                {categoriesOptions.map(({ label, value: categoryId }: Option<Category>) => {
                                    const isSelected = data.categories.includes(categoryId);
                                    return (
                                        <span
                                            key={categoryId}
                                            onClick={() => { handleToggleCategory(categoryId); }}
                                            class={['PropertyEditForm__categories__item', {
                                                'PropertyEditForm__categories__item--selected': isSelected,
                                            }]}
                                        >
                                            {label}
                                        </span>
                                    );
                                })}
                            </div>
                        </FormField>
                    )}
                </Fieldset>
                <section class="Form__actions">
                    <Button htmlType="submit" type="primary" icon="save" loading={isSaving}>
                        {isSaving ? __('global.saving') : __('global.save')}
                    </Button>
                    <Button icon="ban" onClick={handleCancel}>
                        {__('global.cancel')}
                    </Button>
                </section>
            </form>
        );
    },
});

export default PropertyEditForm;
