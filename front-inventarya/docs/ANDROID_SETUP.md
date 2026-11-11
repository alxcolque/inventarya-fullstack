# INVENTARYA Android: auditoría y preparación

## Estado encontrado antes de modificar
- Capacitor Core/Android/CLI 8.5.2, Push Notifications 8.1.2, proyecto android y package estable com.culking.inventarya ya existían.
- SDK mínimo 24, compile/target 36, AGP 8.13.0 y wrapper Gradle 8.14.3 ya existían.
- Firebase Laravel/Kreait, PushNotificationService, job tenant-aware y device-tokens ya existían; se conservaron.
- Servicio push, Zustand pushStore y llamadas desde login/checkToken/logout existían. Faltaban espera de listeners, sesión capturada, deduplicación y navegación SPA en apertura fría. Logs Axios podían incluir tokens.
- Canales general/inventory/sales/transfers/important existían; tenían importancia excesiva en varios casos.
- html5-qrcode ya soportaba QR, EAN-13/8, UPC-A/E y Code 128, con modales POS/productos, cancelación, cámara trasera, linterna y zoom. Se conserva; no se instala otro decoder.
- Fotos de producto ya utilizaban FileReader/base64 y Laravel. No existía Camera nativa.
- El WebView https://localhost se interpretaba como dominio tenant localhost. El backend de producción tampoco admitía ese contexto.
- Existía POST_NOTIFICATIONS, faltaba CAMERA y el intent FCM_PLUGIN_ACTIVITY enviado por FirebaseService.
- cleartext estaba habilitado y Android permitía backup de datos. Se endurecieron ambos.
- Existen mipmaps, adaptive icons y splash de la plantilla. No se han aprobado como identidad oficial.
- No se encontró google-services.json, icono monocromo ni small icon específico. No se crearon credenciales.
- No hay App Links HTTPS configurados. La apertura push usa el intent existente del backend y rutas internas; no se habilitan links externos automáticamente.

## Arquitectura
El bundle React se empaqueta en Capacitor. El Android inicial muestra un selector de dominio (ejemplo demo.inventarya.com), conservado solo para plataforma nativa. La autenticación existente usa Bearer y tenantApi contra la API HTTPS. No se carga el sitio remoto en server.url.

El backend incorpora un puente optativo por NATIVE_APP_ORIGINS. Para https://localhost exige X-Tenant-Domain con una fila domains real y activa, comprueba estado y conflictos, y después aplica la autenticación/permisos existentes. Un origen no autentica usuarios. No se cambian tablas, Firebase, Redis ni R2.

Antes de probar Android contra producción se debe desplegar por el procedimiento habitual este pequeño cambio backend y configurar:
- NATIVE_APP_ORIGINS=https://localhost
- Añadir localhost a la lista existente REVERB_ALLOWED_ORIGINS si se necesita Reverb dentro de Android, conservando todos los hosts actuales.
- Reconstruir config cache y reiniciar procesos según el despliegue existente.
No se ha realizado ese despliegue. Añadir solo CORS_ALLOWED_ORIGINS no resuelve el tenant: también se necesita el puente.

## Firebase cliente
Firebase Console > proyecto inventarya-d0e77 > engranaje > Configuración del proyecto > General > Tus apps > Android.
Seleccionar com.culking.inventarya; si no existe, registrar una app Android con ese package exacto. Descargar google-services.json y colocarlo en frontend-inv/android/app/google-services.json.
Gradle valida project_id y package. Una configuración diferente falla explícitamente. Debug sin el archivo puede compilar, pero push no funcionará. Release lo exige.
El archivo cliente no equivale a Firebase Admin. Nunca copiar service-account.json al frontend. Se ignora google-services.json para que cada entorno lo provisione explícitamente.
Para FCM básico no hace falta inventar SHA. Registrar fingerprints posteriormente si otro producto Firebase lo requiere.

## Push y device_tokens
main instala los listeners antes del login y sin pedir permisos. Tras login tenant, initializePushNotifications recibe un snapshot de dominio, tenantId, userId y Bearer.
Consulta permisos, solicita Android 13+ cuando corresponde, crea canales, llama register y recibe token vía registration. App.getInfo aporta versionName como app_version. Se usa POST /api/device-tokens con platform android.
Se evita repetir POST para el mismo token/sesión; al abrir un proceso nuevo se reconfirma para actualizar last_used_at. Un token renovado se registra antes de eliminar el anterior. Al volver a primer plano se comprueba de nuevo sin pedir permisos automáticamente.
registrationError y errores de red no bloquean el login; no se imprimen tokens ni errores Axios completos.
Logout desactiva sesión push, espera operaciones pendientes, intenta DELETE con el contexto original, invalida el token nativo y limpia notificaciones entregadas. Si DELETE falla offline, la fila puede persistir hasta limpieza por FCM inválido; verificar este caso en dispositivo.
Cambiar negocio solo desde login, tras logout. No se registra push en Central.
Notificaciones de primer plano usan el centro y toast Tenant existente; id notification_id permite deduplicar Reverb/FCM cuando el backend lo envía.
Al pulsar una notificación se conserva la ruta hasta disponer de sesión y router. Se rechazan URLs externas, //, backslashes, controles y variantes codificadas. Se verifica tenant_id si viene en data.
Canales: General/Inventario/Ventas/Transferencias importancia 3; Importantes 4. Visibilidad privada en lockscreen. Android conserva decisiones de canales instalados: para evaluar valores iniciales usar instalación limpia o Ajustes.

