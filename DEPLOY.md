# Guía de Despliegue en Servidor Linux con Docker

Esta guía explica cómo desplegar SIDEPP-Digital en un servidor Linux usando Docker, con la base de datos PostgreSQL en el servidor (no en Docker).

## Requisitos Previos

- Servidor Linux (Ubuntu/Debian recomendado)
- Docker instalado (versión 20.10+)
- Docker Compose instalado (versión 2.0+)
- PostgreSQL instalado y corriendo en el servidor
- Dominio configurado (opcional, para producción)

## Paso 1: Preparar el Servidor

### Instalar Docker y Docker Compose

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Agregar usuario al grupo docker (opcional, para no usar sudo)
sudo usermod -aG docker $USER
newgrp docker

# Instalar Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verificar instalación
docker --version
docker-compose --version
```

### Instalar PostgreSQL (si no está instalado)

```bash
# Instalar PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Iniciar servicio
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Crear base de datos y usuario
sudo -u postgres psql << EOF
CREATE DATABASE sidepp_db;
CREATE USER sidepp_user WITH ENCRYPTED PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE sidepp_db TO sidepp_user;
\q
EOF
```

## Paso 2: Preparar la Aplicación

### Clonar o subir el código

```bash
# Crear directorio para la aplicación
sudo mkdir -p /opt/sidepp-digital
sudo chown $USER:$USER /opt/sidepp-digital
cd /opt/sidepp-digital

# Si usas Git
git clone <tu-repositorio> .

# O subir los archivos manualmente
```

### Configurar variables de entorno

```bash
# Copiar el archivo de ejemplo
cp .env.production.example .env.production

# Editar con tus valores
nano .env.production
```

**Configuración mínima requerida:**

```env
# URL de tu aplicación
ORIGIN=https://tudominio.com

# Base de datos (ajustar según tu configuración)
DATABASE_URL=postgresql://sidepp_user:tu_password_seguro@localhost:5432/sidepp_db

# JWT Secret (generar uno seguro)
JWT_SECRET=$(openssl rand -base64 32)

# CORS
CORS_ORIGIN=https://tudominio.com
```

## Paso 3: Construir y Desplegar

### Construir la imagen Docker

```bash
# Construir la imagen de producción
docker build -t sidepp-digital:latest --target prod .
```

### Ejecutar con Docker Compose

```bash
# Usar el archivo docker-compose.prod.yml
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d
```

### Verificar que está corriendo

```bash
# Ver logs
docker-compose -f docker-compose.prod.yml logs -f app

# Verificar estado
docker-compose -f docker-compose.prod.yml ps

# Verificar healthcheck
curl http://localhost:3000/api/health
```

## Paso 4: Ejecutar Migraciones de Base de Datos

```bash
# Entrar al contenedor
docker-compose -f docker-compose.prod.yml exec app sh

# Dentro del contenedor, ejecutar migraciones
npx prisma migrate deploy

# O si prefieres hacerlo desde el servidor (con Prisma instalado)
npx prisma migrate deploy
```

## Paso 5: Configurar Nginx (Recomendado)

### Instalar Nginx

```bash
sudo apt install nginx -y
```

### Configurar reverse proxy

```bash
sudo nano /etc/nginx/sites-available/sidepp-digital
```

**Contenido del archivo:**

```nginx
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    # Redirigir HTTP a HTTPS (si tienes SSL)
    # return 301 https://$server_name$request_uri;

    # O servir directamente (sin SSL)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts para archivos grandes
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Tamaño máximo de archivo (10MB)
    client_max_body_size 10M;
}
```

### Habilitar el sitio

```bash
sudo ln -s /etc/nginx/sites-available/sidepp-digital /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Paso 6: Configurar SSL con Let's Encrypt (Opcional pero Recomendado)

```bash
# Instalar Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtener certificado
sudo certbot --nginx -d tudominio.com -d www.tudominio.com

# Renovación automática (ya está configurado)
sudo certbot renew --dry-run
```

## Comandos Útiles

### Gestión del contenedor

```bash
# Iniciar
docker-compose -f docker-compose.prod.yml up -d

# Detener
docker-compose -f docker-compose.prod.yml down

# Reiniciar
docker-compose -f docker-compose.prod.yml restart

# Ver logs
docker-compose -f docker-compose.prod.yml logs -f app

# Reconstruir después de cambios
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Actualizar la aplicación

```bash
# 1. Detener el contenedor
docker-compose -f docker-compose.prod.yml down

# 2. Actualizar código (si usas Git)
git pull

# 3. Reconstruir imagen
docker build -t sidepp-digital:latest --target prod .

# 4. Ejecutar migraciones (si hay cambios en BD)
docker-compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy

# 5. Iniciar
docker-compose -f docker-compose.prod.yml up -d
```

### Backup de base de datos

```bash
# Crear backup
sudo -u postgres pg_dump sidepp_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
sudo -u postgres psql sidepp_db < backup_20240101_120000.sql
```

### Limpiar recursos Docker

```bash
# Limpiar imágenes no usadas
docker image prune -a

# Limpiar volúmenes no usados (¡cuidado!)
docker volume prune
```

## Troubleshooting

### La aplicación no inicia

```bash
# Ver logs detallados
docker-compose -f docker-compose.prod.yml logs app

# Verificar variables de entorno
docker-compose -f docker-compose.prod.yml config

# Verificar conexión a BD desde el contenedor
docker-compose -f docker-compose.prod.yml exec app sh
# Dentro: node -e "console.log(process.env.DATABASE_URL)"
```

### Error de conexión a base de datos

- Verificar que PostgreSQL está corriendo: `sudo systemctl status postgresql`
- Verificar que el usuario y contraseña son correctos
- Verificar que PostgreSQL acepta conexiones desde localhost: `sudo nano /etc/postgresql/*/main/pg_hba.conf`
- Verificar que el puerto es correcto: `sudo netstat -tlnp | grep 5432`

### Error de permisos en uploads

```bash
# Ajustar permisos del volumen
docker-compose -f docker-compose.prod.yml exec app chown -R node:node /app/uploads
```

### La aplicación es lenta

- Verificar recursos del servidor: `htop` o `free -h`
- Verificar logs de Nginx: `sudo tail -f /var/log/nginx/error.log`
- Considerar aumentar recursos del contenedor en docker-compose

## Seguridad

### Recomendaciones

1. **Cambiar JWT_SECRET**: Usar un valor aleatorio y seguro
2. **Firewall**: Configurar UFW para permitir solo puertos necesarios
   ```bash
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 80/tcp    # HTTP
   sudo ufw allow 443/tcp  # HTTPS
   sudo ufw enable
   ```
3. **Actualizar regularmente**: Mantener Docker, sistema y aplicación actualizados
4. **Backups**: Configurar backups automáticos de la base de datos
5. **Logs**: Monitorear logs regularmente

## Monitoreo

### Healthcheck

La aplicación incluye un endpoint de healthcheck en `/api/health`. Puedes configurar monitoreo externo para verificar que la aplicación está funcionando.

### Logs

```bash
# Logs de la aplicación
docker-compose -f docker-compose.prod.yml logs -f app

# Logs de Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Logs del sistema
sudo journalctl -u nginx -f
```

## Soporte

Para problemas o preguntas, consultar:
- Logs de la aplicación
- Logs de Docker
- Logs de Nginx
- Logs de PostgreSQL: `sudo tail -f /var/log/postgresql/postgresql-*.log`

