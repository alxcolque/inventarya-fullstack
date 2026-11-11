<?php

namespace App\Http\Controllers;

use App\Http\Requests\ProductImageRequest;
use App\Models\ProductImage;
use App\Services\FileStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class ProductImageController extends Controller
{
    /**
     * Display a listing of images for a given product.
     */
    public function index($product_id): JsonResponse
    {
        if (!Str::isUuid((string) $product_id)) {
            return response()->json([]);
        }

        $productImages = ProductImage::where('product_id', $product_id)
            ->orderBy('id', 'asc')
            ->get();

        return response()->json($productImages);
    }

    /**
     * Store a newly created image in storage.
     */
    public function store(ProductImageRequest $request): JsonResponse
    {
        $data = $request->validated();
        $newImagePath = null;

        if (! empty($request->image)) {
            try {
                $upload = FileStorageService::upload(
                    $request->image,
                    'products/gallery',
                    tenant('id') ?? 'default'
                );
                $newImagePath = $upload['path'];
                $data['image'] = $newImagePath;
                $data['image_key'] = $newImagePath;
            } catch (\Exception $e) {
                return response()->json([
                    'message' => 'Error al subir la imagen: '.$e->getMessage(),
                ], 400);
            }
        }

        try {
            $productImage = ProductImage::create($data);
        } catch (\Throwable $exception) {
            if ($newImagePath) {
                FileStorageService::delete($newImagePath);
            }
            throw $exception;
        }

        return response()->json([
            'message' => 'Imagen añadida correctamente a la galería',
            'productImage' => $productImage,
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id): JsonResponse
    {
        $productImage = ProductImage::find($id);
        if (!$productImage) {
            return response()->json(['message' => 'Imagen no encontrada'], 404);
        }

        return response()->json($productImage);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id): JsonResponse
    {
        $productImage = ProductImage::find($id);
        if (!$productImage) {
            return response()->json(['message' => 'Imagen no encontrada'], 404);
        }

        $rawPath = $productImage->getRawOriginal('image') ?? $productImage->image_key;
        if ($rawPath) {
            FileStorageService::delete($rawPath);
        }

        $productImage->delete();

        return response()->json([
            'message' => 'Imagen eliminada correctamente',
        ], 200);
    }
}
