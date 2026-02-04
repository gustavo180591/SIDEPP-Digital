# SIDEPP Digital - Sistema de Gestión de Aportes

Sistema web para la gestión y análisis de aportes sindicales, desarrollado con SvelteKit.

## Tecnologías

- **Frontend**: SvelteKit 2.x, Svelte 5, TypeScript
- **Estilos**: Tailwind CSS
- **Base de datos**: PostgreSQL + Prisma ORM
- **Análisis PDF**: pdfjs-dist + OpenAI Vision API
- **Autenticación**: JWT con cookies HttpOnly
- **Deployment**: Docker + Nginx

## Requisitos

- Node.js 20+
- PostgreSQL 15+
- Docker y Docker Compose (para producción)
- Clave API de OpenAI (para análisis de PDFs)

## Instalación Local

```bash
# Clonar repositorio
git clone https://github.com/gustavo180591/SIDEPP-Digital.git
cd SIDEPP-Digital

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Ejecutar migraciones de base de datos
npx prisma migrate dev

# Iniciar servidor de desarrollo
npm run dev
```

## Variables de Entorno

```env
# Base de datos
DATABASE_URL="postgresql://user:password@localhost:5432/sidepp?schema=public"

# JWT
JWT_SECRET="tu-secret-seguro-de-al-menos-32-caracteres"

# OpenAI (para análisis de PDFs)
OPENAI_API_KEY="sk-..."

# Entorno
NODE_ENV="development"
```

## Estructura del Proyecto

```
src/
├── lib/
│   ├── server/           # Código solo servidor
│   │   ├── auth/         # Autenticación y middleware
│   │   ├── config.ts     # Configuración centralizada
│   │   ├── db.ts         # Cliente Prisma
│   │   ├── pdf/          # Parsers de PDF
│   │   └── storage.ts    # Manejo de archivos
│   └── utils/
│       ├── analyzer-pdf-ia/  # Análisis con IA
│       └── cuit-utils.ts     # Utilidades CUIT/CUIL
├── routes/
│   ├── api/
│   │   ├── analyzer-pdf-aportes/  # Endpoint análisis aportes
│   │   ├── analyzer-pdf-bank/     # Endpoint análisis transferencias
│   │   ├── files/[id]/download/   # Descarga/vista de PDFs
│   │   └── auth/                  # Login, logout, registro
│   └── dashboard/
│       ├── admin/archivos/        # Gestión de archivos
│       ├── instituciones/         # CRUD instituciones
│       ├── afiliados/             # Gestión de afiliados
│       └── reportes/              # Reportes y exportación
└── app.html
```

## Funcionalidades Principales

### Análisis de PDFs

El sistema analiza dos tipos de documentos:

1. **Listados de Aportes** (`/api/analyzer-pdf-aportes`)
   - Extrae información de aportes FOPID, Sueldos, Aguinaldo
   - Detecta institución por CUIT
   - Extrae listado de personas y montos
   - Valida que no sea un comprobante de transferencia

2. **Comprobantes de Transferencia** (`/api/analyzer-pdf-bank`)
   - Extrae datos de transferencias bancarias (Banco Macro)
   - Número de operación, CBU, importe, fecha
   - Valida que no sea un listado de aportes

### Gestión de Archivos

- Vista previa de PDFs en el navegador
- Descarga de archivos
- Eliminación con limpieza de registros relacionados
- Deduplicación por hash SHA-256

### Roles de Usuario

- **ADMIN**: Acceso completo, gestión de usuarios
- **OPERATOR**: Carga y gestión de aportes
- **VIEWER**: Solo lectura

## Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run preview      # Preview del build

# Base de datos
npx prisma migrate dev      # Aplicar migraciones (desarrollo)
npx prisma migrate deploy   # Aplicar migraciones (producción)
npx prisma studio           # UI para explorar datos
npx prisma generate         # Regenerar cliente

# Linting
npm run lint         # Ejecutar ESLint
npm run format       # Formatear con Prettier
```

## Deployment con Docker

```bash
# Build de imagen
docker build -t sidepp-digital .

# Ejecutar con docker-compose
docker-compose up -d
```

### Configuración Nginx (Producción)

```nginx
server {
    listen 80;
    server_name finanzas.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name finanzas.example.com;

    ssl_certificate /etc/letsencrypt/live/finanzas.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/finanzas.example.com/privkey.pem;

    # Timeouts para análisis de PDFs (pueden tardar con IA)
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    send_timeout 300s;
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## CI/CD

El proyecto usa GitHub Actions para deployment automático:

1. Push a `main` dispara el workflow
2. Build de imagen Docker
3. Push a servidor de producción
4. Restart del contenedor

Ver `.github/workflows/` para configuración.

## Logs

En producción, los errores se guardan en:
```
/data/logs/errors-YYYY-MM-DD.log
```

## Base de Datos

### Modelos Principales

- **User**: Usuarios del sistema
- **Institution**: Instituciones/empresas
- **Member**: Afiliados/miembros
- **PayrollPeriod**: Períodos de nómina (mes/año)
- **PdfFile**: Archivos PDF cargados
- **BankTransfer**: Transferencias bancarias
- **ContributionLine**: Líneas de aportes individuales

### Diagrama de Relaciones

```
Institution 1──N PayrollPeriod 1──N PdfFile
                              1──1 BankTransfer
                              1──N ContributionLine N──1 Member
```

## Troubleshooting

### Error "standardFontDataUrl"
Si aparece este error al analizar PDFs, verificar que la ruta de fuentes esté configurada:
```typescript
const standardFontDataUrl = `${process.cwd()}/node_modules/pdfjs-dist/standard_fonts/`;
```

### Timeout 504 en análisis
Aumentar timeouts en nginx (ver configuración arriba).

### PDFs escaneados no se analizan
El sistema usa OCR via OpenAI Vision para PDFs escaneados. Verificar que `OPENAI_API_KEY` esté configurada.

## Contribuir

1. Crear branch desde `dev`
2. Hacer cambios
3. Commit con mensaje descriptivo
4. Push y crear PR hacia `dev`
5. Merge a `main` para deploy

## Licencia

Privado - SIDEPP / MISTEC
