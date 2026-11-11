# Fase 4: primer despliegue controlado de preproducción

Este documento reemplaza para preproducción los ejemplos Nginx de la guía histórica `../DEPLOYMENT.md`.

Este procedimiento prepara una instalación **sin datos reales**. No se ha ejecutado en el VPS ni sobre las bases locales. La preproducción usa `APP_ENV=production` y `APP_DEBUG=false` para probar el comportamiento de despliegue con datos ficticios. Nunca usar los volúmenes ni los archivos `.env` del desarrollo local.

## 1. Arquitectura y aislamiento

```text
Internet 80/443
    |
Nginx del host Debian 12
    |-- SPA estática: /var/www/apps/inventarya/frontend-inv/dist
    |-- uploads públicos: /var/www/apps/inventarya/backend-inv/storage/app/public
    |-- FastCGI: 127.0.0.1:9000 -> inventarya-app (PHP-FPM)
    +-- /app y /apps: 127.0.0.1:8080 -> inventarya-reverb

Docker Compose, proyecto inventarya
    |-- inventarya-app, inventarya-queue, inventarya-scheduler, inventarya-reverb
    |-- inventarya-postgres (PostgreSQL 14, volumen inventarya_postgres_data)
    +-- inventarya-redis (Redis 7, volumen inventarya_redis_data)
```

Instalación prevista: `/var/www/apps/inventarya/backend-inv` y `/var/www/apps/inventarya/frontend-inv`. Otras aplicaciones pueden residir en `/var/www/apps/culking-core`, `/var/www/apps/deportea`, `/var/www/apps/delivery` y `/var/www/apps/decomidas`. Reservar sólo para INVENTARYA los puertos de loopback 9000 y 8080. Antes de instalar, comprobar con `ss -ltn` que no haya conflicto con Culking Core u otro servicio. El proyecto Compose, servicios, redes y volúmenes tienen nombres propios de INVENTARYA.

| Puerto | Uso | Exposición |
| --- | --- | --- |
| 80/443 | Nginx host | Internet |
| 127.0.0.1:9000 | PHP-FPM | Sólo host |
| 127.0.0.1:8080 | Reverb | Sólo host |
| 5432 | PostgreSQL | Red Docker privada |
| 6379 | Redis | Red Docker privada |
| 8000 | Servidor Laravel de desarrollo | Ausente en preproducción |

En UFW sólo deben quedar accesibles públicamente 80/443 y el acceso administrativo ya autorizado. Verificar reglas de Docker y UFW en el VPS; Compose de preproducción no publica PostgreSQL ni Redis. No usar `docker compose down -v`.

## 2. Archivos y secretos

El Compose de desarrollo `docker-compose.yml`, los `.env` locales y sus puertos se mantienen intactos. Usar `docker-compose.prod.yml` y `Dockerfile.prod` sólo en el VPS. Copiar `.env.production.example` a `.env.production` en el VPS, con permisos restrictivos, y completar todos los valores `CHANGE_ME`. El archivo real no entra en Git. La base central nueva será `inventarya_central` por defecto de la plantilla, configurable mediante `DB_DATABASE`; los tenants se crearán en el PostgreSQL exclusivo de este proyecto. Nunca conectar la preproducción a `central_db` local.

Verificar que `DB_HOST=inventarya-postgres`, `REDIS_HOST=inventarya-redis`, `APP_ENV=production`, `APP_DEBUG=false`, `QUEUE_CONNECTION=redis`, `CACHE_STORE=redis`, `SESSION_DRIVER=redis` y `BROADCAST_CONNECTION=reverb`. Usar credenciales únicas para PostgreSQL, Redis, Reverb, correo y superadmin. La clave pública de Reverb puede ir en el frontend; `REVERB_APP_SECRET` nunca. El Redis de preproducción exige contraseña y guarda AOF en su volumen. Esta autenticación no altera Redis local.

`docker compose config` sin `--quiet` puede imprimir secretos: evitarlo en terminales compartidas o logs. No guardar credenciales en capturas, documentación o commits. Los valores `VITE_*` son públicos y quedan integrados en `dist`.

## 3. Nginx, FastCGI, TLS y DNS

