<?php

namespace App\Services;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class ActivityLogService
{
    /**
     * Log an activity.
     */
    public static function log(Model $model, string $action, ?string $description = null): void
    {
        // Logic to store activity log in database
        // This usually involves an ActivityLog model
        /*
        ActivityLog::create([
            'user_id'     => Auth::id(),
            'tenant_id'   => Auth::user()?->tenant_id,
            'subject_id'  => $model->getKey(),
            'subject_type'=> get_class($model),
            'action'      => $action,
            'description' => $description ?? "Model " . $action,
            'properties'  => $model->getDirty(),
            'ip_address'  => request()->ip(),
            'user_agent'  => request()->userAgent(),
        ]);
        */
    }

    /**
     * Log an authentication event.
     */
    public static function logAuth(string $event, $user = null): void
    {
        // Log login, logout, password change, etc.
    }

    /**
     * Log a payment or subscription event.
     */
    public static function logBilling(string $action, $details = null): void
    {
        // Log billing related activities
    }
}
