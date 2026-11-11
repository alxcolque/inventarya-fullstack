<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SiatProductService extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'siat_product_services';

    protected $fillable = [
        'activity_code',
        'sin_product_code',
        'description',
        'nandina',
    ];

    protected $casts = [
        'sin_product_code' => 'integer',
    ];
}
