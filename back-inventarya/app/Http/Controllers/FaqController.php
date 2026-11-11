<?php

namespace App\Http\Controllers;

use App\Models\Faq;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FaqController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Faq::ordered()->get());
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'question' => 'required|string|max:255',
            'answer' => 'required|string',
            'category' => 'nullable|string|max:100',
            'sort_order' => 'nullable|integer',
            'is_published' => 'nullable|boolean',
        ]);

        $faq = Faq::create($validated);
        return response()->json(['message' => 'Pregunta frecuente creada con éxito', 'faq' => $faq], 201);
    }

    public function show(int $id): JsonResponse
    {
        $faq = Faq::find($id);
        if (!$faq) {
            return response()->json(['message' => 'Pregunta frecuente no encontrada'], 404);
        }
        return response()->json($faq);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $faq = Faq::find($id);
        if (!$faq) {
            return response()->json(['message' => 'Pregunta frecuente no encontrada'], 404);
        }

        $validated = $request->validate([
            'question' => 'sometimes|required|string|max:255',
            'answer' => 'sometimes|required|string',
            'category' => 'nullable|string|max:100',
            'sort_order' => 'nullable|integer',
            'is_published' => 'nullable|boolean',
        ]);

        $faq->update($validated);
        return response()->json(['message' => 'Pregunta frecuente actualizada', 'faq' => $faq]);
    }

    public function destroy(int $id): JsonResponse
    {
        $faq = Faq::find($id);
        if (!$faq) {
            return response()->json(['message' => 'Pregunta frecuente no encontrada'], 404);
        }

        $faq->delete();
        return response()->json(['message' => 'Pregunta frecuente eliminada con éxito']);
    }
}
