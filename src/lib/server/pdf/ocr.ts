import type { PDFDocumentProxy } from 'pdfjs-dist';

export type OcrResult = {
	text: string;
	language: string;
	engine: 'tesseract';
};

async function loadPdfJs() {
	// Usar la build legacy para Node.js
	const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
	return pdfjs;
}

async function rasterizeFirstPage(buffer: Buffer): Promise<{ imageData: ImageData }> {
	const pdfjs = await loadPdfJs();
	const { createRequire } = await import('module');
	const require = createRequire(import.meta.url);
	const standardFontDataUrl = require.resolve('pdfjs-dist/package.json').replace('package.json', 'standard_fonts/');

	const uint8 = new Uint8Array(buffer);
	const loadingTask = pdfjs.getDocument({ data: uint8, standardFontDataUrl });
	const pdf: PDFDocumentProxy = await loadingTask.promise as unknown as PDFDocumentProxy;
	const page = await pdf.getPage(1);
	const viewport = page.getViewport({ scale: 2 });
	const { createCanvas } = await import('@napi-rs/canvas');
	const canvas = createCanvas(viewport.width, viewport.height);
	const ctx = canvas.getContext('2d');
	const renderContext = {
		canvasContext: ctx as unknown as CanvasRenderingContext2D,
		viewport
	};
	// @ts-ignore
	await page.render(renderContext).promise;
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	return { imageData: imageData as any };
}

export async function ocrPdfFirstPage(buffer: Buffer): Promise<OcrResult | null> {
	try {
		const { imageData } = await rasterizeFirstPage(buffer);
		// @ts-ignore - tesseract.js no tiene tipos oficiales
		const { createWorker } = await import('tesseract.js');
		const worker = await createWorker(['spa', 'eng']);
		const { data } = await worker.recognize(imageData);
		await worker.terminate();
		return { text: data.text || '', language: data?.language || 'spa+eng', engine: 'tesseract' };
	} catch (e) {
		console.error('[ocr] Error en OCR de primera página del PDF:', e instanceof Error ? e.message : e);
		return null;
	}
}


