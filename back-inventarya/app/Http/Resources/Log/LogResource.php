<?php

namespace App\Http\Resources\Log;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LogResource extends JsonResource
{
    public static $wrap = "log";

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user' => $this->user,
            'acction' => $this->acction,
            'device' => $this->device,
            'ip' => $this->ip,
            'createdAt' => $this->created_at,
            'updatedAt' => $this->updated_at
        ];
    }
}
