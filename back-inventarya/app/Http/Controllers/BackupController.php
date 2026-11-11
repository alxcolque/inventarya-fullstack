<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Storage;

class BackupController extends Controller
{
    public function download()
    {
        abort_unless(config('backup.download_enabled'), 404);

        // Crea backup en tiempo real
        Artisan::call('backup:run --only-db');

        // Encuentra el archivo más reciente
        $backupPath = collect(Storage::disk('local')->files('Laravel'))->last();

        if (! $backupPath) {
            return response()->json(['message' => 'No se encontró ningún archivo de respaldo.'], 404);
        }

        $fileContent = Storage::disk('local')->get($backupPath);
        $filename = basename($backupPath);

        return response($fileContent, 200)
            ->header('Content-Type', 'application/octet-stream')
            ->header('Content-Disposition', "attachment; filename={$filename}");
    }
}
