<?php

namespace App\Http\Resources\Setting;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SettingResource extends JsonResource
{
    public static $wrap = "setting";

    /**
     * Transform the resource into an array.
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'logo' => $this->logo,
            'logoKey' => $this->logo_key,
            'description' => $this->description,
            'header' => $this->header,
            'contact' => $this->contact,
            'support' => $this->support,
            'social' => $this->social,
            'footer' => $this->footer,
            'terms' => $this->terms,
            'policy' => $this->policy,
            'createdAt' => $this->created_at,
            'updatedAt' => $this->updated_at
        ];
    }
}
