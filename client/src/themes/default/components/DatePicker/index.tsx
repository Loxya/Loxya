import './index.scss';
import Day from '@/utils/day';
import warning from 'warning';
import Period from '@/utils/period';
import DateTime from '@/utils/datetime';
import { defineComponent, markRaw } from 'vue';
import CoreDatePicker from 'vue2-datepicker';
import Fragment from '@/components/Fragment';
import Switch from '@/themes/default/components/SwitchToggle';
import Button from '@/themes/default/components/Button';
import frPickerTranslations from 'vue2-datepicker/locale/es/fr';
import enPickerTranslations from 'vue2-datepicker/locale/es/en';
import { RANGE_SNIPPETS, DATE_SNIPPETS } from './utils/snippets';
import { Type } from './_types';
import {
    normalizeInputValue,
    normalizeCoreValue,
    convertValueType,
    MINUTES_STEP,
} from './utils/normalizer';

import type { ComponentRef, PropType, Raw } from 'vue';
import type {
    Formatter,
    Translations,
    DatePickerEmit,
    TimePickerOptions,
    DatePickerSlotParams,
} from 'vue2-datepicker';
import type {
    Value,
    CoreValue,
    Snippet,
    RawDateSnippet,
    RawRangeSnippet,
    DisableDateFunction,
} from './_types';

type Props<
    T extends Type = Type,
    IsRange extends boolean = boolean,
    WithFullDaysToggle extends boolean = boolean,
> = {
    /**
     * Le nom du champ (attribut `[name]`).
     *
     * Ceci permettra notamment de récupérer la valeur du champ dans
     * le jeu de données d'un formulaire parent lors de la soumission
     * (`submit`) de celui-ci.
     */
    name?: string,

    /**
     * Le type de champ de sélection de date parmi :
     * - `date`: Sélection de date sans heure.
     * - `datetime`: Sélection de date et heure.
     *
     * @default Type.DATE
     */
    type?: T | `${T}`,

    /**
     * Mode "période".
     *
     * - Si `true`, une date de début et de fin devront être sélectionnées.
     * - Si `false`, une seule date devra être sélectionnée.
     *
     * @default false
     */
    range?: IsRange,

    /**
     * Active la permutation des "Jours entiers".
     *
     * Ce mode est uniquement utilisable avec les types `date` et `datetime`.
     *
     * - Si `true`, l'utilisateur pourra choisir d'activer ou non le mode "Jour(s) entier(s)".
     * - Si `false`, le mode "Jour(s) entier(s)" ne sera pas proposé.
     *
     * Si cette option est activée, il faudra veiller à observer l'événement `onChange` et notamment
     * son deuxième paramètre (qui ne sera passé que quand cette option est activée) qui contiendra
     * un booléen `isFullDays`. S'il est à `true`, il faudra veiller à changer le `type` en `DATE` et
     * dans le cas contraire en `DATETIME`.
     *
     * À noter aussi que si cette option est activée et que la prop. `name` est spécifiée, un champ
     * hidden `isFullDays` sera utilisé pour stocker la valeur courante du switch.
     *
     * @default false
     */
    withFullDaysToggle?: WithFullDaysToggle,

    /**
     * Active l'affichage des "snippets" / raccourcis de sélection de période.
     * (e.g. "Cette semaine", "Ce mois", etc.)
     */
    withSnippets?: boolean,

    /**
     * En mode `datetime`, doit-on cacher la sélection des minutes ?
     *
     * @default false
     */
    withoutMinutes?: boolean,

    /** Date minimum sélectionnable dans le sélecteur. */
    minDate?: 'now' | DateTime | Day,

    /** Date maximum sélectionnable dans le sélecteur. */
    maxDate?: 'now' | DateTime | Day,

    /**
     * Une éventuelle fonction permettant de désactiver certaines dates.
     *
     * - Si la fonction renvoie `true`, la date ne sera pas sélectionnable.
     * - Si elle renvoie `false`, elle le sera.
     */
    disabledDate?: DisableDateFunction,

    /** La valeur actuelle du champ. */
    value?: Value<T, IsRange>,

    /**
     * L'éventuel texte affiché en filigrane dans le
     * champ quand celui-ci est vide.
     */
    placeholder?: string,

    /** Le champ est-il désactivé ?  */
    disabled?: boolean,

    /** Le champ doit-il être mis en surbrillance ? */
    highlight?: boolean,

    /**
     * Le champ est-il en lecture seule ?
     *
     * Cette prop. peut recevoir les valeurs suivantes:
     * - Un booléen qui aura un effet similaire à la prop. `disabled`.
     * - Les chaînes `start` ou `end`, uniquement utilisables quand le sélecteur
     *   de date est en mode `range`. Ceci aura pour effet de mettre en lecture
     *   seule seulement la partie indiqué tout en laissant l'autre modifiable.
     */
    readonly?: boolean | 'start' | 'end',

    /** Le champ doit-il être marqué comme invalide ? */
    invalid?: boolean,

    /** Le champ peut-il être vidé ? */
    clearable?: boolean,

    /**
     * Fonction appelée lorsque la valeur du champ change.
     *
     * @param newValue - La nouvelle valeur du champ.
     * @param isFullDays - Est-ce que la période est en jours entiers ?
     *                     (Note: uniquement passé si `withFullDaysToggle` est à `true`)
     */
    onInput?: WithFullDaysToggle extends true
        ? (newValue: Value<T, IsRange>, isFullDays: boolean) => void
        : (newValue: Value<T, IsRange>) => void,

    /**
     * Fonction appelée lorsque la valeur du champ change.
     *
     * @param newValue - La nouvelle valeur du champ.
     * @param isFullDays - Est-ce que la période est en jours entiers ?
     *                     (Note: uniquement passé si `withFullDaysToggle` est à `true`)
     */
    onChange?: WithFullDaysToggle extends true
        ? (newValue: Value<T, IsRange>, isFullDays: boolean) => void
        : (newValue: Value<T, IsRange>) => void,
};

