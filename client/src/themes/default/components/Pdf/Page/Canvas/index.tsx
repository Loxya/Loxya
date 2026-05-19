import { defineComponent } from 'vue';
import { getMaxCanvasPixels } from '@/globals/terminal';

import type { PropType, Raw } from 'vue';
import type { PDFPage, PDFRenderTask } from '@/utils/pdf';

type Props = {
    /** L'instance de la page à afficher. */
    page: Raw<PDFPage>,

    /** L'échelle souhaitée à appliquer à la page lors du rendu. */
    scale?: number,

    /**
     * Une largeur arbitraire optionnelle à appliquer au canvas.
     *
     * Si elle est spécifiée et différente de la taille "logique" pour l'échelle donnée,
     * le rendu sera "étiré" ou "contracté" (= qualité inférieure).
     *
     * Cela peut être utile pour patienter pendant la transition vers une meilleure
     * résolution qui est en cours de rendu, par exemple.
     */
    width?: number,

    /**
     * Une hauteur arbitraire optionnelle a appliquer au canvas.
     *
     * Voir {@link Props#width} pour plus de details a ce sujet (fonctionnement similaire).
     */
    height?: number,
};

type Data = {
    renderingTask: Raw<PDFRenderTask> | null,
    hasCriticalError: boolean,
};

/** Une page d'un PDF. */
const PdfPageCanvas = defineComponent({
    name: 'PdfPageCanvas',
    props: {
        page: {
            type: Object as PropType<Props['page']>,
            required: true,
        },
        scale: {
            type: Number as PropType<Required<Props>['scale']>,
            default: 1,
        },
        width: {
            type: Number as PropType<Props['width']>,
            default: undefined,
        },
        height: {
            type: Number as PropType<Props['height']>,
            default: undefined,
        },
    },
    data: (): Data => ({
        renderingTask: null,
        hasCriticalError: false,
    }),
    computed: {
        maxCanvasPixels(): number {
            return getMaxCanvasPixels();
        },
    },
    watch: {
        page() {
            this.doRender();
        },
        scale() {
            this.doRender();
        },
        hasCriticalError(hasCriticalError: boolean) {
            if (hasCriticalError) {
                throw new Error('Critical error occurred.');
            }
        },
    },
    mounted() {
        this.doRender();
    },
    beforeDestroy() {
        this.cancelRender();
    },
    methods: {
        async doRender() {
            const { page, scale, maxCanvasPixels } = this;
            const $canvas = this.$el as HTMLCanvasElement;

            this.cancelRender();

            let task: PDFRenderTask | null = null;
            try {
                let viewport = page.getViewport({ scale });

                const devicePixelRatio = window.devicePixelRatio || 1;

                // - Prevent "Canvas area exceeds the maximum limit" error.
                // @see https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/
                const requiredPixels = viewport.width * viewport.height;
                if (requiredPixels > maxCanvasPixels) {
                    const adjustedScale = (scale * maxCanvasPixels) / requiredPixels;
                    viewport = page.getViewport({ scale: adjustedScale });
                }

                $canvas.width = viewport.width * devicePixelRatio;
                $canvas.height = viewport.height * devicePixelRatio;

                if (!this.width) {
                    $canvas.style.width = `${viewport.width}px`;
                }
                if (!this.height) {
                    $canvas.style.height = `${viewport.height}px`;
                }

                const context = $canvas.getContext('2d')!;
                context.scale(devicePixelRatio, devicePixelRatio);

                task = page.render({
                    canvas: $canvas,
                    intent: 'display',
                    canvasContext: context,
                    viewport,
                });
                await task.promise;
            } catch (error) {
                if (task === this.renderingTask) {
                    // eslint-disable-next-line no-console
                    console.error('Error occurred while rendering a PDF page', error);

                    this.hasCriticalError = true;
                }
            } finally {
                if (task === this.renderingTask) {
                    this.renderingTask = null;
                }
            }
        },

        cancelRender() {
            const task = this.renderingTask;
            this.renderingTask = null;
            task?.cancel();
        },
    },
    render() {
        const { width, height } = this;

        return (
            <canvas
                style={{
                    width: width !== undefined ? `${width}px` : undefined,
                    height: height !== undefined ? `${height}px` : undefined,
                }}
            />
        );
    },
});

export default PdfPageCanvas;
