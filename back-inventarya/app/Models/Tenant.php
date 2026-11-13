<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Concerns\HasDatabase;
use Stancl\Tenancy\Database\Concerns\HasDomains;
use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;

class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase, HasDomains, HasFactory;

    protected static function booted()
    {
        static::deleting(function (Tenant $tenant) {
            $tenant->domains()->get()->each->delete();
            $tenant->subscriptions()->delete();
            $tenant->payments()->delete();
        });
    }

    public static function getCustomColumns(): array
    {
        return [
            'id',
            'name',
            'slug',
            'status',
            'database',
            'database_host',
            'database_port',
            'database_username',
            'database_password',
            'owner_name',
            'owner_email',
            'owner_phone',
            'logo',
            'business_type_id',
        ];
    }

    protected $fillable = [
        'id',
        'name',
        'slug',
        'status',
        'database',
        'database_host',
        'database_port',
        'database_username',
        'database_password',
        'owner_name',
        'owner_email',
        'owner_phone',
        'logo',
        'business_type_id',
        'data',
    ];

    protected $casts = [
        'data' => 'array',
    ];

    public function getDatabaseName(): string
    {
        $dbSlug = $this->database;

        if (empty($dbSlug)) {
            throw new \Exception("Tenant '{$this->id}' has no database slug configured.");
        }

        // Always return tenant_[slug] — the physical PostgreSQL database name.
        // The 'database' column stores the short slug (e.g. 'inventario1').
        // The actual database is always 'tenant_inventario1'.
        return 'tenant_'.$dbSlug;
    }

    public function getInternal(string $key)
    {
        switch ($key) {
            case 'db_name':
                // Return the fully prefixed database name so Stancl connects to the correct DB
                return $this->getDatabaseName();
            case 'db_host':
                return $this->database_host ?? config('database.connections.central.host') ?? env('DB_HOST', '127.0.0.1');
            case 'db_port':
                return $this->database_port ?? config('database.connections.central.port') ?? env('DB_PORT', '5432');
            case 'db_username':
                return $this->database_username ?? config('database.connections.central.username') ?? env('DB_USERNAME', 'postgres');
            case 'db_password':
                return $this->database_password ?? config('database.connections.central.password') ?? env('DB_PASSWORD', '');
            default:
                return parent::getInternal($key);
        }
    }

    public function setInternal(string $key, $value)
    {
        switch ($key) {
            case 'db_name':
                $this->database = $value;
                break;
            case 'db_host':
                $this->database_host = $value;
                break;
            case 'db_port':
                $this->database_port = $value;
                break;
            case 'db_username':
                $this->database_username = $value;
                break;
            case 'db_password':
                $this->database_password = $value;
                break;
            default:
                parent::setInternal($key, $value);
                break;
        }

        return $this;
    }

    public function createTenantDatabase(): void
    {
        $dbName = $this->getDatabaseName();
        if (empty($dbName)) {
            throw new \Exception('Database name is empty for tenant: '.$this->id);
        }

        $centralConfig = config('database.connections.central') ?? [];
        $host = $centralConfig['host'] ?? env('DB_HOST', '127.0.0.1');
        $port = $centralConfig['port'] ?? env('DB_PORT', '5432');
        $username = $centralConfig['username'] ?? env('DB_USERNAME', 'postgres');
        $password = $centralConfig['password'] ?? env('DB_PASSWORD', '');

        $dsn = "pgsql:host={$host};port={$port};dbname=postgres";

        try {
            $pdo = new \PDO($dsn, $username, $password, [
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            ]);

            // Check if database already exists
            $stmt = $pdo->prepare('SELECT 1 FROM pg_database WHERE datname = :dbname');
            $stmt->execute(['dbname' => $dbName]);
            $exists = $stmt->fetchColumn();

            if (! $exists) {
                // Execute CREATE DATABASE outside transaction
                $pdo->exec("CREATE DATABASE \"{$dbName}\"");
            }
        } catch (\PDOException $e) {
            throw new \Exception("Failed to create PostgreSQL database for tenant '{$this->id}': ".$e->getMessage(), 0, $e);
        }
    }

    public function dropTenantDatabase(): void
    {
        $dbName = $this->getDatabaseName();
        if (empty($dbName)) {
            return;
        }

        $centralConfig = config('database.connections.central') ?? [];
        $host = $centralConfig['host'] ?? env('DB_HOST', '127.0.0.1');
        $port = $centralConfig['port'] ?? env('DB_PORT', '5432');
        $username = $centralConfig['username'] ?? env('DB_USERNAME', 'postgres');
        $password = $centralConfig['password'] ?? env('DB_PASSWORD', '');

        $dsn = "pgsql:host={$host};port={$port};dbname=postgres";

        try {
            $pdo = new \PDO($dsn, $username, $password, [
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            ]);

            // Terminate active connections to the tenant DB first
            $pdo->exec("
                SELECT pg_terminate_backend(pg_stat_activity.pid)
                FROM pg_stat_activity
                WHERE pg_stat_activity.datname = '{$dbName}'
                  AND pid <> pg_backend_pid();
            ");

            $pdo->exec("DROP DATABASE IF EXISTS \"{$dbName}\"");
        } catch (\PDOException $e) {
            logger()->error("Failed to drop database '{$dbName}' on rollback: ".$e->getMessage());
        }
    }

    public function runTenantMigrations(): void
    {
        \Illuminate\Support\Facades\Artisan::call('tenants:migrate', [
            '--tenants' => [$this->id],
        ]);
    }

    public function runTenantSeeders(): void
    {
        \Illuminate\Support\Facades\Artisan::call('tenants:seed', [
            '--tenants' => [$this->id],
        ]);
    }

    public function businessType()
    {
        return $this->belongsTo(BusinessType::class);
    }

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class);
    }

    public function currentSubscription()
    {
        return $this->hasOne(Subscription::class)->latestOfMany();
    }

    public function plan()
    {
        return $this->hasOneThrough(Plan::class, Subscription::class, 'tenant_id', 'id', 'id', 'plan_id');
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }

    public function getActiveSubscription(): ?Subscription
    {
        $sub = $this->subscriptions()
            ->whereIn('status', ['active', 'trialing'])
            ->latest('id')
            ->first();

        if ($sub && $sub->isActive()) {
            return $sub;
        }

        return $this->currentSubscription;
    }

    public function getActivePlan(): ?Plan
    {
        $sub = $this->getActiveSubscription();
        if ($sub && $sub->plan) {
            return $sub->plan;
        }

        return $this->plan;
    }
}