Plantilla: `deploy/nginx/inventarya.conf`. Se instala manualmente en `/etc/nginx/sites-available/`, después de generar un certificado que cubra `inventarya.com` y `*.inventarya.com`; este último cubre también `api.inventarya.com`. Probar `nginx -t` antes de habilitar o recargar. Nginx del host sirve `dist` y los archivos públicos del bind mount `backend-inv/storage`. El proceso PHP del contenedor necesita escritura en el bind mount `storage` (UID/GID 33 en el host); `bootstrap/cache` ya pertenece a `www-data` dentro de la imagen. No usar 777. La carpeta de uploads pública se sirve desde `storage/app/public`; el resto de `storage` no se publica.

FastCGI pasa `SCRIPT_FILENAME=/var/www/html/public/index.php`, que es la ruta **dentro del contenedor**. Nginx no necesita ese archivo en su filesystem para ejecutar PHP; sólo envía el nombre a PHP-FPM. Por eso la plantilla no usa `$document_root/index.php` para la API. El bind mount de `storage` resuelve por separado los archivos estáticos públicos. Mantener sincronizados el checkout del host y la imagen construida del mismo commit. Si una actualización del host y la imagen divergen, suspender la publicación.

La plantilla conserva `Host`, `Upgrade`, `Connection`, `X-Forwarded-For` y `X-Forwarded-Proto` para Reverb. La API reescribe los encabezados forwarded hacia FastCGI y fija `REMOTE_ADDR=127.0.0.1`; Laravel confía sólo en ese puente durante producción. No activar confianza universal en proxies. Verificar en el VPS que `request()->getHost()`, esquema HTTPS y dirección cliente se resuelvan correctamente; otros proxies futuros requieren una revisión explícita.

Preparar DNS A/AAAA para `inventarya.com`, `www.inventarya.com`, `api.inventarya.com` y wildcard `*.inventarya.com`. No crear registros por tenant. El wildcard sólo dirige tráfico; Laravel exige una fila activa y exacta en `domains`. Los dominios personalizados requieren DNS, certificado y bloque Nginx adicionales antes de activarlos; esta plantilla no los publica automáticamente.

## 4. Validación antes de iniciar servicios (en el VPS)

```bash
cd /var/www/apps/inventarya/backend-inv
docker compose --env-file .env.production -f docker-compose.prod.yml config --quiet
docker compose --env-file .env.production -f docker-compose.prod.yml config --services
docker compose --env-file .env.production -f docker-compose.prod.yml config --volumes
cd ../frontend-inv
npm ci
npm run build
```

Inspeccionar el build sin imprimirlo íntegro: buscar `localhost`, `127.0.0.1`, `CHANGE_ME` y nombres de variables privadas. Un `VITE_*` público de ejemplo también debe sustituirse antes de publicar. Cualquier URL local incluida en el bundle debe justificarse como código de desarrollo eliminado por el build o corregirse. Conservar una copia del `dist` anterior para rollback.

Construir la imagen PHP de un commit/tag concreto; no usar `php artisan serve` ni `npm run dev` en el VPS. `inventarya-app` usa PHP-FPM. Queue, scheduler y Reverb comparten la misma imagen, pero son servicios separados. Ejemplo de secuencia manual, tras completar secretos y certificados:

```bash
cd /var/www/apps/inventarya/backend-inv
sudo install -d -o 33 -g 33 -m 770 storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs
export APP_IMAGE_TAG=RELEASE_UNICO
docker compose --env-file .env.production -f docker-compose.prod.yml build inventarya-app
docker compose --env-file .env.production -f docker-compose.prod.yml up -d inventarya-postgres inventarya-redis
docker compose --env-file .env.production -f docker-compose.prod.yml ps
docker compose --env-file .env.production -f docker-compose.prod.yml up -d inventarya-app
```

Ejecutar después las migraciones y el seeder específico descritos abajo. Una vez comprobada la API, levantar `inventarya-queue`, `inventarya-scheduler` y `inventarya-reverb` con `docker compose ... up -d` y habilitar Nginx. No iniciar servicios con valores `CHANGE_ME`. Nunca poner migraciones o seeders en el comando de arranque automático.

## 5. Base de datos y usuarios de prueba

