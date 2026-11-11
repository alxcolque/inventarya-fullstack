<?php

namespace App\Models;

use App\Enums\ElectronicInvoiceStatus;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ElectronicInvoice extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'electronic_invoices';

    /**
     * Formato de fecha con precisión de microsegundos para preservar los milisegundos
     * requeridos por el SIN para el CUF y el XML de emisión fiscal.
     */
    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $fillable = [
        'sale_id',
        'store_id',
        'siat_cufd_id',
        'issuer_nit',
        'issuer_business_name',
        'issuer_municipality',
        'issuer_address',
        'issuer_phone',
        'branch_code',
        'point_of_sale_code',
        'siat_environment',
        'siat_modality',
        'buyer_document_type',
        'buyer_document_number',
        'buyer_document_complement',
        'buyer_name',
        'buyer_customer_code',
        'invoice_number',
        'cuf',
        'cufd_snapshot',
        'control_code',
        'issued_at',
        'document_sector_code',
        'subtotal',
        'discount',
        'additional_discount',
        'gift_card_amount',
        'total',
        'total_subject_to_vat',
        'currency_code',
        'exchange_rate',
        'total_in_currency',
        'payment_method_code',
        'card_number',
        'exception_code',
        'cafc',
        'legend',
        'issued_by',
        'status',
        'cancellation_reason_code',
        'cancelled_at',
        'cancellation_status_code',
        'cancellation_pending_at',
        'cancellation_reversed_at',
        'cancellation_reversal_status_code',
        'cancellation_reversal_pending_at',
        'reception_code',
        'sin_response',
        'error_message',
        'verification_attempts',
        'last_verified_at',
        'next_verification_at',
        'xml_path',
        'pdf_path',
    ];

    protected $casts = [
        'status' => ElectronicInvoiceStatus::class,
        'cancellation_reason_code' => 'integer',
        'cancellation_status_code' => 'integer',
        'cancelled_at' => 'datetime',
        'cancellation_pending_at' => 'datetime',
        'cancellation_reversed_at' => 'datetime',
        'cancellation_reversal_status_code' => 'integer',
        'cancellation_reversal_pending_at' => 'datetime',
        'sin_response' => 'array',
        'issued_at' => 'datetime',
        'last_verified_at' => 'datetime',
        'next_verification_at' => 'datetime',
        'verification_attempts' => 'integer',
        'branch_code' => 'integer',
        'point_of_sale_code' => 'integer',
        'siat_environment' => 'integer',
        'siat_modality' => 'integer',
        'buyer_document_type' => 'integer',
        'invoice_number' => 'integer',
        'document_sector_code' => 'integer',
        'currency_code' => 'integer',
        'payment_method_code' => 'integer',
        'exception_code' => 'integer',
        'exchange_rate' => 'decimal:5',
        'subtotal' => 'decimal:2',
        'discount' => 'decimal:2',
        'additional_discount' => 'decimal:2',
        'gift_card_amount' => 'decimal:2',
        'total' => 'decimal:2',
        'total_subject_to_vat' => 'decimal:2',
        'total_in_currency' => 'decimal:2',
    ];

    /**
     * Determina si la factura tuvo una anulación previa que fue revertida por única vez.
     */
    public function isCancellationReversed(): bool
    {
        return $this->cancellation_reversed_at !== null;
    }

    public function cancellationReason(): BelongsTo
    {
        return $this->belongsTo(SiatCancellationReason::class, 'cancellation_reason_code', 'code');
    }

    public function sale(): BelongsTo
    {
        return $this->belongsTo(Sale::class);
    }

    public function store(): BelongsTo
    {
        return $this->belongsTo(Store::class);
    }

    public function siatCufd(): BelongsTo
    {
        return $this->belongsTo(SiatCufd::class);
    }

    public function details(): HasMany
    {
        return $this->hasMany(ElectronicInvoiceDetail::class);
    }

    public function operations(): HasMany
    {
        return $this->hasMany(SiatInvoiceOperation::class, 'electronic_invoice_id');
    }
}
