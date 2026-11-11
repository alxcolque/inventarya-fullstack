<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class CentralUser extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $table = 'central_users';

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
        'status',
        'avatar',
        'last_login_at',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
        'last_login_at' => 'datetime',
    ];

    public function getAvatarAttribute($value): ?string
    {
        if (empty($value)) {
            return null;
        }

        return \App\Services\FileStorageService::getPublicUrl($value);
    }

    /**
     * Check if the user has any of the given roles.
     * Used by CheckRole middleware.
     */
    public function hasAnyRole(array $roles): bool
    {
        return in_array($this->role, $roles);
    }
}
