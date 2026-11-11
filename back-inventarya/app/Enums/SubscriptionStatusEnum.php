<?php

namespace App\Enums;

enum SubscriptionStatusEnum: string
{
    case ACTIVE = 'active';
    case EXPIRED = 'expired';
    case CANCELLED = 'cancelled';
    case TRIAL = 'trial';
}
