# INVENTARYA — Auditoría de producción, Fase 2

> Actualización 18-09-2026: los hallazgos de resolución tenant, normalización de domains, CORS dinámico y aislamiento de canales privados fueron abordados en la Fase 3. Este documento conserva la fotografía histórica; el estado vigente y sus pendientes están en `MULTITENANCY_HARDENING_PHASE3.md`.

Fecha de revisión: 2026-09-17.

Este documento registra hallazgos de preparación. No autoriza un despliegue ni la carga de datos reales.

## Estado de multitenancy

La tabla central `domains` es estructuralmente apta para representar subdominios y dominios personalizados. Incluye `domain`, `tenant_id`, `type`, `status`, `is_primary` y `verified_at`, y `domain` es único.

Limitaciones pendientes:

- `tenant_id` no tiene una foreign key ni un índice explícito en la migración actual.
- No existe una restricción que garantice un único dominio primario por tenant.
- `DomainRequest` no valida ni acepta `type`, aunque el modelo y la tabla sí lo soportan.
- No existe un flujo completo de prueba de propiedad DNS, verificación y activación para dominios personalizados.
- La entrada de dominio no se normaliza de forma centralizada: mayúsculas, esquema, puerto, punto final e IDN requieren una política definida.
- `TenantService` depende de `domains` enviado por el cliente; no garantiza por sí mismo la creación de `{slug}.inventarya.com`.
- `TenantService` agrega un dominio `{slug}.localhost` sin condicionar explícitamente esa operación a `local`/`testing`.

No se crearon migraciones ni se modificó el onboarding en esta fase para evitar regresiones.

## Orden actual del resolver backend

`InitializeTenancyFlexible` intenta resolver en este orden:

1. `X-Tenant`, luego `X-Tenant-Domain`, luego el query parameter `tenant`.
2. Coincidencia exacta de `Host` con `domains.domain`.
3. Primer segmento del hostname buscado como `Tenant::id` o `Tenant::slug`.
4. `Origin` o `Referer`: dominio exacto, primer segmento como tenant y finalmente `local_port`.
5. Si no encontró tenant, permite continuar cuando `Host` está en `tenancy.central_domains`; en otro caso devuelve 404.

Riesgos pendientes:

- Cabeceras y query parameters controlables por el cliente tienen prioridad sobre `Host`.
- El fallback por slug permite resolver un subdominio aunque no exista en `domains`.
- No se exige `domains.status = active` ni `verified_at` para dominios personalizados.
- No se comprueba explícitamente el estado activo del tenant antes de inicializarlo.
- `Origin` y `Referer` no son evidencia confiable de identidad; sólo sirven como contexto del navegador.

La corrección requiere definir primero si la API productiva será same-origin bajo cada dominio tenant o centralizada en `api.inventarya.com`. No debe reordenarse el resolver sin pruebas de login, Sanctum, broadcasting, dominios custom y clientes externos.

## Resolver frontend

`src/utils/tenant.ts` usa actualmente:

1. `?tenant=` y persistencia en `localStorage`.
2. Lista de hosts centrales.
3. Primer segmento de cualquier hostname no central.
4. Heurísticas locales por ruta, almacenamiento y puerto.

Limitaciones:

- Un dominio custom como `inventario.empresa.com` se convierte en el slug `inventario`; esto sólo funciona por casualidad si coincide con el tenant.
- El cliente envía `X-Tenant` con el slug, no el hostname completo del dominio custom.
- En hostname bare `localhost`, la comprobación de host central ocurre antes de las heurísticas por puerto; estas últimas no son alcanzables en ese caso. Se conserva para no alterar el flujo local sin pruebas.
- Las claves históricas de localStorage permanecen disponibles sólo como lectura de compatibilidad.

## CORS y wildcard DNS

