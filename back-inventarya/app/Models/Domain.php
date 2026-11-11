<?php

namespace App\Models;

use App\Support\DomainNormalizer;
use Stancl\Tenancy\Database\Models\Domain as BaseDomain;

class Domain extends BaseDomain
{
    protected $fillable = [
        'domain',
        'tenant_id',
        'is_primary',
        'type',
        'status',
        'verified_at',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
        'verified_at' => 'datetime',
    ];

    public function setDomainAttribute(string $value): void
    {
        $this->attributes['domain'] = DomainNormalizer::normalize($value);
    }
}
