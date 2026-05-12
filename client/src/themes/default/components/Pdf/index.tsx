import './index.scss';
import pdfjs from '@/utils/pdf';
import Page from './Page';
import { defineComponent, markRaw } from 'vue';

import type { PropType, Raw } from 'vue';
import type {
    PDFDocument,
    PDFDocumentLoadingTask,
} from '@/utils/pdf';

type Props = {
    /** L'URL du PDF à afficher. */
    src: string,

    /** Fonction appelée lorsque le PDF est prêt à être affiché. */
    onReady?(): void,
};

type Data = {
    pdf: Raw<PDFDocument> | null,
    width: number | null,
    loadingTask: Raw<PDFDocumentLoadingTask> | null,
    hasError: boolean,
};

type InstanceProperties = {
    resizeObserver: ResizeObserver | undefined,
};

/** Un PDF. */
const Pdf = defineComponent({
    name: 'Pdf',
    props: {
        src: {
            type: String as PropType<Props['src']>,
            required: true,
        },
        // eslint-disable-next-line vue/no-unused-properties
        onReady: {
            type: Function as PropType<Props['onReady']>,
            default: undefined,
        },
    },
    emits: ['ready'],
    setup: (): InstanceProperties => ({
        resizeObserver: undefined,
    }),
    data: (): Data => ({
        pdf: null,
        width: null,
        loadingTask: null,
        hasError: false,
    }),
    computed: {
        isFetched(): boolean {
            return this.pdf !== null;
        },

        isReady(): boolean {
            return this.isFetched && !this.hasError;
        },

        pagesCount(): number | null {
            const { pdf } = this;
            return pdf?.numPages ?? null;
        },
    },
    watch: {
        src() {
            this.load();
        },
        isReady: {
            handler(isNowReady: boolean) {
                if (!isNowReady) {
                    this.resizeObserver?.disconnect();
                    return;
                }

                this.$emit('ready');
                this.$nextTick(() => { this.registerWidthObserver(); });
            },
            immediate: true,
        },
    },
    mounted() {
        this.load();

        if (this.isReady) {
            this.registerWidthObserver();
        }
    },
    beforeDestroy() {
        this.cancelLoad();

        this.resizeObserver?.disconnect();
    },
    methods: {
        registerWidthObserver() {
            const $container = this.$refs.container as HTMLElement | undefined;
            if (!this.isReady || $container === undefined) {
                return;
            }

            const updateWidth = (): void => {
                if (!this.isReady || !$container?.isConnected) {
                    return;
                }
                const { width } = $container.getBoundingClientRect();
                this.width = Math.round(width);
            };
            updateWidth();

            this.resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
                window.requestAnimationFrame((): void | undefined => {
                    if (!Array.isArray(entries) || !entries.length) {
                        return;
                    }
                    updateWidth();
                });
            });
            this.resizeObserver.observe($container);
        },

        async load(forceRefresh: boolean = false) {
            const { src } = this;
            const url = ((): string => {
                if (!forceRefresh) {
                    return src;
                }

                const _url = new URL(src);
                _url.searchParams.set('__refresh', Date.now().toString());
                return _url.toString();
            })();

            await this.cancelLoad();

            let task: PDFDocumentLoadingTask | null = null;
            try {
                task = markRaw(pdfjs.getDocument({ url }));
                this.loadingTask = task;

                const pdf = await task.promise;
                if (task === this.loadingTask) {
                    this.pdf = markRaw(pdf);
                }
            } catch (error) {
                if (task === this.loadingTask) {
                    // eslint-disable-next-line no-console
                    console.error(`Error occurred while loading PDF file (URL: ${src}): ${String(error)}`);

                    this.hasError = true;
                }
            } finally {
                if (task === this.loadingTask) {
                    this.loadingTask = null;
                }
            }
        },

        async cancelLoad() {
            const task = this.loadingTask;
            this.loadingTask = null;
            if (!task) {
                return;
            }

            try {
                await task.destroy();
            } catch {
                // - On ignore l'erreur qui n'est pas critique.
            }
        },

        // ------------------------------------------------------
        // -
        // -    API Publique
        // -
        // ------------------------------------------------------

        /**
         * Permet de demander le rechargement du PDF depuis la source.
         */
        async refresh() {
            await this.load(true);
        },
    },
    render() {
        const { pdf, width, isReady, pagesCount } = this;

        if (!isReady) {
            return null;
        }

        return (
            <div class="Pdf" ref="container">
                {Array.from({ length: pagesCount! }).map((_: any, index: number) => (
                    <Page
                        key={`${pdf!.fingerprints[0]!}--${index}`}
                        width={width ?? undefined}
                        number={index + 1}
                        pdf={pdf!}
                    />
                ))}
            </div>
        );
    },
});

export default Pdf;
