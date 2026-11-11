<?php

namespace App\Http\Controllers;

use App\Models\Configuration;
use App\Rules\PublicImage;
use App\Services\FileStorageService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConfigurationController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(Configuration::current());
    }

    public function update(Request $request): JsonResponse
    {
        $config = Configuration::current();
        $oldLogo = $config->getRawOriginal('logo');
        $oldFavicon = $config->getRawOriginal('favicon');
        $newPaths = [];

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:100',
            'privacy' => 'nullable|string',
            'terms' => 'nullable|string',
            'about_us' => 'nullable|string',
            'logo' => 'nullable|string',
            'favicon' => 'nullable|string',
            'logo_file' => ['nullable', new PublicImage(2048, false, false)],
            'favicon_file' => ['nullable', new PublicImage(1024, false, false)],
        ]);
        unset($validated['logo_file'], $validated['favicon_file']);

        try {
            if ($request->hasFile('logo_file')) {
                $upload = FileStorageService::upload($request->file('logo_file'), 'configurations');
                $validated['logo'] = $newPaths['logo'] = $upload['path'];
            } elseif (! empty($validated['logo']) && FileStorageService::isManagedReference($validated['logo'])) {
                $validated['logo'] = FileStorageService::normalizePath($validated['logo']);
            }

            if ($request->hasFile('favicon_file')) {
                $upload = FileStorageService::upload($request->file('favicon_file'), 'configurations');
                $validated['favicon'] = $newPaths['favicon'] = $upload['path'];
            } elseif (! empty($validated['favicon']) && FileStorageService::isManagedReference($validated['favicon'])) {
                $validated['favicon'] = FileStorageService::normalizePath($validated['favicon']);
            }

            $config->update($validated);
        } catch (\Throwable $exception) {
            foreach ($newPaths as $path) {
                FileStorageService::delete($path);
            }
            throw $exception;
        }

        if (array_key_exists('logo', $validated) && $oldLogo
            && ! FileStorageService::referencesMatch($oldLogo, $validated['logo'])) {
            FileStorageService::delete($oldLogo);
        }
        if (array_key_exists('favicon', $validated) && $oldFavicon
            && ! FileStorageService::referencesMatch($oldFavicon, $validated['favicon'])) {
            FileStorageService::delete($oldFavicon);
        }

        return response()->json([
            'message' => 'Configuración actualizada con éxito',
            'configuration' => $config->fresh(),
        ]);
    }
}
