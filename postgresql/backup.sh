#!/bin/bash

# Script para hacer backup de la base de datos aportes
# Uso: ./backup.sh

set -e

# Configuración
CONTAINER_NAME="postgresdb"
DB_NAME="aportes"
DB_USER="postgres"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="aportes_backup_${TIMESTAMP}.dump"
LATEST_BACKUP="aportes_backup.dump"

# Verificar que el contenedor está corriendo
if ! docker ps | grep -q $CONTAINER_NAME; then
    echo "❌ Error: El contenedor $CONTAINER_NAME no está corriendo"
    exit 1
fi

# Crear directorio de backups si no existe
mkdir -p $BACKUP_DIR

echo "📦 Creando backup de la base de datos '$DB_NAME'..."

# Crear backup con pg_dump en formato custom
docker exec $CONTAINER_NAME pg_dump -U $DB_USER -Fc -b -v -f /tmp/$BACKUP_FILE $DB_NAME

# Copiar el backup del contenedor al host
docker cp $CONTAINER_NAME:/tmp/$BACKUP_FILE $BACKUP_DIR/$BACKUP_FILE

# Eliminar el backup temporal del contenedor
docker exec $CONTAINER_NAME rm /tmp/$BACKUP_FILE

# Crear/actualizar el enlace al backup más reciente
cp $BACKUP_DIR/$BACKUP_FILE $BACKUP_DIR/$LATEST_BACKUP

echo "✅ Backup completado exitosamente!"
echo "📁 Archivo: $BACKUP_DIR/$BACKUP_FILE"
echo "🔗 Link al más reciente: $BACKUP_DIR/$LATEST_BACKUP"
echo "📊 Tamaño: $(du -h $BACKUP_DIR/$BACKUP_FILE | cut -f1)"
