<?php

use App\Models\CentralUser;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

// Canal para notificaciones privadas de usuario
Broadcast::channel('tenants.{tenantId}.users.{id}', function ($user, $tenantId, $id) {
    return $user instanceof User
        && (string) tenant('id') === (string) $tenantId
        && (string) $user->id === (string) $id;
});

// Canal para notificaciones de administradores
Broadcast::channel('tenants.{tenantId}.admins', function ($user, $tenantId) {
    return $user instanceof User
        && (string) tenant('id') === (string) $tenantId
        && in_array($user->role, ['owner', 'admin'], true);
});

Broadcast::channel('App.Models.CentralUser.{id}', function ($user, $id) {
    return $user instanceof CentralUser && (string) $user->id === (string) $id;
});
