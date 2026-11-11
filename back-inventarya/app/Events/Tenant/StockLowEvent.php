<?php

namespace App\Events\Tenant;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class StockLowEvent
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public array $data;

    /**
     * Create a new event instance.
     * $data expected keys: product_id, product_name, store_id, store_name, current_stock, min_stock, action_url
     */
    public function __construct(array $data)
    {
        $this->data = $data;
    }
}
