// Shim para pdf-parse que evita cargar archivos de prueba durante el desarrollo
export default function pdfParse() {
  // Devolver una promesa rechazada con un mensaje claro
  return Promise.reject(new Error('pdf-parse no está disponible en el cliente. Usa esta función solo en el servidor.'));
}

// Asegurarse de que la función tenga las mismas propiedades que el módulo original
pdfParse.version = '1.1.1';
pdfParse.PDFData = class {};
