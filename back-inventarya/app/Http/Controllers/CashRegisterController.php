<?php
namespace App\Http\Controllers;

use App\Http\Requests\CashRegisterRequest;
use App\Models\{Assignment, CashRegisterSession, Store};
use App\Services\CashRegisterService;
use Illuminate\Http\Request;

class CashRegisterController extends Controller
{
    public function __construct(private CashRegisterService $service) {}
    public function open(CashRegisterRequest $request) { return response()->json(['session' => $this->service->open($request->user(), $request->validated())], 201); }
    public function active(Request $request, string $store)
    {
        Store::findOrFail($store);
        $this->service->authorize($request->user(), $store);
        $session = $this->service->active($store);
        return response()->json(['has_open_session' => $session !== null, 'session' => $session]);
    }
    public function movement(CashRegisterRequest $request, string $session) { return response()->json(['movement' => $this->service->addMovement($request->user(), $session, $request->validated())], 201); }
    public function summary(Request $request, string $session)
    {
        $model = CashRegisterSession::findOrFail($session);
        $this->service->authorize($request->user(), $model->store_id);
        return response()->json($this->service->summary($model));
    }
    public function close(CashRegisterRequest $request, string $session) { return response()->json(['session' => $this->service->close($request->user(), $session, $request->validated())]); }
    public function history(CashRegisterRequest $request)
    {
        $filters = $request->validated();
        $query = CashRegisterSession::with(['store:id,name', 'user:id,name', 'closedBy:id,name'])->withCount('sales')->withSum(['sales' => fn ($q) => $q->whereIn('status', CashRegisterService::COMPLETED)], 'total');
        if (!$request->user()->can('stores:view-all')) $query->whereIn('store_id', Assignment::where('user_id', $request->user()->id)->select('store_id'));
        foreach (['store_id', 'user_id', 'status'] as $field) if (!empty($filters[$field])) $query->where($field, $filters[$field]);
        if (!empty($filters['from_date'])) $query->whereDate('opened_at', '>=', $filters['from_date']);
        if (!empty($filters['to_date'])) $query->whereDate('opened_at', '<=', $filters['to_date']);
        return response()->json($query->orderByDesc('opened_at')->paginate(20));
    }
}
