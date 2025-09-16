# 🗺️ SIDEPP Digital - Hoja de Ruta

## 📋 Fase 0 – Preparación (Día 0-2) - **COMPLETADO**
- [x] Crear repositorio `sidepp-digital`
- [x] Configurar Docker con PostgreSQL + SvelteKit
- [x] Estructura inicial del proyecto
- [x] Configurar `.env` con variables de entorno
- [x] Configurar Prisma ORM

## 🔐 Fase 1 – Autenticación y Base de Datos (Día 3-10) - **EN PROGRESO**
### Modelos de Datos
- [x] Definir `schema.prisma` con los modelos:
  - [x] `User` (admin/operator/viewer)
  - [x] `Institution`
  - [x] `Member`
  - [x] `PayrollPeriod`
  - [x] `ContributionLine`
  - [x] `BankTransfer`
  - [x] `PdfFile`
  - [x] Relaciones y enums definidos
- [x] Ejecutar migración inicial (`20250916030216_init`)

### Autenticación
- [ ] Implementar autenticación JWT
  - [ ] Endpoint POST `/api/auth/login`
  - [ ] Middleware de autenticación
  - [ ] Protección de rutas

### Base de Datos
- [x] Ejecutar migraciones iniciales
  - [x] Migración aplicada exitosamente
  - [x] Esquema sincronizado con la base de datos
- [ ] Crear datos de prueba en `prisma/seed.ts`
  - [ ] Usuario administrador
  - [ ] 1-2 instituciones de ejemplo
  - [ ] Datos de socios de prueba

### Frontend
- [ ] Página de login
- [ ] Layout base con navegación
- [ ] Manejo de sesión

## 👥 Fase 2 – Gestión de Socios e Instituciones (Día 11-20)
### Backend
- [ ] CRUD instituciones (`/api/institutions/*`)
- [ ] CRUD socios (`/api/members/*`)
- [ ] Búsqueda y filtrado avanzado

### Frontend
- [ ] Listado de instituciones
- [ ] Formulario de creación/edición
- [ ] Gestión de socios
- [ ] Búsqueda por DNI/nombre

## 📄 Fase 3 – Procesamiento de PDFs (Día 21-35)
### Backend
- [ ] Endpoint de subida de archivos
- [ ] Clasificador de documentos
- [ ] Parser para listados de haberes
- [ ] Parser para comprobantes de transferencia

### Frontend
- [ ] Componente de arrastrar/soltar
- [ ] Vista previa de archivos
- [ ] Estado de procesamiento

## 🔄 Fase 4 – Conciliación (Día 36-45)
### Lógica de Negocio
- [ ] Algoritmo de conciliación
- [ ] Estados de conciliación
- [ ] Notificaciones

### UI/UX
- [ ] Dashboard de conciliación
- [ ] Vista detallada
- [ ] Resolución de conflictos

## 📊 Fase 5 – Reportes (Día 46-53)
### Generación
- [ ] Plantilla de reporte PDF
- [ ] Exportación a CSV
- [ ] Filtros avanzados

### Frontend
- [ ] Panel de reportes
- [ ] Previsualización
- [ ] Descarga múltiple

## 🚀 Fase 6 – Despliegue (Día 54-60)
### Infraestructura
- [ ] Configuración de producción
- [ ] Scripts de despliegue
- [ ] Monitoreo

### Documentación
- [ ] Manual de usuario
- [ ] Guía técnica
- [ ] Procedimientos de respaldo

## 📊 Métricas de Éxito
- [ ] **Día 10**: Login funcional
- [ ] **Día 20**: CRUD de socios operativo
- [ ] **Día 35**: Subida de PDFs funcionando
- [ ] **Día 45**: Conciliación automática
- [ ] **Día 53**: Reportes generados
- [ ] **Día 60**: Sistema en producción

## 📅 Seguimiento
| Fase | Estado | Inicio | Fin |
|------|--------|--------|-----|
| 0. Preparación | ✅ Completado | D1 | D2 |
| 1. Autenticación | 🟡 En progreso | D3 | D10 |
| 2. Gestión | 🟡 Pendiente | D11 | D20 |
| 3. PDFs | 🔴 Pendiente | D21 | D35 |
| 4. Conciliación | 🔴 Pendiente | D36 | D45 |
| 5. Reportes | 🔴 Pendiente | D46 | D53 |
| 6. Despliegue | 🔴 Pendiente | D54 | D60 |

## 📌 Notas
- Los tiempos son estimados y pueden ajustarse según necesidades
- Priorizar funcionalidades críticas para el MVP
- Realizar pruebas continuas en cada fase
