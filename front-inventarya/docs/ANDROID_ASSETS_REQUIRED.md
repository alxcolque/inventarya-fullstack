# Recursos Android pendientes — INVENTARYA

Los mipmaps y splash existentes se conservan como recursos provisionales; no se ha generado un logo definitivo.
Crear a partir del logo oficial. No sustituir con iconos inventados.

| Recurso fuente | Tamaño recomendado | Formato/fondo | Destino | Uso |
|---|---|---|---|---|
| app-icon.png | 1024 x 1024 | PNG, fondo opaco, sin esquinas dibujadas | resources/ de frontend-inv como fuente; generar android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png y ic_launcher_round.png | Launcher legacy, tamaños 48/72/96/144/192 px |
| adaptive-foreground.png | 432 x 432 (108 dp a xxxhdpi) | PNG transparente; marca dentro de zona segura central 66 dp | mipmap-*/ic_launcher_foreground.png | Foreground del adaptive icon existente |
| adaptive-background | 108 dp, export 432 x 432 si imagen | Color sólido o drawable opaco | res/values/ic_launcher_background.xml o drawable | Fondo adaptive, sin texto |
| monochrome.xml | viewport 108 x 108 | Vector Android de una tinta, silueta/transparencia | res/drawable/ic_launcher_monochrome.xml; referenciar en mipmap-anydpi-v33/ic_launcher.xml y round | Iconos temáticos Android 13+ |
| splash.png (fuente) | 2732 x 2732 | PNG, logo centrado y amplio margen, fondo de marca | resources/; exportar a drawable-* existentes | Splash previo a Android 12 |
| splash-icon.xml o PNG | 288 dp sin fondo (logo dentro de círculo 192 dp); o 240 dp con fondo (logo 160 dp) | Vector o PNG transparente | res/drawable; configurar windowSplashScreenAnimatedIcon y windowSplashScreenBackground en tema Android 12+ | Splash del sistema Android 12+ |
| ic_stat_notification.xml | 24 x 24 dp; PNG 24/36/48/72/96 px por densidad si raster | Silueta blanca sobre transparencia, sin colores/fondo | res/drawable/ic_stat_notification.xml o drawable-* | Small icon FCM, status bar |
| play-store-icon.png | 512 x 512 | PNG 32 bits, fondo opaco | assets de publicación fuera del bundle | Ficha Play Store futura |
| feature-graphic.png | 1024 x 500 | PNG/JPEG opaco | assets de publicación | Ficha Play Store futura |

Al crear small icon añadir en application metadata com.google.firebase.messaging.default_notification_icon=@drawable/ic_stat_notification y verificar el nombre si Firebase envía icon explícito.
No referenciar un recurso inexistente ahora: rompería Gradle.
Revisar tema values/styles.xml para Android 12+, light/dark, recortes adaptativos circulares y splash en dispositivo.
Generadores de assets son opcionales; revisar visualmente cada densidad. No se añadió una dependencia de generación ni se aprobó el arte definitivo.
