<?php

namespace App\Http\Controllers;

use App\Models\Carousel;
use App\Rules\PublicImage;
use App\Services\FileStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CarouselController extends Controller
{
    /**
     * List all carousel slides ordered by display_order.
     */
    public function index(): JsonResponse
    {
        $carousels = Carousel::orderBy('display_order')->orderBy('id')->get();

        return response()->json($carousels);
    }

    /**
     * Create a new carousel slide.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title'        => 'required|string|max:64',
            'description'  => 'nullable|string|max:255',
            'link'         => 'nullable|url|max:150',
            'visible_btn'  => 'boolean',
            'title_btn'    => 'nullable|string|max:32',
            'color_btn'    => 'nullable|string|max:64',
            'position_btn' => 'nullable|in:left,center,right',
            'display_order'=> 'nullable|integer|min:0',
            'status'       => 'nullable|in:active,inactive',
            'image_file'   => ['nullable', new PublicImage(5120, false, false)],
        ]);

        unset($validated['image_file']);
        $validated['status'] = $validated['status'] ?? 'active';

        if ($request->hasFile('image_file')) {
            $upload = FileStorageService::upload($request->file('image_file'), 'carousels');
            $validated['image']     = $upload['path'];
            $validated['image_key'] = $upload['key'];
        }

        $carousel = Carousel::create($validated);

        return response()->json([
            'message'  => 'Slide creado exitosamente.',
            'carousel' => $carousel->fresh(),
        ], 201);
    }

    /**
     * Update an existing carousel slide.
     */
    public function update(Request $request, Carousel $carousel): JsonResponse
    {
        $oldImage = $carousel->getRawOriginal('image');

        $validated = $request->validate([
            'title'        => 'sometimes|required|string|max:64',
            'description'  => 'nullable|string|max:255',
            'link'         => 'nullable|url|max:150',
            'visible_btn'  => 'boolean',
            'title_btn'    => 'nullable|string|max:32',
            'color_btn'    => 'nullable|string|max:64',
            'position_btn' => 'nullable|in:left,center,right',
            'display_order'=> 'nullable|integer|min:0',
            'status'       => 'nullable|in:active,inactive',
            'image_file'   => ['nullable', new PublicImage(5120, false, false)],
        ]);

        unset($validated['image_file']);
        $newImagePath = null;

        try {
            if ($request->hasFile('image_file')) {
                $upload = FileStorageService::upload($request->file('image_file'), 'carousels');
                $validated['image']     = $newImagePath = $upload['path'];
                $validated['image_key'] = $upload['key'];
            }

            $carousel->update($validated);
        } catch (\Throwable $e) {
            if ($newImagePath) {
                FileStorageService::delete($newImagePath);
            }
            throw $e;
        }

        // Delete old image if replaced
        if ($newImagePath && $oldImage && !FileStorageService::referencesMatch($oldImage, $newImagePath)) {
            FileStorageService::delete($oldImage);
        }

        return response()->json([
            'message'  => 'Slide actualizado exitosamente.',
            'carousel' => $carousel->fresh(),
        ]);
    }

    /**
     * Delete a carousel slide and its associated image.
     */
    public function destroy(Carousel $carousel): JsonResponse
    {
        $imagePath = $carousel->getRawOriginal('image');

        $carousel->delete();

        if ($imagePath) {
            FileStorageService::delete($imagePath);
        }

        return response()->json(['message' => 'Slide eliminado exitosamente.']);
    }

    /**
     * Bulk-update display_order for all slides.
     * Payload: [{ id: 1, display_order: 0 }, ...]
     */
    public function reorder(Request $request): JsonResponse
    {
        $request->validate([
            'items'                 => 'required|array',
            'items.*.id'            => 'required|integer|exists:carousels,id',
            'items.*.display_order' => 'required|integer|min:0',
        ]);

        foreach ($request->input('items') as $item) {
            Carousel::where('id', $item['id'])->update(['display_order' => $item['display_order']]);
        }

        return response()->json(['message' => 'Orden actualizado exitosamente.']);
    }
}