type InstanceProperties = {
    nowTimer: ReturnType<typeof setInterval> | undefined,
};

type Data = {
    showTimePanel: boolean,
    now: Raw<DateTime>,
};

const FORMATTER: Formatter = {
    stringify: (date: Date | null | undefined, format: string): string => (
        date ? new DateTime(date).format(format) : ''
    ),
    parse: (value: string | null | undefined): Date | null => (
        value ? new DateTime(value).toDate() : null
    ),
};

const PICKER_TRANSLATIONS: Record<string, Translations> = {
    fr: frPickerTranslations,
    en: enPickerTranslations,
};

/** Un sélecteur de date(s), heure(s) et période. */
const DatePicker = defineComponent({
    name: 'DatePicker',
    inject: {
        'input.invalid': { default: false },
        'input.disabled': { default: false },
    },
    props: {
        name: {
            type: String as PropType<Props['name']>,
            default: undefined,
        },
        type: {
            type: String as PropType<Required<Props>['type']>,
            default: Type.DATE,
            validator: (value: unknown) => {
                if (typeof value !== 'string') {
                    return false;
                }
                return (Object.values(Type) as string[]).includes(value);
            },
        },
        value: {
            type: [Period, DateTime, Day] as PropType<Required<Props>['value']>,
            default: null,
        },
        range: {
            type: Boolean as PropType<Required<Props>['range']>,
            default: false,
        },
        disabledDate: {
            type: Function as PropType<Props['disabledDate']>,
            default: undefined,
        },
        minDate: {
            type: [String, DateTime, Day] as PropType<Props['minDate']>,
            default: undefined,
        },
        maxDate: {
            type: [String, DateTime, Day] as PropType<Props['maxDate']>,
            default: undefined,
        },
        withFullDaysToggle: {
            type: Boolean as PropType<Required<Props>['withFullDaysToggle']>,
            default: false,
        },
        withSnippets: {
            type: Boolean as PropType<Required<Props>['withSnippets']>,
            default: false,
        },
        withoutMinutes: {
            type: Boolean as PropType<Required<Props>['withoutMinutes']>,
            default: false,
        },
        disabled: {
            type: Boolean as PropType<Props['disabled']>,
            default: undefined,
        },
        highlight: {
            type: Boolean as PropType<Props['highlight']>,
            default: false,
        },
        readonly: {
            type: [Boolean, String] as PropType<Required<Props>['readonly']>,
            default: false,
        },
        invalid: {
            type: Boolean as PropType<Props['invalid']>,
            default: undefined,
        },
        clearable: {
            type: Boolean as PropType<Props['clearable']>,
            default: false,
        },
        placeholder: {
            type: String as PropType<Props['placeholder']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onInput: {
            type: Function as PropType<Props['onInput']>,
            default: undefined,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['input', 'change'],
    setup(props): InstanceProperties {
        warning(
            typeof props.readonly === 'boolean' || props.range,
            'The prop `readonly` should be passed as boolean when used with a non-range `<Datepicker />`.',
        );
        return { nowTimer: undefined };
    },
    data: (): Data => ({
        showTimePanel: false,
        now: markRaw(DateTime.now()),
    }),
    computed: {
        isFullDays(): boolean {
            return this.type === Type.DATE;
        },

        normalizedValue(): Value {
            return normalizeInputValue(
                this.value,
                this.type as Type,
                this.range,
                this.withoutMinutes,
            );
        },

        coreValue(): CoreValue {
            const value = this.normalizedValue;
            if (value === null) {
                return this.range ? [null, null] : null;
            }

            if (this.range) {
                return [
                    (value as Period).start.toString(),
                    (value as Period).end.toString(),
                ];
            }

            return (value as DateTime | Day).toString();
        },

        inheritedInvalid(): boolean {
            if (this.invalid !== undefined) {
                return this.invalid;
            }

            // @ts-expect-error -- Normalement fixé lors du passage à Vue 3 (et son meilleur typage).
            // @see https://github.com/vuejs/core/pull/6804
            return this['input.invalid'];
        },

        inheritedDisabled(): boolean {
            if (this.disabled !== undefined) {
                return this.disabled;
            }

            // @ts-expect-error -- Normalement fixé lors du passage à Vue 3 (et son meilleur typage).
            // @see https://github.com/vuejs/core/pull/6804
            return this['input.disabled'];
        },

        normalizedReadonly(): boolean | 'start' | 'end' {
            if (typeof this.readonly === 'boolean') {
                return this.readonly;
            }
            return this.range ? this.readonly : true;
        },

        timePickerOptions(): TimePickerOptions {
            const step = !this.withoutMinutes
                ? `00:${MINUTES_STEP.toString().padStart(2, '0')}`
                : '01:00';

            // - Dans le cas ou on veut les minutes, on récupère la dernière "step" la prochaine
            //   heure (e.g. Step: 15min => `XX:45`, Step: 10min => `XX:50`), sinon, on utilise
            //   la minute `0`.
            const endMinute = !this.withoutMinutes
                ? (((60 / MINUTES_STEP) - 1) * MINUTES_STEP)
                : 0;

            return {
                start: '00:00',
                step,
                end: `23:${endMinute.toString().padStart(2, '0')}`,
                format: 'HH:mm',
            };
        },

        displayFormat(): string {
            const dateFormat = this.range ? 'll' : 'LL';

            return this.type === Type.DATETIME
                ? `${dateFormat} HH:mm`
                : dateFormat;
        },

        valueFormat(): string {
            return this.type === Type.DATETIME
                ? 'YYYY-MM-DD HH:mm:ss'
                : 'YYYY-MM-DD';
        },

        dateFormat(): string {
            const currentLocaleData = DateTime.localeData();
            return currentLocaleData.longDateFormat('LL');
        },

        translations(): Translations {
            const { locale } = this.$store.state.i18n;
            return PICKER_TRANSLATIONS[locale] ?? undefined;
        },

        disabledDateFactory(): ((granularity: 'day' | 'minute') => (rawDate: Date) => boolean) {
            const {
                now,
                disabledDate,
                type,
                minDate: rawMinDate,
                maxDate: rawMaxDate,
            } = this;
            const withHours = type === Type.DATETIME;
            const withMinutes = withHours && !this.withoutMinutes;

            return (granularity: 'day' | 'minute') => (rawDate: Date): boolean => {
                const date = new DateTime(rawDate);

                if (disabledDate !== undefined && disabledDate(date, granularity)) {
                    return true;
                }

                if (rawMinDate !== undefined) {
                    const minDate: DateTime = (() => {
                        if (rawMinDate === 'now') {
                            if (withHours) {
                                if (withMinutes) {
                                    return now.startOfMinute();
                                }
                                return now.startOfHour();
                            }
                            return now.startOfDay();
                        }

                        return rawMinDate instanceof Day
                            ? rawMinDate.toDateTime().startOfDay()
                            : rawMinDate;
                    })();
                    if (date.isBefore(minDate, granularity)) {
                        return true;
                    }
                }

                if (rawMaxDate !== undefined) {
                    const maxDate: DateTime = (() => {
                        if (rawMaxDate === 'now') {
                            if (withHours) {
                                if (withMinutes) {
                                    return now.endOfMinute(true);
                                }
                                return now.endOfHour(true);
                            }
                            return now.endOfDay(true);
                        }

                        return rawMaxDate instanceof Day
                            ? rawMaxDate.toDateTime().endOfDay(true)
                            : rawMaxDate;
                    })();
                    if (date.isAfter(maxDate, granularity)) {
                        return true;
                    }
                }

                return false;
            };
        },

        snippets(): Snippet[][] {
            if (this.disabled) {
                return [];
            }
            const { __, now } = this;

            if (!this.range) {
                return DATE_SNIPPETS.map((snippetGroup: RawDateSnippet[]): Snippet[] => (
                    snippetGroup.map((snippet: RawDateSnippet): Snippet => {
                        const { labelKey, period: periodFunc } = snippet;
                        const currentDate = this.normalizedValue as Value<Type, false>;
                        const snippetDay = periodFunc(new Day(now));

                        return {
                            label: __(labelKey),
                            periodLabel: snippetDay.format('ll'),
                            isActive: (
                                currentDate !== null
                                    ? snippetDay.isSame(currentDate, 'day')
                                    : false
                            ),
                            period: (
                                this.type !== Type.DATETIME
                                    ? snippetDay.toDateTime().toDate()
                                    : snippetDay.toDateTime().set('hour', 12).toDate()
                            ),
                        };
                    })
                ));
            }

            return RANGE_SNIPPETS.map((snippetGroup: RawRangeSnippet[]): Snippet[] => (
                snippetGroup.map((snippet: RawRangeSnippet): Snippet => {
                    const { labelKey, period: periodFunc } = snippet;
                    const currentPeriod = this.normalizedValue as Value<Type, true>;
                    const snippetPeriod = periodFunc(new Day(now));

                    let periodLabelParts: [string, string];
                    if (snippetPeriod.start.isSame(snippetPeriod.end, 'year')) {
                        periodLabelParts = [
                            snippetPeriod.start.format(__('range-format.same-year.start')),
                            snippetPeriod.end.format(__('range-format.same-year.end')),
                        ];
                    } else {
                        periodLabelParts = [
                            snippetPeriod.start.format(__('range-format.full.start')),
                            snippetPeriod.end.format(__('range-format.full.end')),
                        ];
                    }

                    return {
                        label: __(labelKey),
                        periodLabel: periodLabelParts.join(' - '),
                        isActive: ((): boolean => {
                            if (currentPeriod === null) {
                                return false;
                            }

                            return (
                                snippetPeriod.start.isSame(currentPeriod.start, 'day') &&
                                snippetPeriod.end.isSame(currentPeriod.end, 'day')
                            );
                        })(),
                        period: (
                            [snippetPeriod.start, snippetPeriod.end].map((day: Day) => (
                                this.type !== Type.DATETIME
                                    ? day.toDateTime().toDate()
                                    : day.toDateTime().set('hour', 12).toDate()
                            )) as [Date, Date]
                        ),
                    };
                })
            ));
        },
    },
    mounted() {
        // - Actualise le timestamp courant toutes les 10 secondes.
        this.nowTimer = setInterval(() => { this.now = markRaw(DateTime.now()); }, 10_000);
    },
    beforeDestroy() {
        if (this.nowTimer) {
            clearInterval(this.nowTimer);
        }
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleInput(newValue: CoreValue) {
            if (this.inheritedDisabled) {
                return;
            }

            const normalizedValue = normalizeCoreValue(
                newValue,
                this.type as Type,
                this.range,
            );

            if (this.withFullDaysToggle) {
                this.$emit('input', normalizedValue, this.isFullDays);
                this.$emit('change', normalizedValue, this.isFullDays);
            } else {
                this.$emit('input', normalizedValue);
                this.$emit('change', normalizedValue);
            }
        },

        handleToggleFullDays() {
            if (!this.withFullDaysToggle || this.inheritedDisabled) {
                return;
            }

            const newIsFullDays = !this.isFullDays;
            const newValue = convertValueType(
                this.normalizedValue,
                newIsFullDays ? Type.DATE : Type.DATETIME,
                this.range,
                this.withoutMinutes,
            );

            this.$emit('input', newValue, newIsFullDays);
            this.$emit('change', newValue, newIsFullDays);
        },

        handleToggleMode() {
            if (this.type !== Type.DATETIME) {
                this.showTimePanel = false;
                return;
            }
            this.showTimePanel = !this.showTimePanel;
        },

        handleClose() {
            this.showTimePanel = false;
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.DatePicker.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            name,
            range,
            type,
            snippets,
            isFullDays,
            translations,
            coreValue,
            normalizedValue: value,
            inheritedDisabled: disabled,
            normalizedReadonly: readonly,
            inheritedInvalid: invalid,
            showTimePanel,
            displayFormat,
            valueFormat,
            dateFormat,
            placeholder,
            disabledDateFactory,
            withFullDaysToggle,
            withoutMinutes,
            withSnippets,
            highlight,
            clearable,
            timePickerOptions,
            handleToggleFullDays,
            handleToggleMode,
            handleInput,
            handleClose,
        } = this;

        const withHeader = withFullDaysToggle && !disabled;
        const renderHeader = (): JSX.Element | null => {
            if (!withHeader) {
                return null;
            }

            return (
                <div class="DatePicker__full-days">
                    <label class="DatePicker__full-days__label">
                        {range ? __('full-days') : __('full-day')}
                    </label>
                    <Switch
                        class="DatePicker__full-days__switch"
                        onInput={handleToggleFullDays}
                        value={isFullDays}
                    />
                </div>
            );
        };

        const withFooter = type === Type.DATETIME && !disabled;
        const renderFooter = (): JSX.Element | null => {
            if (!withFooter) {
                return null;
            }

            const message = showTimePanel
                ? (range ? __('select-dates') : __('select-date'))
                : (range ? __('select-hours') : __('select-hour'));

            return (
                <Button
                    class="DatePicker__toggle-mode"
                    icon={showTimePanel ? 'calendar' : 'clock'}
                    onClick={handleToggleMode}
                >
                    {message}
                </Button>
            );
        };

        const withSidebar = withSnippets && !disabled && snippets.length > 0;
        const renderSidebar = (changeDate: DatePickerEmit): JSX.Element | null => {
            if (!withSidebar) {
                return null;
            }

            return (
                <div class="DatePicker__snippets">
                    <div class="DatePicker__snippets__container">
                        {snippets.map((snippetGroup: Snippet[], index: number) => (
                            <dl key={index} class="DatePicker__snippets__group">
                                {snippetGroup.map((snippet: Snippet) => (
                                    <div
                                        key={`${index}-${snippet.label}`}
                                        onClick={() => { changeDate(snippet.period); }}
                                        class={['DatePicker__snippet', {
                                            'DatePicker__snippet--active': snippet.isActive,
                                        }]}
                                    >
                                        <dt class="DatePicker__snippet__label">{snippet.label}</dt>
                                        <dt class="DatePicker__snippet__value">{snippet.periodLabel}</dt>
                                    </div>
                                ))}
                            </dl>
                        ))}
                    </div>
                </div>
            );
        };

        const renderHiddenInput = (): JSX.Element | null => {
            if (!name || disabled) {
                return null;
            }

            if (range) {
                const currentPeriod = value as Value<Type, true>;

                return (
                    <Fragment>
                        <input
                            type="hidden"
                            name={`${name}[start]`}
                            value={currentPeriod?.start.toString() ?? ''}
                        />
                        <input
                            type="hidden"
                            name={`${name}[end]`}
                            value={currentPeriod?.end.toString() ?? ''}
                        />
                        <input
                            type="hidden"
                            name={`${name}[isFullDays]`}
                            value={(
                                currentPeriod !== null
                                    ? (currentPeriod.isFullDays ? 1 : 0)
                                    : ''
                            )}
                        />
                    </Fragment>
                );
            }

            const currentDate = value as Value<Type, false>;
            return <input type="hidden" name={name} value={currentDate?.toString() ?? ''} />;
        };

        const className = ['DatePicker', {
            'DatePicker--invalid': invalid,
            'DatePicker--highlight': highlight,
        }];

        return (
            <div class={className}>
                <CoreDatePicker
                    ref="picker"
                    class="DatePicker__input"
                    disabled={disabled}
                    readonly={readonly}
                    type={type}
                    range={range}
                    lang={translations}
                    value={coreValue}
                    minuteStep={MINUTES_STEP}
                    showMinute={!withoutMinutes}
                    showSecond={false}
                    clearable={clearable}
                    showTimeHeader={type === Type.DATETIME}
                    placeholder={placeholder}
                    formatter={FORMATTER}
                    format={displayFormat}
                    valueType={valueFormat}
                    titleFormat={dateFormat}
                    timeTitleFormat={dateFormat}
                    disabledDate={disabledDateFactory('day')}
                    disabledTime={disabledDateFactory('minute')}
                    showTimePanel={showTimePanel}
                    timePickerOptions={timePickerOptions}
                    rangeSeparator="  ⇒  "
                    confirmText={__('global.done')}
                    scopedSlots={{
                        ...(withHeader ? { header: () => renderHeader() } : {}),
                        ...(withFooter ? { footer: () => renderFooter() } : {}),
                        ...(withSidebar ? {
                            sidebar: ({ emit: changeDate }: DatePickerSlotParams) => (
                                renderSidebar(changeDate)
                            ),
                        } : {}),
                    }}
                    onClose={handleClose}
                    onInput={handleInput}
                />
                {renderHiddenInput()}
            </div>
        );
    },
});

//
// - Exports
//

type DatePickerGeneric = <
    T extends Type = Type.DATE,
    IsRange extends boolean = false,
    WithFullDaysToggle extends boolean = false,
>(props: Props<T, IsRange, WithFullDaysToggle>) => JSX.Element;

export type DatePickerRef = ComponentRef<typeof DatePicker>;
export type { Value, DisableDateFunction };

export { Type };
export default DatePicker as any as DatePickerGeneric;