En la base **vacía de preproducción**, y sólo después de comprobar la conexión y preparar un respaldo inicial, ejecutar manualmente:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T inventarya-app php artisan migrate --force
```

La migración base `2019_09_15_000020_create_domains_table.php` crea conjuntamente la unicidad exacta de `domains.domain`, el índice parcial `domains_one_primary_per_tenant` y la unicidad normalizada sin distinguir mayúsculas. Comprobar en PostgreSQL, tras migrar:

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'domains'
  AND indexname IN (
    'domains_domain_unique',
    'domains_one_primary_per_tenant',
    'domains_domain_normalized_unique'
  )
ORDER BY indexname;
```

Deben aparecer los tres índices. Confirmar que `domains_domain_normalized_unique` aplica `lower(domain)` y que el índice primario usa `WHERE is_primary = true`. Si la migración base ya figura como ejecutada en una instalación existente, no volver a ejecutarla a ciegas: inspeccionar los índices y preparar una operación SQL controlada para cualquier índice faltante. Si una migración falla, detener el procedimiento y examinar duplicados; no usar `migrate:fresh` ni borrar tablas.

Crear el primer superadmin sólo mediante el seeder específico, con `SUPERADMIN_NAME`, `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD` reales en el entorno secreto:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T inventarya-app php artisan db:seed --class=SuperadminSeeder --force
```

No ejecutar `DatabaseSeeder` general. El alta de tenants exige un plan: crear uno ficticio gratuito (precio cero) desde la interfaz de superadmin antes de la prueba. Así el tenant y su subdominio canónico quedan activos sin simular pagos. Crear desde la aplicación dos tenants ficticios, por ejemplo tenant A y B, registrar sus dominios `tenant-a.inventarya.com` y `tenant-b.inventarya.com` en `domains`, verificar el estado activo, y comprobar que cada tenant obtuvo una base separada. No hardcodear estos tenants ni incluirlos en migraciones. Tras crearlos, revisar migraciones pendientes y ejecutar sólo sobre estas bases de prueba:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec -T inventarya-app php artisan tenants:migrate --force
```

No ejecutar ninguno de estos comandos contra bases locales o datos reales.

## 6. Queue, scheduler y Reverb

El worker usa Redis con `--sleep=3 --tries=3 --backoff=5 --timeout=60 --max-time=3600`; `REDIS_QUEUE_RETRY_AFTER=90` deja margen sobre el timeout. Compose reinicia el proceso y da 90 segundos para terminar al detenerlo. Revisar jobs fallidos y logs tras un trabajo de prueba; no iniciar el worker local durante esta fase. Los logs Laravel van a stderr y Docker los recoge; definir rotación del driver Docker en el VPS.

El scheduler usa una sola réplica de `schedule:work`. Las tareas diarias en `routes/console.php` tienen `withoutOverlapping()`, con Redis como caché compartida. La zona horaria configurada es `America/La_Paz`; confirmar la hora efectiva mediante `schedule:list` en el VPS. No levantar una segunda instancia del scheduler ni ejecutar tareas reales durante la preparación local.

Reverb escucha dentro del contenedor en 8080, expuesto sólo en `127.0.0.1:8080`. Laravel publica eventos internamente hacia `REVERB_HOST=inventarya-reverb`, `REVERB_PORT=8080` y `REVERB_SCHEME=http` por la red Docker. El navegador usa `VITE_REVERB_HOST=api.inventarya.com`, puerto 443 y WSS mediante Nginx. Probar la autorización de canales privados y que una notificación del tenant A no llegue al B. Revisar que `REVERB_APP_ID`, `REVERB_APP_KEY` y `REVERB_APP_SECRET` estén completos en el entorno secreto.

## 7. CORS, multitenancy y smoke tests posteriores

Probar desde `inventarya.com`, `tenant-a.inventarya.com` y `tenant-b.inventarya.com`: preflight `OPTIONS`, `GET`, `POST` con Bearer, y `/broadcasting/auth`. El `Access-Control-Allow-Origin` debe corresponder al Origin autorizado. Probar un Host desconocido, un Origin no registrado y un Origin del tenant A con selector del tenant B: deben rechazarse. Un dominio custom sólo se prueba cuando tenga fila activa, DNS, TLS y Nginx específicos. CORS es una restricción del navegador: la autorización del token y la resolución exacta del tenant también deben validarse en el servidor.

