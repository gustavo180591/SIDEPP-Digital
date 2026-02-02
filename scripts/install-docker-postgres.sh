#!/bin/bash

# ==========================================
# Script de Instalación Docker y PostgreSQL
# Para Ubuntu 22.04 LTS
# ==========================================

set -e  # Salir si hay algún error

# Colores para mensajes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[ÉXITO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[ADVERTENCIA]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que el script se ejecute como root o con sudo
if [ "$EUID" -ne 0 ]; then 
    print_error "Por favor, ejecuta este script con sudo: sudo bash $0"
    exit 1
fi

print_info "Iniciando instalación de Docker y PostgreSQL..."
echo ""

# ==========================================
# 1. ACTUALIZAR SISTEMA
# ==========================================
print_info "Actualizando repositorios del sistema..."
apt-get update -qq
print_success "Repositorios actualizados"
echo ""

# ==========================================
# 2. INSTALAR DEPENDENCIAS
# ==========================================
print_info "Instalando dependencias necesarias..."
apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    apt-transport-https \
    software-properties-common \
    > /dev/null 2>&1
print_success "Dependencias instaladas"
echo ""

# ==========================================
# 3. INSTALAR DOCKER
# ==========================================
print_info "Verificando si Docker ya está instalado..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_warning "Docker ya está instalado: $DOCKER_VERSION"
    read -p "¿Deseas reinstalar Docker? (s/N): " reinstall_docker
    if [[ ! $reinstall_docker =~ ^[Ss]$ ]]; then
        print_info "Omitiendo instalación de Docker"
    else
        print_info "Desinstalando Docker existente..."
        apt-get remove -y docker docker-engine docker.io containerd runc > /dev/null 2>&1 || true
        apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /dev/null 2>&1 || true
        print_info "Instalando Docker..."
    fi
else
    print_info "Instalando Docker..."
fi

if [[ $reinstall_docker =~ ^[Ss]$ ]] || [[ ! -f /usr/bin/docker ]]; then
    # Agregar clave GPG de Docker
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Agregar repositorio de Docker
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Actualizar repositorios
    apt-get update -qq

    # Instalar Docker Engine, Docker CLI, Containerd, Docker Buildx y Docker Compose
    apt-get install -y \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin \
        > /dev/null 2>&1

    print_success "Docker instalado correctamente"
fi

# Verificar instalación de Docker
DOCKER_VERSION=$(docker --version)
print_success "Docker instalado: $DOCKER_VERSION"
echo ""

# ==========================================
# 4. CONFIGURAR DOCKER (sin sudo)
# ==========================================
print_info "Configurando Docker para ejecutarse sin sudo..."
# Crear grupo docker si no existe
if ! getent group docker > /dev/null 2>&1; then
    groupadd docker
fi

# Agregar usuario actual al grupo docker (si no es root)
if [ -n "$SUDO_USER" ]; then
    usermod -aG docker "$SUDO_USER"
    print_success "Usuario $SUDO_USER agregado al grupo docker"
    print_warning "Necesitarás cerrar sesión y volver a iniciar sesión para usar Docker sin sudo"
else
    print_info "Ejecutando como root, no se puede agregar usuario al grupo docker"
fi
echo ""

# ==========================================
# 5. INICIAR Y HABILITAR DOCKER
# ==========================================
print_info "Iniciando servicio Docker..."
systemctl start docker
systemctl enable docker
print_success "Docker iniciado y habilitado para iniciar al arrancar"
echo ""

# ==========================================
# 6. VERIFICAR DOCKER COMPOSE
# ==========================================
print_info "Verificando Docker Compose..."
if docker compose version &> /dev/null; then
    COMPOSE_VERSION=$(docker compose version)
    print_success "Docker Compose instalado: $COMPOSE_VERSION"
else
    print_error "Docker Compose no está disponible"
    exit 1
fi
echo ""

# ==========================================
# 7. INSTALACIÓN DE POSTGRESQL
# ==========================================
echo ""
print_info "=== INSTALACIÓN DE POSTGRESQL ==="
echo ""
echo "¿Cómo deseas instalar PostgreSQL?"
echo "  1) Como contenedor Docker (recomendado)"
echo "  2) Como servicio nativo del sistema"
read -p "Selecciona una opción (1 o 2) [1]: " postgres_option
postgres_option=${postgres_option:-1}

