<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Support\TenantBroadcastChannel;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'username',
        'email',
        'password',
        'avatar',
        'avatar_key',
        'role',
        'phone',
        'ci',
        'status',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function getAvatarAttribute($value): ?string
    {
        if (empty($value)) {
            return null;
        }

        return \App\Services\FileStorageService::getPublicUrl($this->avatar_key ?? $value);
    }

    /* Assignment */
    public function assignment(): BelongsToMany
    {
        return $this->belongsToMany(Assignment::class, 'assignments', 'user_id', 'store_id');
    }

    /* Sales */
    public function sales(): HasMany
    {
        return $this->hasMany(Sale::class);
    }

    /**
     * Dispositivos móviles registrados para notificaciones Push FCM.
     */
    public function deviceTokens(): HasMany
    {
        return $this->hasMany(DeviceToken::class);
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(UserInvitation::class);
    }

    public function latestInvitation(): HasOne
    {
        // PostgreSQL no implementa MAX(uuid), que es el desempate interno
        // utilizado por latestOfMany(). Ordenar la relación conserva el
        // comportamiento tanto al cargar un usuario como al hacer eager load.
        return $this->hasOne(UserInvitation::class)
            ->orderByDesc('created_at')
            ->orderByDesc('id');
    }

    /* public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    } */

    /* For Notificactions */

    public function isAdmin()
    {
        return $this->role === 'admin';
    }

    public function scopeAdmins($query)
    {
        return $query->where('role', 'admin');
    }

    public function hasAnyRole(array $roles): bool
    {
        return in_array($this->role, $roles);
    }

    public function receivesBroadcastNotificationsOn(): string
    {
        return TenantBroadcastChannel::user($this->getKey());
    }
}
