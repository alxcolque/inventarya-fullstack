<?php

namespace App\Enums;

enum UserRoleEnum: string
{
    // Central Roles
    case SUPERADMIN = 'superadmin';
    case SUPPORT = 'support';

    // Tenant Roles
    case OWNER = 'owner';
    case ADMIN = 'admin';
    case STAFF = 'staff';
}
