<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SiatEconomicActivity extends Model
{
    use HasFactory, HasUuids;

    protected $table = 'siat_economic_activities';

    protected $fillable = [
        'code',
        'description',
        'activity_type',
    ];
}
