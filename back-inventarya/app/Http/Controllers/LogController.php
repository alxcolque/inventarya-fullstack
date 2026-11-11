<?php

namespace App\Http\Controllers\Log;

use App\Http\Controllers\Controller;
use App\Http\Requests\Log\LogsRequest;
use App\Models\Log;
use Illuminate\Http\Request;
use App\Http\Resources\Log\LogCollection;
use App\Http\Resources\Log\LogResource;

class LogController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $logs = Log::all();

        return response()->json([
            'logs' => new LogCollection($logs)
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(LogsRequest $request)
    {
        $log = $request->validated();

        $log = Log::create($log);

        return response()->json([
            'message'=>'Logs creado correctamente',
            'log' => new LogResource($log)
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $log = Log::whereId($id)->first();

        if(!$log)
        {
            return response()->json([
                'message'=>'No se encontro el registro en la Bitacora'
            ],404);
        }

        return new LogResource($log);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        //
    }
}
