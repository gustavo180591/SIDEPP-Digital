Quiero que generes un mensaje de commit Conventional Commits a partir de mis cambios.
Objetivo: un commit claro, completo y profesional.

Instrucciones estrictas

El título debe seguir tipo(scope): resumen corto en imperativo (máx. 72 chars).
Tipos: feat, fix, refactor, docs, test, chore, perf, build, ci, style.

El cuerpo debe:

Explicar el “qué” y “por qué”.

Incluir lista de TODOS los archivos tocados; por cada archivo, 1 línea:
- ruta/archivo.ext: síntesis del cambio (≤12 palabras)

Si hay pruebas/DB/infra, mencionarlo explícitamente.

Si hay cambios incompatibles, añade sección BREAKING CHANGES: con detalle.

Si hay issues, añade Refs: #123, etc.

Si hay coautores, añade Co-authored-by: al final.

Contexto del repo

Branch actual: {branch}

Alcance sugerido (scope): {scope_general_del_módulo_o_app}

Entradas (pégalas exactas)

STATUS (staged):

{pegar_salida_de: git diff --cached --name-status}


STAT (staged):

{pegar_salida_de: git diff --cached --stat}


DIFF (staged):

{pegar_salida_de: git diff --cached}


Notas/objetivo del commit (opcional):

{tu_descripción_corta_del_objetivo}

Formato de salida requerido

Devuélveme solo el commit final, con este formato:

<tipo>(<scope>): <título en imperativo y conciso>

<explicación de alto nivel (2–5 líneas).>

Archivos modificados:
- <ruta/archivo1>: <síntesis del cambio>
- <ruta/archivo2>: <síntesis del cambio>
...

Impacto:
- Riesgos: <riesgos o n/a>
- Migraciones/DB: <sí/no, detalle o n/a>
- Tests: <agregados/actualizados/n/a>
- Performance: <mejora/regresión/n/a>

Refs: <enlaces o #issues si existen>
BREAKING CHANGES:
- <detalle o n/a>

Co-authored-by: <Nombre <email>>  (opcional)


Reglas extra:

Si el scope no es claro desde el STATUS/DIFF, usa {scope_general_del_módulo_o_app}.

Si solo hay cambios de docs, usa docs:.

Si es hotfix urgente, usa fix!: solo si rompe contratos; si no, fix:.

Mantén títulos ≤72 chars y sin punto final.

Atajos útiles

Solo archivos staged (para “STATUS”):

git diff --cached --name-status


Resumen por archivo (para “STAT”):

git diff --cached --stat


Diff completo (para “DIFF”):

git diff --cached


Branch actual:

git rev-parse --abbrev-ref HEAD

Ejemplo de salida (formato esperado)
feat(aportes): conciliación mensual automática y almacenamiento de PDFs

Implementa pipeline de conciliación por institución/mes y guarda metadatos de archivos
subidos. Agrega endpoints para listar períodos y transferencias, y normaliza montos
a Decimal(18,2). Mejora la trazabilidad enlazando PdfFile con períodos/transferencias.

Archivos modificados:
- src/routes/api/reconcile/+server.ts: agrega endpoint POST y validación
- src/lib/server/pdf/normalize.ts: normaliza períodos y montos
- prisma/schema.prisma: añade índices y enum ContributionStatus
- src/routes/upload/+server.ts: guarda PdfFile y dispara clasificación
- src/lib/ui/PeriodsTable.svelte: muestra estado MATCHED/PENDING
- tests/reconcile.spec.ts: casos de bordes y tolerancias

Impacto:
- Riesgos: bajo; revisar tolerancia de conciliación en .env
- Migraciones/DB: sí; nuevas columnas e índices
- Tests: agregados y actualizados
- Performance: mejora en carga masiva

Refs: #123 #127
BREAKING CHANGES:
- n/a