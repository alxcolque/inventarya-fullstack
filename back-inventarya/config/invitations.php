<?php

return [
    'expires_hours' => (int) env('USER_INVITATION_EXPIRES_HOURS', 48),

    // Supports a {tenant} placeholder, e.g. https://{tenant}.inventarya.com.
    'tenant_frontend_url' => env('TENANT_FRONTEND_URL'),

    'local_frontend_port' => (int) env('TENANT_FRONTEND_PORT', 5173),

    'tenant_root_domain' => env('TENANT_ROOT_DOMAIN', 'inventarya.com'),
];
