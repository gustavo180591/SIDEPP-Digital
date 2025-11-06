#!/bin/bash

# Script de inicialización para restaurar backup automáticamente
# Este script se ejecuta automáticamente cuando el contenedor se crea por primera vez
# Si existe un backup en /backups/aportes_backup.dump, lo restaura

set -e

BACKUP_FILE="/backups/aportes_backup.dump"
DB_NAME="aportes"

echo "🔍 Verificando si existe backup para restaurar..."

# Verificar si existe el archivo de backup
if [ -f "$BACKUP_FILE" ]; then
    echo "📦 Backup encontrado: $BACKUP_FILE"

    # Esperar a que PostgreSQL esté listo
    echo "⏳ Esperando a que PostgreSQL esté listo..."
    until pg_isready -U postgres -d postgres; do
        sleep 1
    done

    echo "✅ PostgreSQL está listo"

    # Verificar si la base de datos ya tiene tablas
    TABLE_COUNT=$(psql -U postgres -d $DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

    if [ "$TABLE_COUNT" -eq "0" ]; then
        echo "📥 Base de datos vacía, restaurando backup..."

        # Restaurar el backup
        pg_restore -U postgres -d $DB_NAME -v "$BACKUP_FILE"

        echo "✅ Backup restaurado exitosamente!"
    else
        echo "ℹ️  La base de datos ya contiene $TABLE_COUNT tablas, omitiendo restauración"
    fi
else
    echo "ℹ️  No se encontró backup en $BACKUP_FILE"
    echo "ℹ️  La base de datos '$DB_NAME' se creó vacía"
fi

echo "🚀 Inicialización completada"
