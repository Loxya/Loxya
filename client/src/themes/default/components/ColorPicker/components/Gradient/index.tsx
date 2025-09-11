import './index.scss';
import { defineComponent, markRaw } from 'vue';
import throttle from 'lodash/throttle';
import Color from '@/utils/color';

import type { PropType, Raw } from 'vue';
import type { HexColorString, HsvaColorObject } from '@/utils/color';
import type { DebouncedMethod } from 'lodash';

type InstanceProperties = {
    debouncedMoveMarker: (
        | DebouncedMethod<typeof ColorPickerGradient, 'moveMarker'>
        | undefined
    ),
};

type Props = {
    /** Couleur actuelle. */
    color: Color,

    /**
     * Fonction appelée lorsque la valeur sélectionnée change.
     *
     * @param newColor - La nouvelle couleur sélectionnée.
     */
    onChange?(newColor: Raw<Color>): void,
};

/** Sélecteur de couleur à partir d'un dégradé. */
const ColorPickerGradient = defineComponent({
    name: 'ColorPickerGradient',
    props: {
        color: {
            type: Object as PropType<Required<Props>['color']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['change'],
    setup: (): InstanceProperties => ({
        debouncedMoveMarker: undefined,
    }),
    computed: {
        hue(): number {
            return this.color.getHue();
        },

        hex(): HexColorString {
            return this.color.toHexString();
        },

        hsva(): HsvaColorObject {
            return this.color.toHsv();
        },
    },
    created() {
        this.debouncedMoveMarker = throttle(this.moveMarker.bind(this), 50);

        // - Binding.
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
    },
    beforeDestroy() {
        this.debouncedMoveMarker?.cancel();

        document.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('touchmove', this.handleTouchMove);
        document.removeEventListener('touchend', this.handleTouchEnd);
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleClick(event: MouseEvent) {
            event.stopPropagation();

            this.moveMarker(event.pageX, event.pageY);
        },

        //
        // - Mouse events.
        //

        handleMouseMove(event: MouseEvent) {
            event.preventDefault();
            event.stopPropagation();

            this.debouncedMoveMarker!(event.pageX, event.pageY);
        },

        handleMouseUp() {
            document.removeEventListener('mousemove', this.handleMouseMove);
        },

        handleMouseDown() {
            document.addEventListener('mousemove', this.handleMouseMove);
            document.addEventListener('mouseup', this.handleMouseUp);
        },

        //
        // - Touch events.
        //

        handleTouchMove(event: TouchEvent) {
            event.preventDefault();
            event.stopPropagation();

            const { pageX, pageY } = event.changedTouches[0];
            this.debouncedMoveMarker!(pageX, pageY);
        },

        handleTouchEnd() {
            document.removeEventListener('touchmove', this.handleTouchMove);
        },

        handleTouchStart() {
            document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
            document.addEventListener('touchend', this.handleTouchEnd);
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        moveMarker(pageX: number, pageY: number) {
            const containerPos = (this.$refs.container as HTMLDivElement).getBoundingClientRect();
            let x = pageX - (containerPos.left + window.pageXOffset);
            let y = pageY - (containerPos.top + window.pageYOffset);

            x = x < 0 ? 0 : Math.min(x, containerPos.width);
            y = y < 0 ? 0 : Math.min(y, containerPos.height);

            const newColor = markRaw(new Color({
                h: this.hsva.h,
                s: (x / containerPos.width),
                v: (1 - (y / containerPos.height)),
                a: this.hsva.a,
            }));

            this.$emit('change', newColor);
            (this.$refs.marker as HTMLDivElement | undefined)?.focus();
        },
    },
    render() {
        const {
            hex,
            hue,
            hsva,
            handleClick,
            handleMouseDown,
            handleTouchStart,
        } = this;

        return (
            <div
                ref="container"
                role="application"
                class="ColorPickerGradient"
                onClick={handleClick}
                onMousedown={handleMouseDown}
                onTouchstart={handleTouchStart}
                style={{
                    '--ColorPickerGradient--color': hex,
                    '--ColorPickerGradient--hue': hue,
                }}
            >
                <div
                    ref="marker"
                    class="ColorPickerGradient__marker"
                    onMousedown={handleMouseDown}
                    onTouchstart={handleTouchStart}
                    tabindex="0"
                    style={{
                        top: `${-(hsva.v * 100) + 100}%`,
                        left: `${hsva.s * 100}%`,
                    }}
                />
            </div>
        );
    },
});

export default ColorPickerGradient;
