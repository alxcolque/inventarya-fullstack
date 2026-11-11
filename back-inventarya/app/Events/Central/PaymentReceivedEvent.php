<?php

namespace App\Events\Central;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PaymentReceivedEvent
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $data;

    /**
     * $data expected keys: tenant_name, amount, currency, plan_name, payment_id
     */
    public function __construct(array $data)
    {
        $this->data = $data;
    }
}
