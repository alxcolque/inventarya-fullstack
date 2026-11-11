<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'price',
        'yearly_price',
        'max_users',
        'max_stores',
        'max_products',
        'features',
        'custom_domain',
        'multi_store',
        'reports',
        'trial_days',
        'status',
        'description',
    ];

    protected $casts = [
        'features' => 'array',
        'custom_domain' => 'boolean',
        'multi_store' => 'boolean',
        'reports' => 'boolean',
        'price' => 'float',
        'yearly_price' => 'float',
        'trial_days' => 'integer',
    ];

    public function isUnlimited(string $field): bool
    {
        return is_null($this->{$field});
    }

    public function hasFeature(string $feature): bool
    {
        if (in_array($feature, ['custom_domain', 'multi_store', 'reports'], true)) {
            return (bool) $this->{$feature};
        }

        $features = $this->features;
        if (is_array($features)) {
            if (array_key_exists($feature, $features)) {
                return (bool) $features[$feature];
            }
            return in_array($feature, $features, true);
        }

        return false;
    }

    public function tenants()
    {
        return $this->hasManyThrough(Tenant::class, Subscription::class, 'plan_id', 'id', 'id', 'tenant_id');
    }

    public function subscriptions()
    {
        return $this->hasMany(Subscription::class);
    }
}
