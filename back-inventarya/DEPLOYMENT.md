# INVENTARYA: preparación y despliegue de producción

Este documento separa explícitamente el desarrollo local de la arquitectura de producción preparada en la Fase 1. No contiene secretos y no sustituye un procedimiento probado de backup y restauración.

## Desarrollo local (sin cambios)

El flujo existente continúa usando `backend-inv/docker-compose.yml` y los archivos `.env` locales actuales:

```bash
# Infraestructura local
cd backend-inv
docker compose up -d

# Procesos Laravel locales
php artisan serve --host=0.0.0.0 --port=8000
php artisan queue:work redis --tries=3 --backoff=5
php artisan schedule:work
php artisan reverb:start --host=0.0.0.0 --port=8080

# Frontend local
cd ../frontend-inv
npm run dev
```

PostgreSQL permanece publicado localmente en `5432`, Redis en `6379`, Laravel en `8000`, Reverb en `8080` y Vite conserva su configuración actual. La Fase 1 no modifica ni elimina esos recursos.

## Arquitectura de producción

```text
Internet / TLS
       |
Nginx del VPS
  |          |
  |          +-- /app y /apps --> 127.0.0.1:8080 (Reverb)
  +-- API ---------------------> 127.0.0.1:9000 (PHP-FPM)
  +-- SPA ---------------------> frontend-inv/dist

Red Docker edge: app, queue, scheduler y reverb (salida controlada)
Red Docker private: los procesos Laravel, PostgreSQL 14 y Redis 7
```

`docker-compose.prod.yml` crea procesos separados para PHP-FPM, worker, scheduler y Reverb. PostgreSQL y Redis sólo usan la red privada y no publican `5432` ni `6379` al host. PHP-FPM y Reverb se enlazan exclusivamente a `127.0.0.1` para que Nginx sea la entrada pública.

El proyecto Compose tiene el nombre explícito `inventarya`; Docker genera contenedores, redes y volúmenes con ese prefijo, evitando colisiones con otros proyectos del VPS. No se usa `container_name`, para conservar el aislamiento y la administración nativa de Compose.

Todos los servicios persistentes usan `restart: unless-stopped` y healthchecks. Ningún build o arranque ejecuta migraciones, seeders ni backups.

## DNS, dominios y certificados

Preparar como mínimo:

- registros para `inventarya.com`, `www.inventarya.com` y `api.inventarya.com`;
- un registro wildcard `*.inventarya.com` para tenants;
- certificados TLS que incluyan los hosts centrales y el wildcard (normalmente mediante DNS-01);
- redirección HTTP a HTTPS.

Los dominios centrales, raíces tenant, CORS y orígenes de Reverb provienen de variables de entorno. Las plantillas de producción sólo incluyen hosts de Inventarya; los dominios personalizados requieren configuración y validación explícitas.

## Variables y secretos

1. Copiar `backend-inv/.env.production.example` a `backend-inv/.env.production` únicamente en el servidor o gestor de secretos.
2. Sustituir cada `CHANGE_ME` y generar valores únicos y largos.
3. Generar `APP_KEY` en un entorno confiable con `php artisan key:generate --show`; copiar el resultado sin imprimirlo en logs compartidos.
4. Restringir el archivo a la cuenta de despliegue, por ejemplo con permisos `600`.
5. Copiar `frontend-inv/.env.production.example` a `frontend-inv/.env.production` y completar sólo datos públicos.

Todo valor `VITE_*` se incorpora al JavaScript descargado por el navegador. Nunca se deben poner allí contraseñas, tokens privados, credenciales SMTP, `APP_KEY`, `REVERB_APP_SECRET` ni claves privadas.

`SUPERADMIN_NAME`, `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` sólo se usan en una creación explícita y controlada. `DatabaseSeeder` no crea el superadministrador automáticamente. El seeder rechaza valores ausentes, marcadores `CHANGE_ME`, email inválido o contraseña débil.

