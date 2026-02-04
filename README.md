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

---

## Módulos y Vistas

### Autenticación

| Ruta | Descripción |
|------|-------------|
| `/login` | Inicio de sesión con email y contraseña |
| `/logout` | Cierre de sesión (limpia cookie JWT) |
| `/forgot-password` | Solicitar recuperación de contraseña por email |
| `/reset-password/[token]` | Restablecer contraseña con token enviado por email |
| `/unauthorized` | Página mostrada cuando el usuario no tiene permisos |

### Dashboard Principal

| Ruta | Descripción |
|------|-------------|
| `/dashboard` | Panel principal con resumen de actividad y accesos rápidos |

### Módulo: Usuarios (`/dashboard/usuarios`)

**Acceso**: Solo ADMIN

| Funcionalidad | Descripción |
|---------------|-------------|
| Listar usuarios | Tabla con todos los usuarios del sistema |
| Crear usuario | Formulario para agregar nuevo usuario (nombre, email, rol, contraseña) |
| Editar usuario | Modificar datos de usuario existente |
| Eliminar usuario | Eliminar usuario del sistema |
| Asignar rol | Cambiar rol: ADMIN, OPERATOR, VIEWER |

### Módulo: Instituciones (`/dashboard/instituciones`)

**Acceso**: ADMIN, OPERATOR

| Ruta | Funcionalidad |
|------|---------------|
| `/dashboard/instituciones` | **Listado de instituciones** - Tabla con todas las instituciones registradas, búsqueda y filtros |
| `/dashboard/instituciones/[id]` | **Detalle de institución** - Ver información completa: nombre, CUIT, dirección, responsable, miembros asociados |
| `/dashboard/instituciones/[id]/comprobantes` | **Comprobantes de la institución** - Lista de períodos con sus PDFs cargados (aportes y transferencias) |
| `/dashboard/instituciones/[id]/comprobantes/[id]` | **Detalle del comprobante** - Ver información extraída del PDF, datos de transferencia, personas incluidas |
| `/dashboard/instituciones/[id]/[idMember]` | **Detalle de miembro** - Información del afiliado: nombre, CUIL, historial de aportes |

**Acciones disponibles:**
- Crear institución (nombre, CUIT, dirección, ciudad, provincia, responsable)
- Editar institución
- Eliminar institución
- Ver miembros de la institución
- Acceder a comprobantes cargados

### Módulo: Afiliados (`/dashboard/afiliados`)

**Acceso**: ADMIN, OPERATOR

| Funcionalidad | Descripción |
|---------------|-------------|
| Listar afiliados | Tabla con todos los miembros/afiliados del sistema |
| Buscar | Búsqueda por nombre o CUIL |
| Filtrar por institución | Ver afiliados de una institución específica |
| Ver detalle | Acceder al historial de aportes del afiliado |

### Módulo: Subir Aportes (`/dashboard/upload`)

**Acceso**: ADMIN, OPERATOR

Esta es la vista principal para cargar documentos. Permite subir:

| Tipo de Documento | Descripción |
|-------------------|-------------|
| **Listado de Aportes FOPID** | PDF con listado de aportes al fondo FOPID |
| **Listado de Aportes Sueldos** | PDF con aportes descontados de sueldos |
| **Listado de Aportes Aguinaldo** | PDF con aportes del aguinaldo |
| **Comprobante de Transferencia** | PDF del comprobante bancario (Banco Macro) |

**Flujo de carga:**
1. Seleccionar institución
2. Seleccionar período (mes/año)
3. Subir PDF de listado de aportes
4. Subir PDF de comprobante de transferencia
5. El sistema analiza automáticamente con IA
6. Muestra preview de datos extraídos
7. Confirmar para guardar en base de datos

**Validaciones automáticas:**
- Detecta si se sube documento incorrecto (transferencia en campo de aportes o viceversa)
- Valida que el PDF sea legible
- Detecta institución por CUIT
- Detecta período del documento
- Verifica duplicados por hash SHA-256

### Módulo: Reportes (`/dashboard/reportes`)

**Acceso**: ADMIN, OPERATOR, VIEWER

