<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SiatPaymentMethod extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'siat_payment_methods';

    protected $fillable = [
        'code',
        'description',
    ];

    protected $casts = [
        'code' => 'integer',
    ];
}