## Cámara e imágenes
cameraService y NativePhotoButtons permiten foto/galería en ProductModal. Se mantiene el input web existente.
Se usa Camera 8, permiso CAMERA solo al usar cámara, Photo Picker sin permisos amplios de almacenamiento, saveToGallery=false, JPEG reducido a 1600, calidad 80. No hay copia permanente solicitada en galería. Android administra los temporales del plugin.
Cancelación es neutral; permisos rechazados y errores se muestran. Se limita a JPEG/PNG/WebP y 2 MB, y el backend conserva validación definitiva.
No se sube automáticamente al tomar foto: el usuario confirma el producto y usa el store/API existente.
Android -> foto/base64 -> API Laravel -> FileStorageService -> MEDIA_DISK -> R2. El cliente no contiene credenciales R2 ni SDK S3.
La utilidad image preserva URLs CDN/API absolutas; paths legacy se resuelven contra VITE_API_PUBLIC_URL en Android y /storage en web. El backend sigue generando la URL CDN desde el path.
Si Android mata el proceso durante la actividad de cámara, no asociar automáticamente el resultado a otro formulario/tenant; reabrir el producto y repetir la foto.

## Scanner reutilizado
barcodeScannerService centraliza formatos/fábrica/permisos y stop. Los dos modales existentes conservan UI y lógica del negocio.
Se utiliza html5-qrcode sobre getUserMedia del WebView; no hay otro plugin de scanner ni servicio duplicado.
Se cancela la apertura pendiente cuando se cierra el modal; se libera cámara al desmontar y al ocultar la app. Al volver se puede pulsar iniciar. La linterna depende de capacidades reales de MediaStream; no se promete en dispositivos que no la soporten.
Los módulos futuros pueden utilizar createBarcodeScanner y stopBarcodeScanner con su propio contenedor y callbacks.
Probar cámara trasera, autofocus, EAN-13, EAN-8, UPC-A/E, Code 128, QR, cancelación durante permisos, background y reapertura. El resultado requiere validación en hardware: una prueba TypeScript no demuestra decodificación óptica.

## Configuración/build
Todas las variables VITE_* son públicas. No añadir secretos de Laravel, Firebase Admin, R2, SMTP, PostgreSQL o Redis.
La web mantiene npm run dev y npm run build. Android usa npm run build:android, con modo android y endpoints HTTPS de producción centralizados en scripts/build-android.mjs. Nunca cambiar URLs en componentes.
Copiar .env.android.example a .env.android.local y proporcionar ANDROID_REVERB_APP_KEY con la clave PUBLICA de producción. No es el secreto Reverb. Si falta se usa VITE_REVERB_APP_KEY existente; verificar que no sea la clave local.
No se modificaron .env reales. No se añade VITE_R2_URL.
Requisitos locales: Node compatible con Capacitor 8 (22+), JDK 21, Android Studio, SDK Platform 36, Build Tools y platform-tools; licencia del SDK aceptada por el desarrollador.

Desde frontend-inv:
~~~sh
npm ci
npm test
npm run typecheck
npm run build
npm run build:android
npx cap sync android
npx cap open android
~~~
Usar siempre build:android inmediatamente antes de sync; cap sync copia el dist actual. El comando npm run android:sync encadena ambas operaciones.
En Android Studio elegir dispositivo y Run app (debug). No generar firma definitiva ni AAB hasta completar checklist.
CLI Windows, con SDK instalado:
~~~powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
cd android
.\gradlew.bat :app:assembleDebug
~~~
En Linux/macOS: configurar JAVA_HOME/ANDROID_HOME y ejecutar ./gradlew :app:assembleDebug.
No se configura cleartext en producción. Desarrollo web local permanece igual; un Android de desarrollo contra servidor local necesita un perfil debug HTTPS explícito, no debilitar esta configuración de producción.

## Prueba física y diagnóstico
1. Configurar puente backend y Reverb, archivo Firebase y clave pública del build.
2. Instalar APK debug, abrir y seleccionar demo.inventarya.com (o el dominio exacto registrado).
3. Login del usuario demo; aceptar notificaciones. Consultar device_tokens dentro del tenant demo mediante herramientas administrativas, sin imprimir el token completo.
4. Capturar/seleccionar foto y guardar producto; comprobar URL CDN y path relativo en backend.
5. Probar scanner y cambiar cámara/linterna si existe.
6. Enviar push por el endpoint/flujo ya existente a ese usuario; probar foreground, background y proceso cerrado. Force-stop de Android bloquea entrega hasta que el usuario vuelva a abrir la app.
7. Tap debe abrir ruta interna; probar payload malicioso y sesión expirada.
8. Logout y cambiar negocio; confirmar que no queda un token operativo asociado al usuario anterior.

403 origen: comprobar NATIVE_APP_ORIGINS y cache. Login en Central por error: comprobar X-Tenant-Domain y despliegue del puente.
FCM sin registration: comprobar google-services, package, permisos, Google Play services y conexión.
SenderIdMismatch: configuración cliente corresponde a otro proyecto.
Fotos relativas a localhost: usar build:android y resolver imagen compartido.
Scanner sin cámara: conceder permiso, actualizar Android System WebView, verificar HTTPS y otro consumidor de cámara.
Push abre pero no navega: comprobar data.route interna, usuario autenticado, tenant y permisos de ruta.
Sin SDK/JDK o errores de descarga Maven: corregir entorno/herramientas; cap sync no demuestra compilación Gradle.

## Referencias verificadas
- https://capacitorjs.com/docs/apis/push-notifications
- https://capacitorjs.com/docs/apis/camera
Se contrastaron también las definiciones TypeScript y fuentes Android instaladas de los plugins.
