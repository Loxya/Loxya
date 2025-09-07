import './index.scss';
import Color from '@/utils/color';
import { defineComponent, markRaw } from 'vue';
import Gradient from './components/Gradient';
import config from '@/globals/config';

import type { RawColor } from '@/utils/color';
import type { PropType, Raw } from 'vue';

/** Mode de gestion de la transparence. */
export enum AlphaMode {
    AUTO = 'auto',
    FORCE = 'force',
    NONE = 'none',
}

type Props = {
    /**
     * Valeur (= couleur) actuelle.
     *
     * Peut-être fournie en différent formats:
     * - Une chaîne de caractère représentant une couleur (e.g. `#ffffff`, `rgb(255, 255, 255)`, etc.)
     * - Un objet littéral représentant une couleur (e.g. `{ r: 255, g: 255, b: 255, a: 0.5 }`)
     * - Une instance de `Color` (e.g. `new Color('#ffffff')`).
     * - La valeur `null` si le champ est "vide".
     */
    value: Color | RawColor | null,

    /** Échantillons de couleur à proposer. */
    swatches?: RawColor[],

    /**
     * Mode de gestion de la transparence parmi:
     * - `auto`: La transparence est gérée automatiquement en fonction de la couleur sélectionnée.
     *           Si de la transparence est ajoutée à une couleur, c'est la version avec alpha qui
     *           sera retournée (RGBA, HSLA, etc.)) (défaut)
     * - `none`: La gestion de la transparence est désactivée et les couleurs sous toujours retournées
     *           en version "opaque" (RGB, HSL, etc.)
     * - `force`: La gestion de la transparence est activée et les couleurs sont toujours retournées
     *            avec gestion de la transparence activée (RGBA, HSLA, etc.)
     */
    alphaMode?: AlphaMode | `${AlphaMode}`,

    /**
     * Fonction appelée lorsque la couleur sélectionnée a changé.
     *
     * @param newValue - La nouvelle couleur.
     */
    onChange?(newValue: Raw<Color>): void,
};

/**
 * This component is highly based on Mohammed Bassit work
 * on `Coloris` package (https://github.com/mdbassit/Coloris). This
 * package is subject to the MIT License whose terms are as follows:
 *
 *    Copyright 2021 Mohammed Bassit
 *
 *    Permission is hereby granted, free of charge, to any person
 *    obtaining a copy of this software and associated documentation
 *    files (the "Software"), to deal in the Software without restriction,
 *    including without limitation the rights to use, copy, modify, merge,
 *    publish, distribute, sublicense, and/or sell copies of the Software,
 *    and to permit persons to whom the Software is furnished to do so,
 *    subject  to the following conditions:
 *
 *    The above copyright notice and this permission notice shall be
 *    included in all copies or substantial portions of the Software.
 *
 *    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 *    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 *    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE
 *    AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 *    HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 *    WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 *    FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE
 *    OR OTHER DEALINGS IN THE SOFTWARE.
 */
