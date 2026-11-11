<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SiatCuis extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'siat_cuis';

    protected $fillable = [
        'store_id',
        'branch_code',
        'point_of_sale_code',
        'cuis',
        'valid_until',
        'is_active',
    ];

    protected $casts = [
        'branch_code' => 'integer',
        'point_of_sale_code' => 'integer',
        'is_active' => 'boolean',
        'valid_until' => 'datetime',
    ];

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    /**
     * Determina si el CUIS es legalmente vigente.
     */
    public function isValid(): bool
    {
        return $this->is_active && $this->valid_until !== null && $this->valid_until->isAfter(now());
    }

    /**
     * Determina si el CUIS está en ventana de renovación preventiva (por defecto 5 días).
     */
    public function shouldRenew(int $windowDays = 5): bool
    {
        if (!$this->isValid()) {
            return true;
        }

        return $this->valid_until->isBefore(now()->addDays($windowDays));
    }
}