if [ "$postgres_option" = "1" ]; then
    # PostgreSQL como contenedor Docker
    print_info "Configurando PostgreSQL como contenedor Docker..."
    
    # Verificar si ya existe un contenedor de PostgreSQL
    if docker ps -a --format '{{.Names}}' | grep -q "^postgres$"; then
        print_warning "Ya existe un contenedor de PostgreSQL"
        read -p "¿Deseas eliminarlo y crear uno nuevo? (s/N): " recreate_postgres
        if [[ $recreate_postgres =~ ^[Ss]$ ]]; then
            docker stop postgres > /dev/null 2>&1 || true
            docker rm postgres > /dev/null 2>&1 || true
        else
            print_info "Usando contenedor existente"
            docker start postgres > /dev/null 2>&1 || true
            print_success "PostgreSQL (contenedor) configurado"
            exit 0
        fi
    fi
    
    # Solicitar configuración
    read -p "Nombre de la base de datos [postgres]: " POSTGRES_DB
    POSTGRES_DB=${POSTGRES_DB:-postgres}
    
    read -p "Usuario de PostgreSQL [postgres]: " POSTGRES_USER
    POSTGRES_USER=${POSTGRES_USER:-postgres}
    
    read -sp "Contraseña de PostgreSQL: " POSTGRES_PASSWORD
    echo ""
    if [ -z "$POSTGRES_PASSWORD" ]; then
        print_error "La contraseña no puede estar vacía"
        exit 1
    fi
    
    read -p "Puerto de PostgreSQL [5432]: " POSTGRES_PORT
    POSTGRES_PORT=${POSTGRES_PORT:-5432}
    
    # Crear contenedor de PostgreSQL
    print_info "Creando contenedor de PostgreSQL..."
    docker run -d \
        --name postgres \
        --restart unless-stopped \
        -e POSTGRES_DB="$POSTGRES_DB" \
        -e POSTGRES_USER="$POSTGRES_USER" \
        -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
        -p "$POSTGRES_PORT:5432" \
        -v postgres_data:/var/lib/postgresql/data \
        postgres:16
    
    # Esperar a que PostgreSQL esté listo
    print_info "Esperando a que PostgreSQL esté listo..."
    sleep 5
    max_attempts=30
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if docker exec postgres pg_isready -U "$POSTGRES_USER" > /dev/null 2>&1; then
            print_success "PostgreSQL está listo"
            break
        fi
        attempt=$((attempt + 1))
        sleep 1
    done
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "PostgreSQL no respondió a tiempo"
        exit 1
    fi
    
    print_success "PostgreSQL instalado como contenedor Docker"
    echo ""
    print_info "Detalles de conexión:"
    echo "  Host: localhost"
    echo "  Puerto: $POSTGRES_PORT"
    echo "  Base de datos: $POSTGRES_DB"
    echo "  Usuario: $POSTGRES_USER"
    echo "  Contraseña: [la que ingresaste]"
    
elif [ "$postgres_option" = "2" ]; then
    # PostgreSQL como servicio nativo
    print_info "Instalando PostgreSQL como servicio nativo..."
    
    # Verificar si ya está instalado
    if command -v psql &> /dev/null; then
        PSQL_VERSION=$(psql --version)
        print_warning "PostgreSQL ya está instalado: $PSQL_VERSION"
        read -p "¿Deseas reinstalar PostgreSQL? (s/N): " reinstall_postgres
        if [[ ! $reinstall_postgres =~ ^[Ss]$ ]]; then
            print_info "Omitiendo instalación de PostgreSQL"
            exit 0
        fi
    fi
    
    # Instalar PostgreSQL
    apt-get install -y postgresql postgresql-contrib > /dev/null 2>&1
    
    # Iniciar y habilitar servicio
    systemctl start postgresql
    systemctl enable postgresql
    
    print_success "PostgreSQL instalado como servicio nativo"
    echo ""
    print_info "Para configurar PostgreSQL, ejecuta:"
    echo "  sudo -u postgres psql"
    echo ""
    print_info "Para cambiar la contraseña del usuario postgres:"
    echo "  sudo -u postgres psql -c \"ALTER USER postgres PASSWORD 'tu_contraseña';\""
    
else
    print_error "Opción inválida"
    exit 1
fi

echo ""
print_success "=========================================="
print_success "Instalación completada exitosamente"
print_success "=========================================="
echo ""
print_info "Resumen de la instalación:"
echo "  - Docker: $(docker --version)"
echo "  - Docker Compose: $(docker compose version)"
if [ "$postgres_option" = "1" ]; then
    echo "  - PostgreSQL: Contenedor Docker (puerto $POSTGRES_PORT)"
else
    echo "  - PostgreSQL: Servicio nativo"
fi
echo ""
print_warning "Si agregaste un usuario al grupo docker, cierra sesión y vuelve a iniciar sesión para usar Docker sin sudo"

