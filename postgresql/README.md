# PostgreSQL - Sistema de Backup y Restauración

Este directorio contiene la configuración de PostgreSQL con un sistema automatizado de backup y restauración para la base de datos `aportes`.

## Características

- **Backup manual**: Script para crear backups en formato `.dump`
- **Restauración automática**: Al iniciar el contenedor, restaura automáticamente el último backup si la base de datos está vacía
- **Configuración simplificada**: Variables de entorno para configurar la base de datos

## Estructura de Archivos

```
postgresql/
├── docker-compose.yml      # Configuración de Docker
├── .env                    # Variables de entorno (no versionado)
├── .env.example           # Ejemplo de variables de entorno
├── backup.sh              # Script para crear backups
├── init-db.sh             # Script de inicialización automática
├── backups/               # Directorio de backups (no versionado)
│   ├── .gitignore
│   └── aportes_backup.dump  # Último backup
└── README.md              # Este archivo
```

## Configuración Inicial

1. Copia el archivo de ejemplo de variables de entorno:
   ```bash
   cp .env.example .env
   ```

2. Edita `.env` si necesitas cambiar algún valor:
   ```bash
   POSTGRES_PASSWORD=password
   POSTGRES_PORT=5432
   POSTGRES_DB=aportes
   ```

## Uso

### Iniciar el Contenedor

```bash
cd postgresql
docker-compose up -d
```

**Comportamiento al iniciar:**
- Si existe `backups/aportes_backup.dump` y la base de datos está vacía, restaurará automáticamente el backup
- Si no existe backup, creará la base de datos vacía
- Si la base de datos ya tiene tablas, no hará nada

### Crear un Backup

Para crear un backup de la base de datos actual:

```bash
cd postgresql
./backup.sh
```

Esto creará:
- `backups/aportes_backup_YYYYMMDD_HHMMSS.dump` - Backup con timestamp
- `backups/aportes_backup.dump` - Enlace al backup más reciente (usado para restauración automática)

### Ver Logs del Contenedor

```bash
docker-compose logs -f postgres
```

### Detener el Contenedor

```bash
docker-compose down
```

**Nota:** Los datos se mantienen en el volumen `postgres_data` incluso después de detener el contenedor.

### Resetear Base de Datos con Backup

Si quieres resetear la base de datos al estado del último backup:

1. Detén y elimina el contenedor y volumen:
   ```bash
   docker-compose down -v
   ```

2. Inicia el contenedor nuevamente (restaurará automáticamente):
   ```bash
   docker-compose up -d
   ```

## Flujo de Trabajo Recomendado

### Desarrollo Local

1. Trabaja normalmente con tu base de datos
2. Antes de hacer cambios importantes, crea un backup:
   ```bash
   ./backup.sh
   ```
3. Si algo sale mal, puedes restaurar con `docker-compose down -v && docker-compose up -d`

### Compartir Datos con el Equipo

1. Crea un backup:
   ```bash
   ./backup.sh
   ```
2. Comparte el archivo `backups/aportes_backup.dump` con tu equipo
3. Tu equipo puede colocar el archivo en su carpeta `backups/` y hacer `docker-compose up -d`

## Detalles Técnicos

### Formato de Backup

Los backups se crean en formato **custom** de PostgreSQL (`.dump`):
- Comprimidos automáticamente
- Más rápidos de restaurar que SQL plano
- Incluyen toda la estructura y datos de la base de datos

### Volúmenes de Docker

- `postgres_data`: Volumen persistente para los datos de PostgreSQL
- `./backups`: Montado en `/backups` dentro del contenedor
- `./init-db.sh`: Script de inicialización ejecutado automáticamente

### Variables de Entorno

- `POSTGRES_PASSWORD`: Contraseña del usuario `postgres`
- `POSTGRES_PORT`: Puerto expuesto en el host (default: 5432)
- `POSTGRES_DB`: Nombre de la base de datos a crear (default: aportes)

## Conexión a la Base de Datos

### Desde el Host

```bash
psql -h localhost -p 5432 -U postgres -d aportes
# Password: password
```

### Desde otro contenedor Docker

```bash
postgresql://postgres:password@postgresdb:5432/aportes
```

## Troubleshooting

### El backup no se restaura automáticamente

- Verifica que el archivo existe en `backups/aportes_backup.dump`
- Verifica los logs: `docker-compose logs postgres`
- Asegúrate de que el volumen está limpio: `docker-compose down -v`

### Error de permisos en scripts

```bash
chmod +x backup.sh init-db.sh
```

### El contenedor no inicia

- Verifica que el puerto 5432 no esté en uso
- Revisa los logs: `docker-compose logs postgres`
- Verifica que el archivo `.env` existe y tiene los valores correctos

## Mantenimiento

### Limpieza de Backups Antiguos

Los backups no se eliminan automáticamente. Para limpiar backups antiguos:

```bash
cd backups
ls -lt  # Ver backups ordenados por fecha
rm aportes_backup_20240101_120000.dump  # Eliminar backup específico
```

### Verificar Tamaño de Backups

```bash
du -h backups/
```

## Seguridad

- Los archivos `.dump` NO están versionados en git (incluidos en `.gitignore`)
- El archivo `.env` NO está versionado (contiene contraseñas)
- Usa contraseñas fuertes en producción
- No compartas los archivos de backup públicamente (pueden contener datos sensibles)
