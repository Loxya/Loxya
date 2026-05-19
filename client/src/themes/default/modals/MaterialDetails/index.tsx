import './index.scss';
import { defineComponent } from 'vue';
import apiMaterials from '@/stores/api/materials';
import CriticalError from '@/themes/default/components/CriticalError';
import { Tab, Tabs } from '@/themes/default/components/Tabs';
import Loading from '@/themes/default/components/Loading';
import Button from '@/themes/default/components/Button';
import Infos from './tabs/Infos';

import type { PropType } from 'vue';
import type { Material, MaterialDetails } from '@/stores/api/materials';

/* eslint-disable @typescript-eslint/prefer-enum-initializers */
export enum TabIndex {
    INFOS,
}
/* eslint-enable @typescript-eslint/prefer-enum-initializers */

type Props = {
    /** Identifiant du matériel dont on veut afficher les détails. */
    id: Material['id'],

    /**
     * L'onglet actif par défaut à l'ouverture.
     *
     * @default TabIndex.INFOS
     */
    defaultTab?: TabIndex,

    /** Fonction appelée lorsque la modale est fermée. */
    onClose?(): void,
};

type Data = {
    material: MaterialDetails | null,
    hasCriticalError: boolean,
    isFetched: boolean,
    selectedTabIndex: number,
};

/** Modale de détails d'un matériel. */
const MaterialDetailsModal = defineComponent({
    name: 'MaterialDetailsModal',
    props: {
        id: {
            type: Number as PropType<Required<Props>['id']>,
            required: true,
        },
        defaultTab: {
            type: Number as PropType<Required<Props>['defaultTab']>,
            default: TabIndex.INFOS,
            validator: (value: unknown) => (
                Object.values(TabIndex).includes(value as any)
            ),
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
            material: null,
            hasCriticalError: false,
            isFetched: false,
            selectedTabIndex: this.defaultTab,
        };
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

        handleClose() {
            this.$emit('close');
        },

        handleTabChanged(index: number) {
            this.selectedTabIndex = index;
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        async fetchData() {
            try {
                this.material = await apiMaterials.one(this.id);
                this.isFetched = true;
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error(`Error occurred while retrieving event details:`, error);
                this.hasCriticalError = true;
            }
        },

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `modal.material-details.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            material,
            isFetched,
            defaultTab,
            hasCriticalError,
            handleTabChanged,
            handleClose,
        } = this;

        if (hasCriticalError || !isFetched || !material) {
            return (
                <div class="MaterialDetailsModal MaterialDetailsModal--not-ready">
                    <div class="MaterialDetailsModal__close">
                        <Button type="close" onClick={handleClose} />
                    </div>
                    <div class="MaterialDetailsModal__body">
                        {(
                            !hasCriticalError
                                ? <Loading class="MaterialDetailsModal__loading" />
                                : <CriticalError />
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div class="MaterialDetailsModal">
                <header class="MaterialDetailsModal__header">
                    <div class="MaterialDetailsModal__header__title">
                        <h2 class="MaterialDetailsModal__header__title__name">{material.name}</h2>
                        <div class="MaterialDetailsModal__header__title__reference">
                            {__('global.ref-ref', { reference: material.reference })}
                        </div>
                    </div>
                    <div class="MaterialDetailsModal__header__actions">
                        <Button
                            type="default"
                            icon="eye"
                            to={{
                                name: 'view-material',
                                params: { id: material.id.toString() },
                            }}
                            collapsible
                        >
                            {__('global.action-view')}
                        </Button>
                        <Button
                            type="edit"
                            to={{
                                name: 'edit-material',
                                params: { id: material.id.toString() },
                            }}
                            collapsible
                        >
                            {__('global.action-edit')}
                        </Button>
                    </div>
                    <Button
                        type="close"
                        class="MaterialDetailsModal__header__close-button"
                        onClick={handleClose}
                    />
                </header>
                <div class="MaterialDetailsModal__body">
                    <Tabs defaultActive={defaultTab} onChanged={handleTabChanged}>
                        <Tab id={TabIndex.INFOS} title={__('informations.title')} icon="info-circle">
                            <Infos material={material} />
                        </Tab>
                    </Tabs>
                </div>
            </div>
        );
    },
});

export default MaterialDetailsModal;
