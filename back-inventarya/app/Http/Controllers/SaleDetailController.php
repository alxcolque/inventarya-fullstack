<?php

namespace App\Http\Controllers;

use App\Models\SaleDetail;
use App\Models\Sale;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class SaleDetailController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $saleDetails = SaleDetail::all();
        return response()->json($saleDetails);
    }
    /* 
     * Get detail sales by sale id
     */
    public function getSaleDetailsBySaleId($saleId)
    {
        $sale = Sale::with(['user', 'customer'])->find($saleId);
        if (!$sale) {
            return response()->json(['message' => 'La venta no existe'], 404);
        }

        $saleArray = $sale->toArray();
        if (empty($sale->customer_id) || $sale->customer_id == 0 || empty($saleArray['customer'])) {
            $customerName = $sale->name;
            $saleArray['customer'] = [
                'id' => 0,
                'name' => $customerName,
                'phone' => $sale->phone,
            ];
            $saleArray['name'] = $customerName;
        } else {
            $customerName = $sale->customer ? $sale->customer->name : ($sale->name);
            $saleArray['customer'] = [
                'id' => $sale->customer->id,
                'name' => $customerName,
                'phone' => $sale->customer->phone ?? $sale->phone,
            ];
            $saleArray['name'] = $customerName;
        }

        $saleArray['seller'] = $sale->user ? $sale->user->name : 'Personal de Ventas';
        $saleArray['date'] = Carbon::parse($sale->created_at)->diffForHumans();

        $saleDetails = SaleDetail::with('product')->where('sale_id', $saleId)->get();
        $saleDetailsCurrent = $saleDetails->map(function ($saleDetail) {
            $product = $saleDetail->product;
            $saleDetail['product'] = [
                'id' => $product?->id,
                'name' => $product?->name ?? 'Producto',
                'sku' => $product?->sku,
                'thumbnail' => $product?->thumbnail,
            ];
            $saleDetail['product_name'] = $product?->name ?? 'Producto';
            return $saleDetail;
        });

        return response()->json(
            [
                'sale' => $saleArray,
                'detailSales' => $saleDetailsCurrent,
                'saleDetails' => $saleDetailsCurrent,
            ],
            200
        );
    }

    public function getDetailSalesBySaleId($saleId)
    {
        return $this->getSaleDetailsBySaleId($saleId);
    }
    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $saleId = $request->input('sale_id');
        if ($saleId) {
            $sale = Sale::find($saleId);
            if ($sale && $sale->isFinalized()) {
                throw ValidationException::withMessages([
                    'sale_detail' => 'No es posible agregar ítems a una venta finalizada.',
                ]);
            }
        }

        $data = $request->all();
        $saleDetail = SaleDetail::create($data);
        return response()->json([
            'message' => 'Detalle de venta creado correctamente',
            //'saleDetail' => $saleDetail
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(SaleDetail $saleDetail)
    {
        $saleDetail = SaleDetail::find($saleDetail->id);
        return response()->json($saleDetail);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $saleDetail)
    {
        $detail = $saleDetail instanceof SaleDetail ? $saleDetail : SaleDetail::find($saleDetail);
        if (!$detail) {
            return response()->json(['message' => 'Detalle no encontrado'], 404);
        }

        $sale = $detail->sale ?? Sale::find($detail->sale_id);
        if ($sale && $sale->isFinalized()) {
            throw ValidationException::withMessages([
                'sale_detail' => 'No es posible modificar ítems de una venta finalizada.',
            ]);
        }

        $data = $request->all();
        $detail->update($data);
        return response()->json([
            'message' => 'Detalle de venta actualizado correctamente',
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($saleDetail)
    {
        $detail = $saleDetail instanceof SaleDetail ? $saleDetail : SaleDetail::find($saleDetail);
        if (!$detail) {
            return response()->json(['message' => 'Detalle no encontrado'], 404);
        }

        $sale = $detail->sale ?? Sale::find($detail->sale_id);
        if ($sale && $sale->isFinalized()) {
            throw ValidationException::withMessages([
                'sale_detail' => 'No es posible eliminar ítems de una venta finalizada.',
            ]);
        }

        $detail->delete();
        return response()->json([
            'message' => 'Detalle de venta eliminado correctamente',
        ], 200);
    }
}