## Build del frontend

```bash
cd frontend-inv
npm ci
npm run build
```

Publicar el contenido de `frontend-inv/dist` como SPA estática. El build debe realizarse con el `.env.production` del frontend correcto para el dominio objetivo. Conservar el artefacto anterior para rollback.

## Imagen y servicios del backend

Validar sin iniciar servicios:

```bash
cd backend-inv
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
```

Construir una imagen inmutable con una etiqueta de release:

```bash
APP_IMAGE_TAG=2026-09-17.1 docker compose \
  --env-file .env.production \
  -f docker-compose.prod.yml build app
```

`Dockerfile.prod` usa PHP 8.3 FPM, instala dependencias Composer con `--no-dev --prefer-dist --optimize-autoloader`, no copia archivos `.env` y sólo concede escritura a `storage` y `bootstrap/cache`. No utiliza permisos `777`.

Para iniciar o actualizar, una vez completados los controles operativos y las migraciones explícitas:

```bash
APP_IMAGE_TAG=2026-09-17.1 docker compose \
  --env-file .env.production \
  -f docker-compose.prod.yml up -d
```

La Fase 1 solamente prepara estos comandos; no se deben ejecutar hasta contar con backup/restauración probado, monitoreo y ventana de despliegue.

## Nginx externo

La configuración exacta depende de la distribución y del manejo de certificados. Esta base ilustra las rutas esenciales de API y Reverb; debe probarse con `nginx -t` antes de recargar:

```nginx
server {
    listen 443 ssl http2;
    server_name api.inventarya.com;

    # ssl_certificate y ssl_certificate_key administrados fuera del repositorio.

    location ~ ^/(app|apps) {
        proxy_http_version 1.1;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_read_timeout 60s;
        proxy_pass http://127.0.0.1:8080;
    }

    location / {
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME /var/www/html/public/index.php;
        fastcgi_param DOCUMENT_ROOT /var/www/html/public;
        fastcgi_param HTTPS $https if_not_empty;
        fastcgi_param HTTP_PROXY "";
        fastcgi_pass 127.0.0.1:9000;
    }
}

server {
    listen 443 ssl http2;
    server_name inventarya.com www.inventarya.com *.inventarya.com;
    root /srv/inventarya/frontend/current;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Nginx debe aplicar límites de carga y timeouts acordes a la aplicación, cabeceras de seguridad, compresión, cache de assets versionados y rate limiting en endpoints sensibles. El proxy debe conservar `Host` porque la resolución tenant depende del hostname.

## Migraciones y creación inicial del superadministrador

Las migraciones son una operación de deployment explícita. Antes de ejecutarlas: comprobar la etiqueta de imagen, revisar SQL y compatibilidad hacia atrás, detener escrituras cuando corresponda y disponer de un backup restaurable de la base central y de cada tenant.

```bash
# Central; sólo durante una ventana autorizada
docker compose --env-file .env.production -f docker-compose.prod.yml \
  exec app php artisan migrate --force

# Tenants; probar primero sobre una copia representativa
docker compose --env-file .env.production -f docker-compose.prod.yml \
  exec app php artisan tenants:migrate --force
```

No usar `migrate:fresh` en producción. No ejecutar seeders generales automáticamente. Si se necesita el primer superadministrador, cargar sus tres variables desde el gestor de secretos y ejecutar una sola vez:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml \
  exec app php artisan db:seed --class=SuperadminSeeder --force
```

Eliminar o rotar esas variables después de verificar el acceso. El comando es idempotente por email y no reemplaza la contraseña de una cuenta ya existente.

Tras un release, regenerar cachés dentro de cada contenedor Laravel que las consuma y reiniciar procesos de larga duración de forma controlada. Como mínimo, el worker y Reverb deben cargar el código/configuración de la nueva release.

## Rollback

