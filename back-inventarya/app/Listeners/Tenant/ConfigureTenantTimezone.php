<?php

namespace App\Listeners\Tenant;

use App\Models\Setting;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Stancl\Tenancy\Events\TenancyBootstrapped;

class ConfigureTenantTimezone
{
    /**
     * Handle the event when a tenant has been bootstrapped.
     * Sets PHP runtime timezone, Laravel config, and the DB session timezone.
     */
    public function handle(TenancyBootstrapped $event): void
    {
        try {
            if (! Schema::hasTable('settings')) {
                return;
            }

            $timezone = Setting::query()->value('timezone');
            if (empty($timezone) || ! in_array($timezone, timezone_identifiers_list(), true)) {
                $timezone = config('app.timezone', 'America/La_Paz');
            }

            // 1. Configurar timezone en tiempo de ejecución de PHP
            date_default_timezone_set($timezone);

            // 2. Configurar timezone en Configuración de Laravel
            Config::set('app.timezone', $timezone);

            // 3. Configurar timezone en la sesión activa de la base de datos
            $connection = DB::getDefaultConnection();
            $driver = config("database.connections.{$connection}.driver");

            if ($driver === 'pgsql') {
                DB::statement("SET TIME ZONE '{$timezone}'");
            } elseif ($driver === 'mysql' || $driver === 'mariadb') {
                $offset = (new \DateTime('now', new \DateTimeZone($timezone)))->format('P');
                DB::statement("SET time_zone = '{$offset}'");
            }
        } catch (\Throwable $e) {
            // Ignorar errores durante migraciones iniciales o bootstrapping previo
        }
    }
}
