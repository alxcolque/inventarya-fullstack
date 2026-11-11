<?php

namespace App\Http\Controllers;

use App\Http\Requests\CustomerRequest;
use App\Models\Customer;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $customers = Customer::latest()->get();
        return response()->json($customers);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(CustomerRequest $request)
    {
        $data = $request->validated();
        $customer = Customer::create($data);
        return response()->json([
            'message' => 'Cliente creado correctamente',
            'customer' => $customer
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $customer = Customer::find($id);
        if (!$customer) {
            return response()->json(['message' => 'Cliente no encontrado'], 404);
        }
        return response()->json($customer);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(CustomerRequest $request, $id)
    {
        $data = $request->validated();
        $customer = Customer::find($id);
        if (!$customer) {
            return response()->json(['message' => 'Cliente no encontrado'], 404);
        }
        $customer->update($data);
        return response()->json([
            'message' => 'Cliente actualizado correctamente',
            'customer' => $customer
        ], 200);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $customer = Customer::find($id);
        if (!$customer) {
            return response()->json(['message' => 'Cliente no encontrado'], 404);
        }
        $customer->delete();
        return response()->json([
            'message' => 'Cliente eliminado correctamente',
        ], 200);
    }
}
