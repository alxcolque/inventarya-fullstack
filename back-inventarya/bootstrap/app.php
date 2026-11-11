<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\HandleCors;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Only the host Nginx FastCGI bridge may supply forwarded headers.
        if (env('APP_ENV') === 'production') {
            $middleware->trustProxies(
                at: ['127.0.0.1'],
                headers: Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_HOST
                    | Request::HEADER_X_FORWARDED_PROTO | Request::HEADER_X_FORWARDED_PORT,
            );
        }
        // Validate dynamic tenant origins before Laravel emits CORS headers.
        $middleware->prepend(\App\Http\Middleware\ValidateTenantOrigin::class);
        $middleware->append(HandleCors::class);
        $middleware->api(prepend: [
            \App\Http\Middleware\InitializeTenancyFlexible::class,
        ], append: [
            \App\Http\Middleware\NormalizeDecimalInputs::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })
    ->create();
