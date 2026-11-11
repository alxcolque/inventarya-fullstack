<?php

use App\Support\DomainConfiguration;

return [
    // Exact native WebView origins.
    'native_origins' => array_values(array_filter(array_map('trim', explode(',', env('NATIVE_APP_ORIGINS', 'https://localhost,capacitor://localhost,https://inventarya.com'))))),
    'root_domain' => DomainConfiguration::tenantRootDomain(),
    'root_domains' => DomainConfiguration::tenantRootDomains(),
    'cache_ttl_seconds' => (int) env('TENANT_DOMAIN_CACHE_TTL', 300),
    'authorized_tenant_statuses' => ['active', 'trial'],
];
