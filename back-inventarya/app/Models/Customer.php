<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'phone',
        'email',
        'address',
        'document_type',
        'document_number',
        'document_complement',
    ];

    protected $casts = [
        'document_type' => 'integer',
    ];

    protected $appends = [
        'cinit',
    ];

    /**
     * Backward-compatibility accessor for cinit -> document_number.
     */
    public function getCinitAttribute(): ?string
    {
        return $this->document_number;
    }

    /**
     * Backward-compatibility mutator for cinit -> document_number.
     */
    public function setCinitAttribute(?string $value): void
    {
        $this->attributes['document_number'] = $value;
    }

    /* Sales */
    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }
}
