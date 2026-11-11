<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SiatInvoiceSequence extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'siat_invoice_sequences';

    protected $fillable = [
        'store_id',
        'branch_code',
        'point_of_sale_code',
        'last_number',
    ];

    protected $casts = [
        'branch_code'        => 'integer',
        'point_of_sale_code' => 'integer',
        'last_number'        => 'integer',
    ];

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }
}
