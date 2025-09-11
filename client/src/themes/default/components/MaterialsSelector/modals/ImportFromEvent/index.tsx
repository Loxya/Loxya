import './index.scss';
import { BookableEntity } from '../../_types';
import { BookingEntity } from '@/stores/api/bookings';
import { defineComponent } from 'vue';
import Button from '@/themes/default/components/Button';
import Loading from '@/themes/default/components/Loading';
import apiEvents from '@/stores/api/events';
import Selected from './Selected';
import Search from './Search';

import type { PropType } from 'vue';
import type { Event, EventDetails } from '@/stores/api/events';
import type { Bookable, SourceMaterial } from '../../_types';

type Props = {
    /**
     * La liste du matériel disponible au moment de l'import, avec
     * les informations de surcharge, si disponible.
     */
    materials: SourceMaterial[],

    /**
     * L'éventuel bookable dans lequel le matériel de l'événement va être importé.
     * Utile notamment pour exclure celui-ci des propositions si c'est un événement.
     */
    bookable?: Bookable,

    /** Doit-on afficher les informations liées à la facturation ? */
    withBilling: boolean,
};

type Data = {
    selected: EventDetails | null,
    isSelecting: boolean,
};

/** Import de la liste de matériel à partir d'un événement. */
const ImportFromEvent = defineComponent({
    name: 'ImportFromEvent',
    modal: {
        width: 700,
        draggable: true,
        clickToClose: true,
    },
    props: {
        bookable: {
            type: Object as PropType<Props['bookable']>,
            default: undefined,
        },
        materials: {
            type: Array as PropType<Props['materials']>,
            required: true,
        },
        withBilling: {
            type: Boolean as PropType<Required<Props>['withBilling']>,
            default: false,
        },
    },
    emits: ['close'],
    data: (): Data => ({
        selected: null,
        isSelecting: false,
    }),
    computed: {
        excludedEventId(): Event['id'] | null {
            const { bookable } = this;
            if (!bookable || ![BookingEntity.EVENT, BookableEntity.EVENT].includes(bookable.entity)) {
                return null;
            }
            return bookable.id;
        },
    },
    methods: {
        async handleSelect(id: number) {
            const { $t: __ } = this;

            if (this.isSelecting) {
                return;
            }
            this.isSelecting = true;

            try {
                this.selected = await apiEvents.one(id);
            } catch {
                this.selected = null;
                this.$toasted.error(__('errors.unexpected-while-selecting'));
            } finally {
                this.isSelecting = false;
            }
        },

        handleClearSelection() {
            this.selected = null;
        },

        handleSubmit() {
            const { selected } = this;
            this.$emit('close', selected);
        },

        handleClose() {
            this.$emit('close');
        },
    },
    render() {
        const {
            $t: __,
            excludedEventId,
            materials,
            isSelecting,
            selected,
            withBilling,
            handleClose,
            handleSelect,
            handleSubmit,
            handleClearSelection,
        } = this;

        const renderSelection = (): JSX.Element | null => {
            if (isSelecting) {
                return <Loading />;
            }

            if (selected === null) {
                return null;
            }

            return (
                <Selected
                    event={selected}
                    allMaterials={materials}
                    withBilling={withBilling}
                />
            );
        };

        const bodyClassNames = {
            'ImportFromEvent__body': true,
            'ImportFromEvent__body--has-selected': selected !== null,
        };

        return (
            <div class="ImportFromEvent">
                <div class="ImportFromEvent__header">
                    <h2 class="ImportFromEvent__header__title">
                        {__('choose-event-to-reuse-materials-list')}
                    </h2>
                    <Button
                        type="close"
                        class="ImportFromEvent__header__close-button"
                        onClick={handleClose}
                    />
                </div>
                <div class={bodyClassNames}>
                    <div class="ImportFromEvent__search">
                        <Search
                            exclude={excludedEventId}
                            onSelect={handleSelect}
                        />
                    </div>
                    {renderSelection()}
                </div>
                {selected !== null && (
                    <div class="ImportFromEvent__footer">
                        <Button type="primary" icon="check" onClick={handleSubmit}>
                            {__('use-these-materials')}
                        </Button>
                        <Button icon="random" onClick={handleClearSelection}>
                            {__('choose-another-one')}
                        </Button>
                    </div>
                )}
            </div>
        );
    },
});

export default ImportFromEvent;
