<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Assignment extends Model
{
    use HasFactory;
    protected $fillable = ['user_id', 'store_id'];

    /* User */
    public function user(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'assignments', 'user_id', 'store_id');
    }
    /* Store */
    public function store(): BelongsToMany
    {
        return $this->belongsToMany(Store::class);
    }

}
