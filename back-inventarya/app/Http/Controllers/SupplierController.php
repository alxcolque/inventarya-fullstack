<?php

namespace App\Http\Controllers;

use App\Http\Requests\SupplierRequest;
use App\Models\Supplier;
use Illuminate\Http\Request;

class SupplierController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $suppliers = Supplier::all();
        return response()->json($suppliers);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(SupplierRequest $request)
    {
        $data = $request->validated();
        $supplier = Supplier::create($data);
        return response()->json([
            'message' => 'Proveedor creado correctamente',
            //'supplier' => $supplier
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $supplier = Supplier::find($id);
        return response()->json($supplier);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(SupplierRequest $request, $id)
    {
        $data = $request->validated();
        $supplier = Supplier::find($id);
        $supplier->update($data);
        return response()->json([
            'message' => 'Proveedor actualizado correctamente',
            //'supplier' => $supplier
        ], 201);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $supplier = Supplier::find($id);
        $supplier->delete();
        return response()->json([
            'message' => 'Proveedor eliminado correctamente',
            //'supplier' => $supplier
        ], 201);
    }
}
