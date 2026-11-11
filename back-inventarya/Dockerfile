FROM php:8.3-fpm

# Dependencias del sistema
RUN apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    zip \
    libpq-dev \
    libzip-dev \
    libpng-dev \
    libjpeg62-turbo-dev \
    libfreetype6-dev \
    && rm -rf /var/lib/apt/lists/*

# Extensiones PHP
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install \
        pdo \
        pdo_pgsql \
        pdo_mysql \
        pgsql \
        zip \
        pcntl \
        sockets \
        gd

# Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Directorio trabajo
WORKDIR /var/www

# Copiar archivos
COPY . .

# Crear carpetas Laravel ANTES de composer
RUN mkdir -p bootstrap/cache \
    storage/framework/cache \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs

# Permisos
RUN chmod -R 777 storage bootstrap/cache

# Instalar dependencias
RUN composer install --no-interaction --prefer-dist --optimize-autoloader

# Exponer puertos
EXPOSE 8000
EXPOSE 8080

# Comando principal
CMD php artisan serve --host=0.0.0.0 --port=8000