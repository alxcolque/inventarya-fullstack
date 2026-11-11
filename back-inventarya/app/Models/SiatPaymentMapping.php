<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SiatPaymentMapping extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'siat_payment_mappings';

    protected $fillable = [
        'commercial_method',
        'siat_payment_method_code',
    ];

    protected $casts = [
        'siat_payment_method_code' => 'integer',
    ];

    public function paymentMethod(): BelongsTo
    {
        return $this->belongsTo(SiatPaymentMethod::class, 'siat_payment_method_code', 'code');
    }
}
