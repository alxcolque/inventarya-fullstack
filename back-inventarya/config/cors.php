<?php

use App\Support\DomainConfiguration;

return [
    'paths' => ['api/*', 'auth/*', 'broadcasting/auth'],

    'allowed_origins' => DomainConfiguration::corsAllowedOrigins(),

    // In production tenant origins are appended one request at a time only
    // after ValidateTenantOrigin confirms an exact active domains row.
    'allowed_origins_patterns' => in_array(env('APP_ENV', 'production'), ['local', 'testing'], true)
        ? DomainConfiguration::corsAllowedOriginPatterns()
        : [],

    'allowed_methods' => ['*'],
    'allowed_headers' => ['*'],

    'supports_credentials' => true,
];
