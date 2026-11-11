<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CashRegisterSession extends Model
{
    use HasUuids;
    protected $fillable = ['store_id', 'user_id', 'closed_by', 'opening_amount', 'expected_amount', 'closing_amount', 'difference', 'status', 'opened_at', 'closed_at', 'opening_note', 'closing_note'];
    protected $casts = ['opening_amount' => 'decimal:2', 'expected_amount' => 'decimal:2', 'closing_amount' => 'decimal:2', 'difference' => 'decimal:2', 'opened_at' => 'datetime', 'closed_at' => 'datetime'];
    public function store(): BelongsTo { return $this->belongsTo(Store::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function closedBy(): BelongsTo { return $this->belongsTo(User::class, 'closed_by'); }
    public function movements(): HasMany { return $this->hasMany(CashRegisterMovement::class); }
    public function sales(): HasMany { return $this->hasMany(Sale::class); }
}
