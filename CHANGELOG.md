# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

## [Sin versión] - 2025-11-04

### Agregado

- **Visualización de Institución en Navbar**: El navbar ahora muestra el nombre de la institución asignada al usuario que inició sesión, junto con su nombre y rol.
  - Modificado `validateUser()` en `src/lib/server/auth/utils.ts` para obtener el nombre de la institución mediante relación Prisma
  - Actualizado `src/app.d.ts` para incluir `institutionName` en las definiciones de tipo
  - Modificado `src/hooks.server.ts` para pasar `institutionName` al contexto del usuario
  - Actualizado navbar desktop (`src/lib/components/shared/DashboardNavbar.svelte`) para mostrar el nombre de la institución en color azul
  - Actualizado menú móvil (`src/lib/components/shared/MobileMenu.svelte`) para mostrar el nombre de la institución
  - Los usuarios sin institución asignada (ej. ADMIN) no ven este campo adicional

- **Control de Acceso Basado en Roles**: Implementado sistema de navegación y permisos diferenciado por rol de usuario
  - Usuarios **ADMIN**: Acceso completo a Usuarios, Instituciones y Afiliados
  - Usuarios **INTITUTION**: Acceso restringido a Afiliados y Subir Aportes únicamente de su institución asignada
  - Todos los roles tienen acceso a Dashboard y Cerrar Sesión

- **Seguridad Multi-Tenant**: Implementada validación a nivel de servidor para prevenir acceso no autorizado entre instituciones
  - Filtrado automático por `institutionId` en listados de afiliados para usuarios INTITUTION
  - Validación de autorización en páginas de detalle de instituciones, comprobantes y miembros
  - Protección en API de carga de PDFs para verificar que usuarios INTITUTION solo suban archivos de su institución
  - Sistema de dos capas: validación en hooks + validación a nivel de página
  - Archivos modificados:
    - `src/routes/dashboard/afiliados/+page.server.ts`
    - `src/routes/dashboard/instituciones/[id]/+page.server.ts`
    - `src/routes/dashboard/instituciones/[id]/[idMember]/+page.server.ts`
    - `src/routes/dashboard/instituciones/[id]/comprobantes/+page.server.ts`
    - `src/routes/dashboard/instituciones/[id]/comprobantes/[id]/+page.server.ts`
    - `src/routes/api/analyzer-pdf-aportes/+server.ts`
    - `src/hooks.server.ts`

### Corregido

- **Dropdown de Instituciones en CRUD de Usuarios**: Solucionado problema donde no aparecían las instituciones en el formulario de creación/edición de usuarios
  - Movida la carga de instituciones a server-side (`src/routes/dashboard/usuarios/+page.server.ts`)
  - Eliminado uso incorrecto de Prisma en componentes client-side (`src/lib/components/users/UserModal.svelte`)
  - Las instituciones ahora se pasan como props desde el servidor al componente modal

- **Acceso a Detalle de Miembros**: Corregida restricción que impedía a usuarios INTITUTION acceder al detalle de miembros de su propia institución
  - Modificado `src/hooks.server.ts` para separar rutas exclusivas de ADMIN de rutas de instituciones
  - Las rutas de instituciones ahora permiten acceso tanto a ADMIN como a INTITUTION
  - La validación de que usuarios INTITUTION solo vean su propia institución se mantiene a nivel de página

### Notas Técnicas

- El rol `INTITUTION` mantiene su nomenclatura con typo intencional según definición en base de datos
- Todas las validaciones de seguridad se implementan en dos capas para mayor robustez
- La implementación sigue el patrón de Svelte 5 con runes (`$props()`, `$state()`, `$derived()`)
