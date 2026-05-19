import * as pdfjs from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/worker';

//
// - Types
//

import type {
    PDFDocumentLoadingTask,
    PDFPageProxy as PDFPage,
    PDFDocumentProxy as PDFDocument,
} from 'pdfjs-dist';

export type PDFRenderTask = ReturnType<PDFPage['render']>;
export type PageViewport = ReturnType<PDFPage['getViewport']>;
export type { PDFPage, PDFDocument, PDFDocumentLoadingTask };

//
// - Base export
//

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

export default pdfjs;
