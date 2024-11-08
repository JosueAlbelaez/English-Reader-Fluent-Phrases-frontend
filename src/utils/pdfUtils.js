import { PDFDocument } from 'pdf-lib';

export const createAnnotatedPDF = async (originalPdfBytes, annotations) => {
  try {
    const pdfDoc = await PDFDocument.load(originalPdfBytes);
    const pages = pdfDoc.getPages();

    // Agrupar anotaciones por página
    const annotationsByPage = annotations.reduce((acc, annotation) => {
      const pageIndex = annotation.position.pageIndex;
      if (!acc[pageIndex]) acc[pageIndex] = [];
      acc[pageIndex].push(annotation);
      return acc;
    }, {});

    // Aplicar anotaciones a cada página
    Object.entries(annotationsByPage).forEach(([pageIndex, pageAnnotations]) => {
      const page = pages[parseInt(pageIndex)];
      
      pageAnnotations.forEach(annotation => {
        if (annotation.type === 'highlight') {
          // Agregar highlight como rectangulo semi-transparente
          page.drawRectangle({
            x: annotation.position.boundingRect.x1,
            y: page.getHeight() - annotation.position.boundingRect.y2,
            width: annotation.position.boundingRect.x2 - annotation.position.boundingRect.x1,
            height: annotation.position.boundingRect.y2 - annotation.position.boundingRect.y1,
            color: [1, 1, 0, 0.3],
          });
        } else if (annotation.type === 'note') {
          // Agregar nota como texto
          page.drawText(annotation.content, {
            x: annotation.position.boundingRect.x1,
            y: page.getHeight() - annotation.position.boundingRect.y1,
            size: 12,
            color: [0, 0, 0, 1],
          });
        }
      });
    });

    return await pdfDoc.save();
  } catch (error) {
    console.error('Error creating annotated PDF:', error);
    throw error;
  }
};

export const extractTextFromPDF = async (pdfBytes) => {
  // Implementar extracción de texto si es necesario
  // Este es un placeholder - normalmente usarías pdf.js o similar
  return '';
};