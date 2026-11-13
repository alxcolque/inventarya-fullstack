<?php

namespace App\Providers;

use App\Contracts\DomainOwnershipVerifier;
use App\Models\CentralUser;
use App\Models\Domain;
use App\Models\InventoryStore;
use App\Models\InventoryWarehouse;
use App\Models\Tenant;
use App\Models\User;
use App\Observers\DomainObserver;
use App\Observers\InventoryStockObserver;
use App\Observers\TenantDomainCacheObserver;
use App\Permissions\CentralPermissions;
use App\Permissions\TenantPermissions;
use App\Services\ProductAttributeService;
use App\Services\UnconfiguredDomainOwnershipVerifier;
use App\Tenancy\EloquentTenantDomainRepository;
use App\Tenancy\TenantDomainRepository;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(TenantDomainRepository::class, EloquentTenantDomainRepository::class);
        $this->app->bind(DomainOwnershipVerifier::class, UnconfiguredDomainOwnershipVerifier::class);
        $this->app->scoped(ProductAttributeService::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Global Gate resolver for Central and Tenant capabilities
        Gate::before(function ($user, string $ability) {
            if ($user instanceof CentralUser) {
                return CentralPermissions::can($user->role ?? '', $ability);
            }

            if ($user instanceof User) {
                return TenantPermissions::can($user->role ?? '', $ability);
            }

            return null;
        });

        InventoryStore::observe(InventoryStockObserver::class);
        InventoryWarehouse::observe(InventoryStockObserver::class);
        Domain::observe(DomainObserver::class);
        Tenant::observe(TenantDomainCacheObserver::class);

        // Eventos y Listeners del Sistema de Notificaciones
        Event::listen(
            \App\Events\Tenant\StockLowEvent::class,
            \App\Listeners\Tenant\SendStockNotificationListener::class
        );
        Event::listen(
            \App\Events\Tenant\StockOutEvent::class,
            \App\Listeners\Tenant\SendStockNotificationListener::class
        );
        // Los listeners con un evento concreto en handle() son descubiertos
        // automáticamente por Laravel. Registrar aquí únicamente el listener
        // polimórfico de stock evita despachos duplicados.
    }
}
