<?php

namespace App\Events\Tenant;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class SaleCompletedEvent
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $data;

    /**
     * Create a new event instance.
     * $data expected keys: sale_id, store_id, store_name, total, seller_name, action_url
     */
    public function __construct(array $data)
    {
        $this->data = $data;
    }
}
