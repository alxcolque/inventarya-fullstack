<?php
namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CashRegisterRequest extends FormRequest
{
    public function authorize(): bool { return $this->user()?->can('pos:access') ?? false; }
    public function rules(): array
    {
        $money = ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999999.99'];
        return match ($this->route()->getActionMethod()) {
            'open' => ['store_id' => ['required', 'uuid', 'exists:stores,id'], 'opening_amount' => $money, 'opening_note' => ['nullable', 'string', 'max:2000']],
            'movement' => ['type' => ['required', Rule::in(['income', 'expense'])], 'amount' => [...$money, 'gt:0'], 'reason' => ['required', 'string', 'max:255'], 'description' => ['nullable', 'string', 'max:2000']],
            'close' => ['closing_amount' => $money, 'closing_note' => ['nullable', 'string', 'max:2000']],
            default => ['store_id' => ['nullable', 'uuid', 'exists:stores,id'], 'from_date' => ['nullable', 'date_format:Y-m-d'], 'to_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from_date'], 'user_id' => ['nullable', 'integer', 'exists:users,id'], 'status' => ['nullable', Rule::in(['open', 'closed'])], 'page' => ['nullable', 'integer', 'min:1']],
        };
    }
}