const ColorPicker = defineComponent({
    name: 'ColorPicker',
    props: {
        value: {
            type: [String, Object] as PropType<Required<Props>['value']>,
            default: null,
            validator: (value: unknown | null) => (
                value === null || Color.isValid(value)
            ),
        },
        swatches: {
            type: Array as PropType<Required<Props>['swatches']>,
            default: () => config.colorSwatches ?? [
                '#264653', '#40606c', '#597986',
                '#2a9d8f', '#44b6a8', '#5dd0c2',
                '#f4a261', '#ffbb7a', '#ffd594',
                '#e9c46a', '#ffde84', '#fff79d',
                '#d62828', '#f04242', '#ff5b5b',
                '#e76f51', '#ff886a', '#ffa284',
                '#023e8a', '#1b58a3', '#0077b6',
                '#0096c7', '#00b4d8', '#48cae4',
            ],
            validator: (values: unknown) => {
                if (!Array.isArray(values)) {
                    return false;
                }
                return !values.some((value: unknown) => !Color.isValid(value));
            },
        },
        alphaMode: {
            type: String as PropType<Required<Props>['alphaMode']>,
            default: AlphaMode.AUTO,
            validator: (value: unknown) => {
                if (typeof value !== 'string') {
                    return false;
                }
                return (Object.values(AlphaMode) as string[]).includes(value);
            },
        },
        // eslint-disable-next-line vue/no-unused-properties
        onChange: {
            type: Function as PropType<Props['onChange']>,
            default: undefined,
        },
    },
    emits: ['change'],
    computed: {
        color(): Color {
            if (this.value === null || !Color.isValid(this.value)) {
                return new Color('#000000');
            }
            return new Color(this.value);
        },

        hue(): number {
            return this.color.getHue();
        },

        alpha(): number {
            return this.color.getAlpha();
        },

        formattedSwatches(): Color[] {
            return this.swatches
                .filter((rawColor: RawColor) => Color.isValid(rawColor))
                .map((rawColor: RawColor) => new Color(rawColor));
        },
    },
    methods: {
        // ------------------------------------------------------
        // -
        // -    Handlers
        // -
        // ------------------------------------------------------

        handleContainerMouseDown(event: MouseEvent) {
            event.stopPropagation();
        },

        handleGradientChange(newColor: Raw<Color>) {
            this.$emit('change', newColor);
        },

        handleHueChange(e: Event) {
            const hue = +((e.target! as HTMLInputElement).value);
            this.$emit('change', markRaw(this.color.withHue(hue)));
        },

        handleAlphaChange(e: Event) {
            const alpha = +((e.target! as HTMLInputElement).value) / 100;
            this.$emit('change', markRaw(this.color.withAlpha(alpha)));
        },

        handleSwatchClick(color: Color) {
            this.$emit('change', markRaw(color));
        },

        // ------------------------------------------------------
        // -
        // -    Méthodes internes
        // -
        // ------------------------------------------------------

        __(key: string, params?: Record<string, number | string>, count?: number): string {
            key = !key.startsWith('global.')
                ? `components.ColorPicker.${key}`
                : key.replace(/^global\./, '');

            return this.$t(key, params, count);
        },
    },
    render() {
        const {
            __,
            hue,
            color,
            alpha,
            alphaMode,
            formattedSwatches,
            handleHueChange,
            handleSwatchClick,
            handleAlphaChange,
            handleGradientChange,
            handleContainerMouseDown,
        } = this;

        return (
            <div
                class="ColorPicker"
                onMousedown={handleContainerMouseDown}
                style={{
                    '--ColorPicker--hue': color.getHue(),
                    '--ColorPicker--color': color.toRgbaString(),
                    '--ColorPicker--opaque-color': color.toHexString(),
                }}
            >
                <Gradient color={color} onChange={handleGradientChange} />
                <div class="ColorPicker__body">
                    <div class="ColorPicker__hue">
                        <input
                            type="range"
                            min="0"
                            max="360"
                            step="1"
                            value={hue}
                            onInput={handleHueChange}
                            class="ColorPicker__hue__slider"
                            aria-label={__('hue-slider')}
                        />
                        <div
                            class="ColorPicker__hue__marker"
                            style={{ left: `${(hue / 360) * 100}%` }}
                        />
                    </div>
                    {alphaMode !== AlphaMode.NONE && (
                        <div class="ColorPicker__alpha">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="1"
                                value={alpha}
                                onInput={handleAlphaChange}
                                class="ColorPicker__alpha__slider"
                                aria-label={__('alpha-slider')}
                            />
                            <div
                                class="ColorPicker__alpha__marker"
                                style={{ left: `${alpha * 100}%` }}
                            />
                            <span class="ColorPicker__alpha__current-color" />
                        </div>
                    )}
                    {formattedSwatches.length > 0 && (
                        <div class="ColorPicker__swatches">
                            {formattedSwatches.map((swatch: Color, index: number) => {
                                const colorHex = swatch.toHexString();
                                return (
                                    <button
                                        key={`${colorHex}-${index}`}
                                        type="button"
                                        class="ColorPicker__swatches__color"
                                        style={{ '--ColorPicker__swatches__color--color': colorHex }}
                                        onClick={() => { handleSwatchClick(swatch); }}
                                        aria-label={__('color-swatch', { color: colorHex })}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    },
});

export default ColorPicker;