1. No sobrescribir imágenes: conservar la etiqueta anterior del backend y el artefacto `dist` anterior.
2. Si no hubo cambios de esquema incompatibles, volver a la etiqueta anterior y recrear los servicios.
3. Si hubo una migración destructiva o incompatible, no ejecutar `migrate:rollback` a ciegas. Restaurar la base central y todas las bases tenant desde backups del mismo punto temporal, o aplicar el runbook específico de esa migración.
4. Volver el enlace `frontend/current` al artefacto anterior y recargar Nginx.
5. Reiniciar workers y Reverb y ejecutar smoke tests de central, tenant, colas y WebSocket.

Cada release debe registrar la versión de aplicación, migraciones aplicadas, artefacto frontend y punto de restauración compatible.

## Backups y restauración

INVENTARYA contiene dos ámbitos distintos:

- una base PostgreSQL central;
- bases PostgreSQL independientes por tenant.

La configuración de backup ya no asume MySQL, pero en Fase 1 `BACKUP_DB_CONNECTIONS=central` cubre únicamente la conexión central. No se ha automatizado ni ejecutado ningún backup. Antes de habilitar un cron se debe implementar un inventario dinámico de tenants, backup consistente de cada base, cifrado, retención, copia fuera del VPS, verificación de integridad y restauraciones periódicas de prueba.

En producción, `BACKUP_DOWNLOAD_ENABLED=false` impide que el endpoint HTTP dispare o descargue respaldos, y `BACKUP_DISK=backups` usa `storage/app/private/backups`. No habilitar ese endpoint sin una autorización específica, protección contra abuso y una revisión del alcance de datos.

El volumen de Redis no sustituye un backup de PostgreSQL. También deben protegerse los archivos persistentes locales o migrarse a almacenamiento de objetos con versionado.

## Logs y operación

- Laravel escribe a `stderr`; consultar con `docker compose -f docker-compose.prod.yml logs app`.
- Revisar por separado `logs queue`, `logs scheduler`, `logs reverb`, `logs postgres` y `logs redis`.
- Configurar rotación del driver de logs Docker y alertas por reinicios o healthchecks fallidos.
- Revisar trabajos fallidos con `php artisan queue:failed`; no reintentarlos masivamente sin analizar idempotencia.
- Mantener access/error logs de Nginx sin registrar cabeceras de autorización, cookies ni cuerpos sensibles.
- Monitorear espacio, memoria, conexiones PostgreSQL/Redis, profundidad de cola, expiración TLS y disponibilidad de WebSocket.

## Riesgos y deuda técnica pendiente

- El hardening de resolución tenant, domains y CORS de la Fase 3 está documentado en `MULTITENANCY_HARDENING_PHASE3.md`. Sus pendientes de verificación DNS custom, Reverb end-to-end y comprobación del índice parcial definido en el esquema base siguen siendo gates de preproducción.
- La auditoría detallada de la Fase 2 se encuentra en `PRODUCTION_AUDIT_PHASE2.md` y sus gates son obligatorios antes de datos reales.
- En producción, `InitializeTenancyFlexible.php` usa Host y `domains` exacto; el puente de API central valida Origin exacto y no acepta `X-Tenant` como autoridad independiente. Local/testing conserva el resolver legacy.
- Las plantillas de producción sólo incluyen dominios de Inventarya; cualquier dominio adicional requiere configuración explícita.
- Falta implementar y probar backup/restauración integral de central más todos los tenants.
- El volumen local de `storage` limita el escalado horizontal; evaluar almacenamiento de objetos.
- El ejemplo Docker expone FPM y Reverb sólo en loopback, pero firewall, TLS, hardening del host y gestión real de secretos siguen siendo responsabilidades operativas.
- La migración de esquemas tenant necesita ensayo con una copia representativa y un runbook de fallos parciales.
- La estrategia de despliegue debe añadir smoke tests, métricas, alertas y escaneo de imágenes antes del primer lanzamiento.
