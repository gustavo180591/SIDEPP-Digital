import { readFileSync } from 'fs';
import { join } from 'path';

const PDF_DIR = join(process.cwd(), 'pdfs');

async function testPdfUpload() {
  console.log('📤 Probando carga de PDFs...\n');

  const files = [
    { name: '0205 - Listado_1.pdf', label: 'Aportes FOPID' },
    { name: '0205 - Listado.pdf', label: 'Aportes Sueldos' }
  ];

  for (const file of files) {
    try {
      const filePath = join(PDF_DIR, file.name);
      const fileBuffer = readFileSync(filePath);
      const blob = new Blob([fileBuffer], { type: 'application/pdf' });

      const formData = new FormData();
      formData.append('file', blob, file.name);
      formData.append('selectedPeriod', '2024-11');
      formData.append('allowOCR', 'true');

      console.log(`📄 Subiendo ${file.label}: ${file.name}`);

      const response = await fetch('http://localhost:5173/api/analyzer-pdf-aportes', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Error al subir ${file.name}:`, error);
        continue;
      }

      const result = await response.json();
      console.log(`✅ ${file.label} procesado:`);
      console.log(`   - Clasificación: ${result.classification}`);
      console.log(`   - Personas: ${result.preview?.listado?.personas?.length || 0}`);
      console.log(`   - Total: ${result.preview?.listado?.tableData?.montoConcepto || 0}`);
      console.log('');
    } catch (error) {
      console.error(`❌ Error con ${file.name}:`, error);
    }
  }

  console.log('✅ Prueba completada\n');
  console.log('Verificando base de datos...');
}

testPdfUpload().catch(console.error);
