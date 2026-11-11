<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashRegisterMovement extends Model
{
    use HasUuids;
    protected $fillable = ['cash_register_session_id', 'sale_refund_id', 'user_id', 'type', 'amount', 'reason', 'description'];
    protected $casts = ['amount' => 'decimal:2'];
    public function session(): BelongsTo { return $this->belongsTo(CashRegisterSession::class, 'cash_register_session_id'); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
    public function saleRefund(): BelongsTo { return $this->belongsTo(SaleRefund::class, 'sale_refund_id'); }
    public function refund(): BelongsTo { return $this->saleRefund(); }
}
