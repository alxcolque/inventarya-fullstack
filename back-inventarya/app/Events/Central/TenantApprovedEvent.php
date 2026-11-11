<?php

namespace App\Events\Central;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TenantApprovedEvent
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $data;

    /**
     * $data expected keys: tenant_id, business_name, owner_name, owner_email, domain, login_url
     */
    public function __construct(array $data)
    {
        $this->data = $data;
    }
}
