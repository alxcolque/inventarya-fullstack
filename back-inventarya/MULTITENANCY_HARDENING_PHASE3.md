# INVENTARYA — hardening de multitenancy, domains y CORS (Fase 3)

Este documento registra la arquitectura implementada y sus límites. No autoriza un despliegue, no contiene secretos y no implica que se hayan ejecutado migraciones ni modificado datos.

## Autoridad de tenant

Fuera de `local` y `testing`, la resolución normal sigue este orden:

```text
Host normalizado
  -> coincidencia exacta en domains.domain
  -> estado de Domain
  -> estado de Tenant
  -> tenancy()->initialize(Tenant)
```

No existe fallback de producción `primer segmento == tenant.slug`. `X-Tenant`, `X-Tenant-Domain`, query parameters y `Referer` no seleccionan por sí solos un tenant.

La SPA usa una API centralizada en `api.inventarya.com`. Ésta requiere un puente explícito: el `Origin` del navegador debe coincidir exactamente con un registro de `domains` autorizado. Un header tenant, si está presente, sólo puede confirmar ese mismo tenant; si lo contradice se responde `409 TENANT_CONTEXT_CONFLICT`. Un request no-browser que sólo envía `X-Tenant` permanece en contexto central y no obtiene acceso tenant.

En `local/testing` se conservan los mecanismos heredados de header, query, subdominio y puerto para no romper el desarrollo existente.

## Normalización única

`DomainNormalizer` convierte esquema HTTP(S), mayúsculas, puerto, slash final y punto DNS final a un hostname lowercase. Rechaza paths, query strings, fragments, credenciales, wildcards y labels DNS inválidos. `Domain`, `DomainRequest`, `TenantStoreRequest`, el resolver y CORS reutilizan esa lógica.

IDN se convierte a ASCII sólo cuando PHP ofrece `idn_to_ascii`. El entorno auditado y la imagen actual no incluyen `ext-intl`; por seguridad, un IDN Unicode se rechaza. Punycode ASCII sigue siendo válido. Añadir `ext-intl` debe ser una decisión explícita y probada en otra fase.

## Alta de tenants y dominios

El backend deriva el dominio principal, aunque el frontend no envíe dominios:

- producción: `{slug}.${TENANT_ROOT_DOMAIN}`;
- local/testing: `{slug}.localhost`.

Tenant y dominio se crean dentro de la misma transacción central. El dominio administrado por INVENTARYA queda `subdomain`, `active`, `is_primary=true` y con `verified_at`. Los dominios enviados por el cliente son adicionales y nunca sustituyen el dominio canónico.

Un dominio externo siempre se clasifica como `custom`, inicia `pending`, `verified_at=null` y no puede ser primario. El cliente no puede enviar `status` ni `verified_at`, ni clasificar un host externo como `subdomain`. Confirmar un pago sólo activa dominios administrados; nunca activa custom.

`DomainOwnershipVerifier` define el futuro punto de integración. La implementación actual es deliberadamente `UnconfiguredDomainOwnershipVerifier`: nunca confirma propiedad. `DomainVerificationService` sólo activa un custom cuando un verificador real devuelve éxito. No hay endpoint de activación ni integración DNS en esta fase.

## Estados y respuestas

Estados tenant autorizados: `active`, `trial`.

| Condición | HTTP | Código |
|---|---:|---|
| dominio inexistente | 404 | `TENANT_DOMAIN_NOT_FOUND` |
| tenant inexistente | 404 | `TENANT_NOT_FOUND` |
| tenant pending | 403 | `TENANT_PENDING` |
| tenant suspended | 403 | `TENANT_SUSPENDED` |
| tenant unpaid | 403 | `TENANT_UNPAID` |
| tenant expired | 403 | `TENANT_EXPIRED` |
| domain pending/suspended/expired | 403 | `DOMAIN_PENDING` / `DOMAIN_SUSPENDED` / `DOMAIN_EXPIRED` |
| custom activo sin verificar | 403 | `DOMAIN_NOT_VERIFIED` |
| Host y header/Origin de tenants distintos | 409 | `TENANT_CONTEXT_CONFLICT` / `TENANT_ORIGIN_CONFLICT` |

## Integridad de domains

La auditoría agregada y de solo lectura del 17-09-2026 encontró:

- tenants con más de un primario: `0`;
- tenants sin primario: `0`;
- domains huérfanos: `0`;
- domains que requieren la normalización auditada: `0`;
- colisiones después de lowercase/punto final: `0`.

La misma consulta encontró `0` tenants en estados autorizados y `0` en estados bloqueados: la base local auditada está vacía de tenants. Por eso estos resultados prueban que no hay una violación local actual, pero no sustituyen el ensayo sobre una copia representativa de preproducción.

La definición base `2019_09_15_000020_create_domains_table.php` incluye desde la creación de la tabla el índice por `tenant_id`, el índice único parcial PostgreSQL y la unicidad normalizada mediante `lower(domain)`:

```sql
CREATE UNIQUE INDEX domains_one_primary_per_tenant
ON domains (tenant_id)
WHERE is_primary = true;
```

La aplicación también desmarca el primario anterior dentro de la transacción. El índice elimina la carrera concurrente en instalaciones nuevas. No se ejecutó ninguna migración durante esta fase.

Modificar la migración base no altera bases donde ya figure como ejecutada. Antes de promover una base preexistente se debe inspeccionar si los tres índices de integridad existen y aplicar el SQL mediante un procedimiento controlado si faltan; no se debe volver a ejecutar la migración base a ciegas.

