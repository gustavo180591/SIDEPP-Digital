-- Migración de roles de usuario para SIDEPP-Digital
-- Ejecutar ANTES de aplicar el nuevo schema de Prisma
-- Fecha: 2025-12-07

-- 1. Actualizar roles existentes al nuevo esquema
UPDATE users SET role = 'ADMIN' WHERE role = 'OPERATOR';
UPDATE users SET role = 'ADMIN' WHERE role = 'INTITUTION';

-- 2. Eliminar la columna institutionId si existe (el nuevo schema usa UserInstitution)
ALTER TABLE users DROP COLUMN IF EXISTS "institutionId";

-- 3. Verificar el resultado
SELECT id, email, name, role FROM users;