El wildcard DNS `*.inventarya.com` debe dirigir tráfico; no constituye autorización. La configuración CORS actual acepta patrones de subdominio para evitar listas estáticas, pero no consulta `domains` en cada request. Por tanto, CORS no demuestra que el origen corresponda a un dominio activo y verificado.

El control real debe implementarse en middleware de request, con caché e invalidación, consultando `domains` y el estado del tenant. Hasta entonces:

- no considerar el wildcard CORS como control de acceso;
- mantener autenticación y autorización obligatorias;
- no habilitar dominios custom para datos reales;
- no retirar todavía los patrones legacy.

## Referencias legacy y URLs fijas

Backend:

- app/Support/DomainConfiguration.php: los defaults de dominio y CORS se actualizaron para Inventarya después de esta auditoría.
- app/Http/Middleware/InitializeTenancyFlexible.php: el comportamiento heredado del resolver se revisó en la Fase 3.
- `TenantService`, `LandingController` y `AnalyticsController`: fallbacks locales que deben separarse por ambiente durante la futura refactorización del resolver.

Frontend:

- Las claves históricas y la base offline del POS se conservan para evitar pérdida de datos.
- Las pantallas y reportes muestran Inventarya como fallback.
- `TenantDomainStep.tsx`, `TenantModal.tsx`, `TenantSearchSection.tsx` y `TenantsPage.tsx` contienen `inventarya.com` directamente; una futura configuración multi-marca debe centralizarlos.
- `robots.txt` y `sitemap.xml` contienen el dominio canónico público de forma intencional.

Estas referencias no se reemplazaron masivamente porque algunas identifican almacenamiento persistente del navegador y otras forman parte del SEO canónico.

## Backups y datos persistentes

- `config/backup.php` apunta a PostgreSQL central y ya no asume MySQL.
- El endpoint HTTP de descarga queda deshabilitado por defecto fuera de `local`/`testing` mediante `BACKUP_DOWNLOAD_ENABLED=false`.
- La plantilla productiva utiliza el disco privado `backups`, bajo `storage/app/private/backups`.
- La ruta existente está dentro de un grupo amplio de roles tenant; si alguna vez se habilita en producción, necesita autorización específica y ejecución asíncrona para evitar exposición de datos y agotamiento de recursos.
- La estrategia dinámica para todas las bases tenant sigue pendiente.
- También deben respaldarse los archivos persistentes de `storage/app/public`, o migrarse a R2/S3 con versionado.

No habilitar datos reales antes de probar de extremo a extremo: backup central, restore central, inventario de tenants, backup de cada tenant, restore de cada tenant y recuperación de archivos.

## Secretos

No se detectaron claves privadas ni tokens de formato conocido en los archivos rastreados actuales. El `.env` local contiene secretos de desarrollo y permanece ignorado. La credencial eliminada de `SuperadminSeeder` sigue potencialmente presente en el historial Git existente; debe considerarse comprometida y rotarse si fue reutilizada.

Se eliminó el log del payload completo de onboarding porque incluía la contraseña del propietario. Permanece como deuda de alto riesgo el campo cifrado `owner_password_encrypted` dentro de `tenants.data`: es reversible con `APP_KEY` y lo consume `ReprovisionTenantOwners`. Debe reemplazarse por un flujo de reseteo/invitación antes de producción real, sin retirarlo ahora porque cambiaría el reprovisionamiento existente.

## Gate de producción

Bloqueos antes de desplegar con datos reales:

1. Diseñar y probar el resolver basado en `Host`/`domains`, incluyendo API centralizada y dominios custom.
2. Exigir estado activo/verificado para dominio y tenant.
3. Implementar verificación de propiedad de dominios custom.
4. Implementar y restaurar backups central, tenant y archivos.
5. Probar una migración completa sobre copias representativas.
6. Probar Nginx, TLS wildcard, Reverb, colas, scheduler, correo y almacenamiento en staging.
7. Rotar cualquier credencial que haya existido en el historial.