No se añadió FK. `tenants.id` y `domains.tenant_id` son `varchar`, y la muestra actual no tiene huérfanos, pero debe probarse el ciclo Stancl de alta, rollback, borrado y reprovisionamiento antes de decidir `ON DELETE CASCADE`. Propuesta posterior: FK `domains.tenant_id -> tenants.id`, preferentemente cascade si las pruebas confirman el lifecycle.

## CORS dinámico y caché

En producción ya no se autoriza un wildcard tenant desde `config/cors.php`. `ValidateTenantOrigin` normaliza `Origin`, permite los orígenes centrales explícitos o consulta una coincidencia exacta en `domains`; después agrega únicamente ese Origin a la configuración usada por `HandleCors` para esa solicitud. HTTP se rechaza para orígenes tenant de producción.

`TenantDomainRegistry` cachea tanto aciertos como fallos durante `TENANT_DOMAIN_CACHE_TTL` (300 segundos por defecto). Los observers invalidan el hostname anterior/nuevo al guardar o borrar un Domain y todos los dominios al cambiar el estado o borrar un Tenant. Los flujos propios que antes actualizaban/borraban domains en masa ahora recorren modelos para disparar invalidación.

Escrituras directas por SQL externas a Eloquent no disparan observers. Además, la mutación request-local de configuración CORS está diseñada para PHP-FPM; antes de adoptar Octane/Swoole se debe reemplazar por una política sin estado compartido.

## Frontend y API centralizada

En producción el frontend envía el hostname completo mediante `X-Tenant-Domain`; para `inventario.empresa.com` no adivina que el slug sea `inventario`. Local conserva las claves anteriores como lectura de compatibilidad, además de query y puertos.

La autenticación actual utiliza Personal Access Tokens de Sanctum en `Authorization: Bearer`, persistidos por Zustand. Axios no configura `withCredentials`; por tanto, la sesión tenant no depende de compartir cookies entre `farmacia.inventarya.com` y `api.inventarya.com`, ni entre `empresa.com` y `inventarya.com`. `SESSION_DOMAIN=null` mantiene cookies host-only. Los valores `SANCTUM_STATEFUL_DOMAINS`, `supports_credentials=true` y CSRF son relevantes si en el futuro se migra a autenticación SPA por cookies, pero no son la estrategia actual.

Una cookie de `inventarya.com` nunca puede compartirse con un custom domain. Cualquier migración a cookies requerirá un diseño separado, `SameSite=None; Secure`, CSRF y pruebas específicas; no se improvisó aquí.

## Reverb

La autorización de canales privados pasa por `/api/broadcasting/auth`, con Bearer token y el mismo header tenant. El resolver fija primero el tenant; Sanctum busca el token dentro de esa base, y los callbacks verifican el usuario autenticado. Cambiar el header no permite saltar de Tenant A a Tenant B.

Los nombres de canal también incluyen el tenant: `tenants.{tenantId}.users.{userId}`. Esto evita que usuarios con el mismo id en bases tenant distintas compartan accidentalmente un canal global. El backend entrega `tenant_id` como parte del usuario autenticado, el frontend construye el mismo nombre y el callback comprueba tanto tenant como usuario.

El handshake WebSocket de Reverb todavía usa `REVERB_ALLOWED_ORIGINS` estático. El wildcard configurado permite abrir una conexión sin autorizar un canal privado, pero no consulta `domains`; además, un custom domain necesita agregarse explícitamente a esa variable. No se cambió broadcasting sin una prueba end-to-end. Antes de producción real se requiere probar handshake, auth privada y rechazo cruzado A/B, y decidir un proveedor dinámico de apps/orígenes o una lista operativa sincronizada.

## Compatibilidad y trabajo pendiente

- Los defaults de hosts centrales, CORS y Reverb incluyen únicamente Inventarya; otros dominios precisan configuración y autorización explícitas.
- Debe verificarse en preproducción que los índices definidos por la migración base existan realmente, especialmente si la base fue creada antes de este cambio.
- Falta un proveedor real de verificación DNS y el modelo persistente del challenge custom.
- Falta la prueba end-to-end de Reverb y una estrategia dinámica para custom origins.
- La futura FK requiere pruebas del lifecycle Stancl.
- Antes de cualquier despliegue se deben probar CORS/preflight detrás de Nginx conservando `Host` y `Origin`.

## Validación no destructiva

Ejecutada el 18-09-2026, sin migraciones, seeders ni cambios de datos:

- sintaxis PHP: `274` archivos, PASS;
- `composer validate --no-check-publish`: PASS, con warning no bloqueante por la restricción `phpoffice/phpspreadsheet: *`;
- `php artisan config:clear`: PASS;
- `php artisan config:cache`: PASS;
- `php artisan route:list`: PASS, `1064` rutas;
- `php artisan test --testsuite=Unit`: PASS, `45` tests y `95` aserciones;
- `npm run build`: PASS, con warning no bloqueante por el chunk principal de aproximadamente `3.47 MB` (`978.67 kB` gzip);
- `git diff --check` backend/frontend: PASS; sólo avisos de normalización CRLF/LF.

La suite Feature completa no se ejecutó porque `CentralBusinessTest` utiliza `RefreshDatabase` y `phpunit.xml` no fuerza actualmente una base aislada SQLite; correrla podría tocar la base central local.