Checklist manual:

- [ ] `https://inventarya.com` y `https://www.inventarya.com` abren la SPA.
- [ ] `https://api.inventarya.com/up` responde y Laravel detecta HTTPS/Host correctos.
- [ ] Login superadmin funciona con el usuario creado explícitamente.
- [ ] Plan ficticio y tenants A/B se crean sin tocar datos locales.
- [ ] `domains` contiene dominios correctos, activos y sin duplicados; los índices existen.
- [ ] Cada tenant abre su frontend, login y API con su propia base.
- [ ] Tenant A no accede a datos ni canal Reverb de B.
- [ ] Host/Origin incorrectos y conflicto A/B son rechazados.
- [ ] Queue procesa un job controlado; se revisan fallos y logs.
- [ ] Scheduler ejecuta una tarea controlada una sola vez.
- [ ] Reverb conecta por WSS y una notificación A no llega a B.
- [ ] Reiniciar contenedores sin borrar volúmenes conserva PostgreSQL y Redis/AOF.
- [ ] Se prueba una restauración de datos ficticios antes de clientes reales.

## 8. Rollback y riesgos pendientes

Si falla código o frontend, retirar tráfico o activar mantenimiento, detener worker y scheduler de esta aplicación, volver a la etiqueta anterior de imagen y al `dist` anterior, y comprobar healthchecks y login. No ejecutar `migrate:rollback` automáticamente: una versión anterior puede no comprender el nuevo esquema. Si hay cambio incompatible de datos, restaurar desde un backup probado a un entorno aislado y aprobar un plan de recuperación antes de tocar preproducción. Nunca usar `down -v`, `migrate:fresh` ni borrar la base como atajo.

La solución de backup **para producción real** sigue pendiente: dump central y de cada base tenant, copia de `storage`, retención, cifrado, copia externa y prueba de restauración. El respaldo actual del paquete no cubre automáticamente todas las bases tenant. También quedan por validar en el VPS DNS, certificados, reglas UFW/Docker, permisos UID 33, Nginx, `npm ci` limpio, integración SMTP/FCM/R2 si se habilita, rotación de logs y comportamiento de dominios personalizados. La autorización CORS/Reverb debe verificarse con tráfico real de prueba; la configuración estática no sustituye esas pruebas.

## 9. Validación local de esta preparación

- `docker compose config --quiet` pasó usando la plantilla como archivo temporal de entorno. Los únicos puertos publicados son `127.0.0.1:9000` y `127.0.0.1:8080`; PostgreSQL y Redis no tienen puerto publicado.
- La imagen `inventarya-backend:phase4-validation-20260918` se construyó sin iniciar servicios. Un contenedor efímero confirmó `pdo_pgsql`, `redis`, `pcntl`, `sockets`, `gd`, `zip` e `intl`.
- `php -l` pasó para `bootstrap/app.php` y la nueva migración. Las pruebas unitarias de resolución y CORS tenant pasaron: 16 pruebas, 30 aserciones; usan repositorios simulados y caché en memoria.
- Se copió el frontend a un directorio temporal. Allí `npm ci --offline` y `npm run build` pasaron. El `dist` local existente no se tocó. El build advierte que el paquete principal supera 500 kB; conviene dividirlo después, pero no impide esta preproducción.
- El escaneo del bundle temporal no encontró `CHANGE_ME`, `REVERB_APP_SECRET`, `DB_PASSWORD` ni `SUPERADMIN_PASSWORD`. Quedan cuatro apariciones de `localhost` y una de `127.0.0.1` dentro de dependencias de terceros para comprobaciones del navegador; las rutas locales propias fueron excluidas del build. Ninguna de estas cadenas configura el destino de API o Reverb.
- La plantilla Nginx pasó `nginx -t` en un contenedor efímero con certificado ficticio. Aún falta `nginx -t` en Debian con el certificado real. No se ejecutaron DNS, TLS, migraciones, seeders, queue, scheduler ni pruebas HTTP/WebSocket del VPS; esas comprobaciones pertenecen al despliegue manual.
