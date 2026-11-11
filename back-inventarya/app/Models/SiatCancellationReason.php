<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SiatCancellationReason extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'siat_cancellation_reasons';

    protected $fillable = [
        'code',
        'description',
    ];

    protected $casts = [
        'code' => 'integer',
    ];
}
