#!/bin/bash

# Ruta al archivo PDF de prueba
PDF_FILE="/home/gustavo/SIDEPP-Digital/uploads/0205 - Listado.pdf"

# Verificar que el archivo existe
if [ ! -f "$PDF_FILE" ]; then
  echo "Error: El archivo $PDF_FILE no existe"
  exit 1
fi

# URL del endpoint de la API
API_URL="http://localhost:5175/api/files"

# Realizar la petición POST con curl
echo "Subiendo archivo: $PDF_FILE"
curl -X POST \
  -F "file=@$PDF_FILE" \
  -F "institutionId=test-institution" \
  -F "periodId=test-period" \
  $API_URL

echo -e "\n\nPrueba completada. Verifica la salida anterior para ver el resultado."
