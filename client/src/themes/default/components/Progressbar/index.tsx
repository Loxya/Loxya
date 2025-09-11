import './index.scss';
import { defineComponent } from 'vue';

import type { PropType } from 'vue';

export type Props = {
    /** Le pourcentage actuel de la barre de progression. */
    percent: number,

    /** Dois-t'on afficher une version minimaliste de la barre de progression ? */
    minimalist?: boolean,
};

/** Barre de progression. */
const Progressbar = defineComponent({
    name: 'Progressbar',
    props: {
        percent: {
            type: Number as PropType<Required<Props>['percent']>,
            required: true,
        },
        minimalist: {
            type: Boolean as PropType<Required<Props>['minimalist']>,
            default: false,
        },
    },
    computed: {
        humanPercent(): number {
            return Math.round(this.percent);
        },
    },
    render() {
        const { $t: __, percent, humanPercent, minimalist } = this;

        const className = ['Progressbar', {
            'Progressbar--minimalist': minimalist,
        }];

        return (
            <div class={className}>
                <div class="Progressbar__progress" style={{ width: `${percent}%` }}>
                    {!minimalist && percent < 100 && <span>{humanPercent}%</span>}
                    {!minimalist && percent === 100 && <span>{__('almost-done')}</span>}
                </div>
            </div>
        );
    },
});

export default Progressbar;
