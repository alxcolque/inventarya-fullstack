<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Subscription extends Model
{
    protected $fillable = [
        'tenant_id',
        'plan_id',
        'starts_at',
        'ends_at',
        'trial_ends_at',
        'cancelled_at',
        'status',
        'billing_cycle',
        'price',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'trial_ends_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'price' => 'float',
    ];

    public function isActive(): bool
    {
        if ($this->status === 'active') {
            return is_null($this->ends_at) || $this->ends_at->isFuture();
        }

        if ($this->status === 'trialing') {
            return $this->isTrialing();
        }

        return false;
    }

    public function isTrialing(): bool
    {
        if ($this->status !== 'trialing') {
            return false;
        }

        return is_null($this->trial_ends_at) || $this->trial_ends_at->isFuture();
    }

    public function isExpired(): bool
    {
        if ($this->status === 'expired') {
            return true;
        }

        if ($this->status === 'trialing' && !is_null($this->trial_ends_at) && $this->trial_ends_at->isPast()) {
            return true;
        }

        if (!is_null($this->ends_at) && $this->ends_at->isPast()) {
            return true;
        }

        return false;
    }

    public function trialDaysRemaining(): ?int
    {
        if (!$this->isTrialing() || is_null($this->trial_ends_at)) {
            return null;
        }

        return max(0, (int) now()->diffInDays($this->trial_ends_at, false));
    }

    public function tenant()
    {
        return $this->belongsTo(Tenant::class);
    }

    public function plan()
    {
        return $this->belongsTo(Plan::class);
    }

    public function payments()
    {
        return $this->hasMany(Payment::class);
    }
}
