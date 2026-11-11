<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Firebase Project ID & Credentials
    |--------------------------------------------------------------------------
    |
    | Ruta del archivo JSON con la clave privada de la cuenta de servicio de Firebase
    | y el identificador del proyecto FCM.
    |
    */

    'project_id' => env('FIREBASE_PROJECT_ID', 'inventarya-d0e77'),

    'credentials' => env(
        'FIREBASE_CREDENTIALS',
        storage_path('app/private/firebase/service-account.json')
    ),

];