| Funcionalidad | Descripción |
|---------------|-------------|
| Aportes por Período | Ver aportes filtrados por institución y período |
| Exportar a Excel | Descargar reporte en formato .xlsx |
| Exportar a CSV | Descargar reporte en formato .csv |

**Filtros disponibles:**
- Por institución
- Por rango de fechas (mes/año desde - hasta)
- Por tipo de aporte (FOPID, Sueldo, Aguinaldo)

### Módulo: Gestión de Archivos (`/dashboard/admin/archivos`)

**Acceso**: Solo ADMIN

| Funcionalidad | Descripción |
|---------------|-------------|
| Listar períodos | Ver todos los períodos con archivos cargados |
| Filtrar | Por institución, año, mes |
| Expandir período | Ver archivos asociados a cada período |
| Ver PDF | Abrir PDF en nueva pestaña del navegador |
| Descargar PDF | Descargar archivo al dispositivo |
| Eliminar archivo | Eliminar PDF individual (y sus registros asociados) |
| Eliminar período | Eliminar período completo con todos sus archivos |

**Información mostrada por archivo:**
- Nombre del archivo
- Fecha de carga
- Tipo (Sueldos, FOPID, Aguinaldo, Transferencia)
- Cantidad de personas
- Monto total
- Estado de transferencia asociada

---

## API Endpoints

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/login` | Iniciar sesión (form action) |
| POST | `/logout` | Cerrar sesión (form action) |
| POST | `/forgot-password` | Enviar email de recuperación |
| POST | `/reset-password/[token]` | Restablecer contraseña |

### Análisis de PDFs

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/analyzer-pdf-aportes` | Analizar PDF de listado de aportes |
| POST | `/api/analyzer-pdf-bank` | Analizar PDF de transferencia bancaria |
| POST | `/api/analyzer-pdf-preview` | Preview sin guardar en BD |
| POST | `/api/analyzer-pdf-confirm` | Confirmar y guardar análisis |

### Gestión de Archivos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/files` | Listar archivos recientes |
| POST | `/api/files` | Subir nuevo archivo |
| GET | `/api/files/[id]/download` | Descargar PDF |
| GET | `/api/files/[id]/download?view=true` | Ver PDF en navegador |
| DELETE | `/api/admin/files/[id]` | Eliminar archivo (Admin) |
| DELETE | `/api/admin/periods/[id]` | Eliminar período completo (Admin) |

### Reportes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/reports/aportes-por-periodo` | Obtener datos del reporte |
| GET | `/api/reports/aportes-por-periodo/export` | Exportar a CSV |
| GET | `/api/reports/aportes-por-periodo/export-excel` | Exportar a Excel |

### Otros

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/health` | Health check del servidor |

---

## Roles y Permisos

| Rol | Usuarios | Instituciones | Afiliados | Subir Aportes | Reportes | Archivos (Admin) |
|-----|----------|---------------|-----------|---------------|----------|------------------|
| ADMIN | ✅ CRUD | ✅ CRUD | ✅ Ver | ✅ | ✅ | ✅ |
| OPERATOR | ❌ | ✅ CRUD | ✅ Ver | ✅ | ✅ | ❌ |
| VIEWER | ❌ | ✅ Ver | ✅ Ver | ❌ | ✅ | ❌ |

---

## Estructura del Proyecto

```
src/
├── lib/
│   ├── components/       # Componentes reutilizables (Modal, etc.)
│   ├── server/           # Código solo servidor
│   │   ├── auth/         # Autenticación y middleware
│   │   │   ├── jwt.ts    # Funciones JWT (sign, verify)
│   │   │   └── middleware.ts  # requireAuth, requireAdmin
│   │   ├── config.ts     # Configuración centralizada
│   │   ├── db.ts         # Cliente Prisma
│   │   ├── logger.ts     # Logger de errores a archivo
│   │   ├── pdf/          # Parsers de PDF
│   │   │   ├── ocr.ts    # Rasterización para OCR
│   │   │   └── parse-listado.ts  # Parser de listados
│   │   └── storage.ts    # Manejo de archivos (guardar, eliminar)
│   └── utils/
│       ├── analyzer-pdf-ia/  # Análisis con IA
│       │   ├── index.ts      # Exports principales
│       │   ├── pdf-extractor.ts  # Extracción de texto
│       │   ├── vision-analyzer.ts  # Análisis con OpenAI Vision
│       │   └── schemas/      # Schemas Zod para validación
│       └── cuit-utils.ts     # Validación y formateo CUIT/CUIL
├── routes/
│   ├── api/              # Endpoints API
│   ├── dashboard/        # Vistas del dashboard
│   ├── login/            # Página de login
│   └── ...
└── app.html              # Template HTML base
```

---

## Base de Datos

### Modelos Principales

| Modelo | Descripción |
|--------|-------------|
| **User** | Usuarios del sistema (email, password hash, rol) |
| **Institution** | Instituciones/empresas (nombre, CUIT, dirección) |
| **Member** | Afiliados/miembros (nombre, CUIL, institución) |
| **PayrollPeriod** | Períodos de nómina (mes, año, institución) |
| **PdfFile** | Archivos PDF cargados (nombre, hash, ruta, tipo) |
| **BankTransfer** | Transferencias bancarias (importe, CBU, operación) |
| **ContributionLine** | Líneas de aportes individuales (persona, monto) |

### Diagrama de Relaciones

```
User (standalone)

