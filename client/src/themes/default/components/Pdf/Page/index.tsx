import './index.scss';
import Canvas from './Canvas';
import { defineComponent, markRaw } from 'vue';

import type { PropType, Raw } from 'vue';
import type { PDFDocument, PDFPage } from '@/utils/pdf';

type Props = {
    /** L'instance du PDF dans lequel la page à afficher se trouve. */
    pdf: Raw<PDFDocument>,

    /** Le numéro de la page à afficher. */
    number: number,

    /**
     * La largeur du viewport de la page.
     *
     * Si non défini, la page utilise sa largeur par défaut (scale: 1).
     */
    width?: number,
};

type Data = {
    page: Raw<PDFPage> | null,
    loadingTask: Raw<Promise<PDFPage>> | null,
    hasCriticalError: boolean,
};

/** Une page d'un PDF. */
const PdfPage = defineComponent({
    name: 'PdfPage',
    props: {
        pdf: {
            type: Object as PropType<Props['pdf']>,
            required: true,
        },
        number: {
            type: Number as PropType<Props['number']>,
            required: true,
        },
        width: {
            type: Number as PropType<Props['width']>,
            default: undefined,
        },
    },
    data: (): Data => ({
        page: null,
        loadingTask: null,
        hasCriticalError: false,
    }),
    computed: {
        scale(): number | null {
            const { page } = this;
            if (page === null) {
                return null;
            }

            let baseScale = page.getViewport({ scale: 1 }).width;
            if (this.width !== undefined) {
                baseScale = this.width / baseScale;
            }

            return baseScale;
        },

        size(): { width: number, height: number } | null {
            const { page, scale } = this;
            if (page === null || scale === null) {
                return null;
            }

            const viewport = page.getViewport({ scale });
            return {
                width: Math.floor(viewport.width),
                height: Math.floor(viewport.height),
            };
        },
    },
    watch: {
        pdf() {
            this.load();
        },
        number() {
            this.load();
        },
    },
    errorCaptured() {
        this.hasCriticalError = true;
        return false;
    },
    mounted() {
        this.load();
    },
    methods: {
        async load() {
            const { pdf, number } = this;
            this.loadingTask = null;

            let task: Promise<PDFPage> | null = null;
            try {
                task = markRaw(pdf.getPage(number));
                this.loadingTask = task;

                const page = await task;
                if (task === this.loadingTask) {
                    this.page = markRaw(page);
                }
            } catch (error) {
                if (task === this.loadingTask) {
                    // eslint-disable-next-line no-console
                    console.error(`Error occurred while loading PDF page #${number}: ${String(error)}`);

                    this.hasCriticalError = true;
                }
            } finally {
                if (task === this.loadingTask) {
                    this.loadingTask = null;
                }
            }
        },
    },
    render() {
        const { page, size, scale, hasCriticalError } = this;
        const isFetched = page !== null;

        if (hasCriticalError || !isFetched) {
            return null;
        }

        return (
            <div
                class="PdfPage"
                style={{
                    width: size !== null ? `${size.width}px` : undefined,
                    height: size !== null ? `${size.height}px` : undefined,
                }}
            >
                <Canvas
                    class="PdfPage__canvas"
                    height={size?.height}
                    width={size?.width}
                    scale={scale!}
                    page={page}
                />
            </div>
        );
    },
});

export default PdfPage;
