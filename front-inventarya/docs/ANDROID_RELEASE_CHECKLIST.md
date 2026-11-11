# Checklist previo al AAB — INVENTARYA

- [ ] Confirmar applicationId/namespace com.culking.inventarya; no cambiar después de publicar.
- [ ] Incrementar versionCode y versionName en android/app/build.gradle.
- [ ] google-services.json real: proyecto inventarya-d0e77 y package correcto; nunca service-account.
- [ ] Instalar los recursos oficiales enumerados en ANDROID_ASSETS_REQUIRED.md.
- [ ] Verificar adaptive icon, monochrome, launcher, small icon y splash Android 12+.
- [ ] Permisos mínimos INTERNET/CAMERA/POST_NOTIFICATIONS; sin READ/WRITE_EXTERNAL_STORAGE.
- [ ] Evaluar manifest fusionado de dependencias y política de backup deshabilitada.
- [ ] API HTTPS de producción; sin server.url/live reload ni cleartext.
- [ ] Desplegar puente backend y configurar NATIVE_APP_ORIGINS=https://localhost.
- [ ] Autorizar localhost en Reverb conservando los hosts existentes.
- [ ] Usar clave PUBLICA Reverb de producción al hacer build Android.
- [ ] Login, restauración, expiración y logout tenant; Central no registra token.
- [ ] Selección/cambio de negocio; token no queda operativo en tenant anterior.
- [ ] FCM: POST device-tokens con version; renovación; DELETE/logout; error offline.
- [ ] Push foreground/background/cold-start, canales y pulsación segura.
- [ ] Cámara y galería: aceptar/denegar/cancelar; 2MB; recuperación tras matar proceso.
- [ ] Scanner QR/EAN-13/EAN-8/UPC/Code128 en hardware; cancelar/iniciar/salir/linterna.
- [ ] Foto -> API -> MEDIA_DISK=r2 -> CDN; paths relativos; sin acceso R2 directo.
- [ ] Verificar otros formularios web de imágenes y funcionalidades POS existentes.
- [ ] npm test, npm run typecheck, npm run build y npm run build:android.
- [ ] npx cap sync android y Gradle assembleDebug/lintDebug.
- [ ] Resolver vulnerabilidades de dependencias evaluadas antes de release; no aplicar audit fix --force sin revisión.
- [ ] Revisar tamaño de bundle, rendimiento WebView, accesibilidad y dispositivos de poca memoria.
- [ ] Revisar consentimiento, privacidad, Data Safety y permiso de notificaciones para Play.
- [ ] Crear/gestionar clave de subida solo con decisión explícita; ignorar jks/keystore/properties.
- [ ] Proteger y respaldar firma fuera del repositorio; valorar Play App Signing.
- [ ] Generar posteriormente AAB release firmado y probar canal interno de Play.
- [ ] Completar ficha, capturas, política de privacidad, clasificación y requisitos vigentes de Play.

Esta tarea no publica, no crea keystore definitivo ni AAB firmado. Sync y pruebas simuladas no sustituyen la validación física ni un envío FCM real.