Institution 1──N Member
Institution 1──N PayrollPeriod

PayrollPeriod 1──N PdfFile
PayrollPeriod 1──1 BankTransfer
PayrollPeriod 1──N ContributionLine

ContributionLine N──1 Member (opcional)
ContributionLine N──1 PdfFile
```

---

## Scripts Disponibles

```bash
# Desarrollo
npm run dev          # Servidor en http://localhost:5173
npm run build        # Build de producción
npm run preview      # Preview del build en localhost

# Base de datos
npx prisma migrate dev      # Crear/aplicar migraciones (desarrollo)
npx prisma migrate deploy   # Aplicar migraciones (producción)
npx prisma studio           # UI web para explorar datos
npx prisma generate         # Regenerar cliente Prisma
npx prisma db push          # Push schema sin migración

# Linting
npm run lint         # Ejecutar ESLint
npm run format       # Formatear con Prettier
npm run check        # Type check con svelte-check
```

---

## Deployment

### Docker

```bash
# Build de imagen
docker build -t sidepp-digital .

# Ejecutar con docker-compose
docker-compose up -d
```

### Variables de producción

```env
DATABASE_URL="postgresql://user:pass@db:5432/sidepp"
JWT_SECRET="produccion-secret-muy-seguro-32-chars"
OPENAI_API_KEY="sk-..."
NODE_ENV="production"
```

### Nginx (Producción)

```nginx
server {
    listen 443 ssl http2;
    server_name finanzas.example.com;

    ssl_certificate /etc/letsencrypt/live/.../fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/.../privkey.pem;

    # Timeouts para análisis de PDFs (OpenAI puede tardar)
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## CI/CD

GitHub Actions en `.github/workflows/`:

1. Push a `main` → dispara workflow
2. Build imagen Docker
3. Push a servidor producción via SSH
4. Restart contenedor
5. Health check

---

## Logs

Errores se guardan en:
```
/data/logs/errors-YYYY-MM-DD.log
```

Formato: `[YYYY-MM-DD HH:mm:ss] [CONTEXT] Mensaje de error`

---

## Troubleshooting

### Error "standardFontDataUrl"
```typescript
const standardFontDataUrl = `${process.cwd()}/node_modules/pdfjs-dist/standard_fonts/`;
```

### Timeout 504 en análisis PDF
Aumentar timeouts en nginx a 300s.

### PDFs escaneados no se analizan
Verificar `OPENAI_API_KEY`. El sistema usa Vision API para OCR.

### "El archivo ya fue cargado anteriormente"
El sistema detecta duplicados por hash SHA-256. Si necesitas recargar, primero elimina el archivo anterior.

---

## Contribuir

1. Crear branch desde `dev`: `git checkout -b feature/mi-feature`
2. Hacer cambios y commits descriptivos
3. Push: `git push origin feature/mi-feature`
4. Crear PR hacia `dev`
5. Review y merge
6. Merge `dev` → `main` para deploy

---

## Licencia

Privado - SIDEPP / MISTEC
