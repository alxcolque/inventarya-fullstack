<?php

namespace App\Traits;

use App\Services\ActivityLogService;

trait HasActivityLogs
{
    /**
     * Boot the trait.
     */
    protected static function bootHasActivityLogs(): void
    {
        static::created(function ($model) {
            $model->logActivity('created');
        });

        static::updated(function ($model) {
            $model->logActivity('updated');
        });

        static::deleted(function ($model) {
            $model->logActivity('deleted');
        });
    }

    /**
     * Log activity for this model.
     */
    public function logActivity(string $action): void
    {
        // ActivityLogService::log($this, $action);
    }
}
