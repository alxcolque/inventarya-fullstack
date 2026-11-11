<?php

namespace App\Providers;

use App\Contracts\SiatSoapClientInterface;
use App\Services\Siat\SiatServiceFactory;
use Illuminate\Support\ServiceProvider;

/**
 * SiatServiceProvider
 *
 * Registra los bindings del sistema SIAT en el contenedor de inyección
 * de dependencias de Laravel.
 *
 * SiatSoapClientInterface no se liga con una implementación concreta aquí:
 * la resolución del cliente (real vs. fake) se delega a SiatServiceFactory,
 * lo que facilita los tests sin necesidad de sobreescribir bindings.
 */
class SiatServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Factory disponible via inyección de dependencias
        $this->app->singleton(SiatServiceFactory::class, function () {
            return new SiatServiceFactory();
        });
    }

    public function boot(): void
    {
        // Publicar config si es necesario
        $this->mergeConfigFrom(
            base_path('config/siat.php'),
            'siat'
        );
    }
}
