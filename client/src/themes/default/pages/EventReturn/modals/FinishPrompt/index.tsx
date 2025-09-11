import './index.scss';
import { defineComponent } from 'vue';
import DatePicker, { Type as DatePickerType } from '@/themes/default/components/DatePicker';
import Button from '@/themes/default/components/Button';

import type DateTime from '@/utils/datetime';
import type { PropType } from 'vue';
import type { Event } from '@/stores/api/events';

type Props = {
    /** L'événement pour lequel on veut terminer l'inventaire de retour. */
    event: Event,

    /** Indique si l'inventaire de retour a du matériel cassé. */
    hasBroken: boolean,
};

type Data = {
    date: DateTime | null,
    showOptions: boolean,
};

/** Modale de confirmation de fin d'inventaire de retour. */
const EventReturnFinishPromptModal = defineComponent({
    name: 'EventReturnFinishPromptModal',
    modal: {
        width: 450,
    },
    props: {
        event: {
            type: Object as PropType<Props['event']>,
            required: true,
        },
        hasBroken: {
            type: Boolean as PropType<Props['hasBroken']>,
            required: true,
        },
    },
    emits: ['close'],
    data: (): Data => ({
        date: null,
        showOptions: false,
    }),
    computed: {
        minDate(): DateTime {
            return this.event.operation_period
                .setFullDays(false)
                .start.addMinute(15);
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleToggleOptions() {
            this.showOptions = !this.showOptions;
        },

        handleClose() {
            this.$emit('close');
        },

        handleConfirm() {
            this.$emit('close', this.date);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `page.event-return.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            minDate,
            hasBroken,
            showOptions,
            handleToggleOptions,
            handleClose,
            handleConfirm,
        } = this;

        const classNames = ['EventReturnFinishPromptModal', {
            'EventReturnFinishPromptModal--with-options': showOptions,
        }];

        return (
            <div class={classNames}>
                <h2 class="EventReturnFinishPromptModal__title">
                    {__('confirm-terminate-title')}
                </h2>
                <p class="EventReturnFinishPromptModal__warning">
                    {
                        hasBroken
                            ? __('confirm-terminate-text-with-broken')
                            : __('confirm-terminate-text')
                    }
                </p>
                <Button
                    type="transparent"
                    icon={showOptions ? 'chevron-down' : 'chevron-right'}
                    onClick={handleToggleOptions}
                    class="EventReturnFinishPromptModal__options-toggle"
                >
                    {__('advanced-options')}
                </Button>
                <div class="EventReturnFinishPromptModal__options">
                    <p class="EventReturnFinishPromptModal__help">
                        {__('specify-return-date-time')}
                    </p>
                    <DatePicker
                        type={DatePickerType.DATETIME}
                        v-model={this.date}
                        minDate={minDate}
                        maxDate="now"
                        placeholder={__('right-now')}
                        clearable
                    />
                </div>
                <div class="EventReturnFinishPromptModal__actions">
                    <Button type="default" onClick={handleClose}>
                        {__('global.cancel')}
                    </Button>
                    <Button type="primary" onClick={handleConfirm}>
                        {__('global.terminate-inventory')}
                    </Button>
                </div>
            </div>
        );
    },
});

export default EventReturnFinishPromptModal;
