<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SiatCufd extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'siat_cufds';

    protected $fillable = [
        'store_id',
        'branch_code',
        'point_of_sale_code',
        'cufd',
        'control_code',
        'valid_from',
        'valid_until',
        'is_active',
    ];

    protected $casts = [
        'branch_code' => 'integer',
        'point_of_sale_code' => 'integer',
        'is_active' => 'boolean',
        'valid_from' => 'datetime',
        'valid_until' => 'datetime',
    ];

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function electronicInvoices(): HasMany
    {
        return $this->hasMany(ElectronicInvoice::class);
    }

    /**
     * Determina si el CUFD es legalmente vigente.
     */
    public function isValid(): bool
    {
        return $this->is_active && $this->valid_until !== null && $this->valid_until->isAfter(now());
    }

    /**
     * Determina si el CUFD está dentro de la ventana de renovación preventiva (por defecto 60 minutos).
     */
    public function shouldRenew(int $thresholdMinutes = 60): bool
    {
        if (!$this->isValid()) {
            return true;
        }

        return $this->valid_until->isBefore(now()->addMinutes($thresholdMinutes));
    }
}
