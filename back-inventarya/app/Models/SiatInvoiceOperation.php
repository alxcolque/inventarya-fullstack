<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SiatInvoiceOperation extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'siat_invoice_operations';

    protected $fillable = [
        'electronic_invoice_id',
        'operation',
        'started_at',
        'finished_at',
        'transport_status',
        'siat_status_code',
        'reception_code',
        'response',
        'error_message',
    ];

    protected $casts = [
        'started_at'       => 'datetime',
        'finished_at'      => 'datetime',
        'siat_status_code' => 'integer',
        'response'         => 'array',
    ];

    public function electronicInvoice(): BelongsTo
    {
        return $this->belongsTo(ElectronicInvoice::class, 'electronic_invoice_id');
    }
}
