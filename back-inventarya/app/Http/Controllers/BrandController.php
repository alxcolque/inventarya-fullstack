<?php

namespace App\Http\Controllers;

use App\Http\Requests\BrandRequest;
use App\Models\Brand;
use App\Services\FileStorageService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class BrandController extends Controller
{
    const FOLDER_PATH = 'inventory/brands';

    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $brands = Brand::orderBy('name', 'asc')->get();

        return response()->json($brands);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(BrandRequest $request)
    {
        $data = $request->validated();
        $data['name'] = mb_strtoupper(trim($data['name']), 'UTF-8');
        $newPath = null;

        if (array_key_exists('image', $data) && FileStorageService::isNewUpload($data['image'])) {
            try {
                $upload = FileStorageService::upload($data['image'], self::FOLDER_PATH);
                $newPath = $upload['path'];
                $data['image'] = $newPath;
                $data['image_key'] = $newPath;
            } catch (\Throwable $exception) {
                return response()->json(['message' => 'No se pudo subir la imagen: '.$exception->getMessage()], 422);
            }
        } elseif (! empty($data['image']) && FileStorageService::isManagedReference($data['image'])) {
            $data['image'] = FileStorageService::normalizePath($data['image']);
            $data['image_key'] = $data['image'];
        }

        $slug = Str::slug($data['name']);
        $exist = Brand::where('slug', $slug)->first();
        if ($exist) {
            $slug .= '-'.$exist->id;
        }
        $data['slug'] = $slug;

        try {
            Brand::create($data);
        } catch (\Throwable $exception) {
            if ($newPath) {
                FileStorageService::delete($newPath);
            }
            throw $exception;
        }

        return response()->json(['message' => 'Marca creada correctamente'], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $brand = Brand::find($id);

        return response()->json($brand);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(BrandRequest $request, $id)
    {
        $data = $request->validated();
        $data['name'] = mb_strtoupper(trim($data['name']), 'UTF-8');
        $brand = Brand::findOrFail($id);
        $oldPath = $brand->image_key ?: $brand->getRawOriginal('image');
        $newPath = null;
        $replaceImage = false;

        if (array_key_exists('image', $data)) {
            $image = $data['image'];
            unset($data['image']);

            if ($image === null || $image === 'delete') {
                $data['image'] = null;
                $data['image_key'] = null;
                $replaceImage = true;
            } elseif (FileStorageService::isNewUpload($image)) {
                try {
                    $upload = FileStorageService::upload($image, self::FOLDER_PATH);
                    $newPath = $upload['path'];
                    $data['image'] = $newPath;
                    $data['image_key'] = $newPath;
                    $replaceImage = true;
                } catch (\Throwable $exception) {
                    return response()->json(['message' => 'No se pudo subir la imagen: '.$exception->getMessage()], 422);
                }
            } elseif (FileStorageService::isManagedReference($image)
                && ! FileStorageService::referencesMatch($image, $oldPath)) {
                $data['image'] = FileStorageService::normalizePath($image);
                $data['image_key'] = $data['image'];
                $replaceImage = true;
            } elseif (filter_var($image, FILTER_VALIDATE_URL) && $image !== $brand->image) {
                $data['image'] = $image;
                $data['image_key'] = null;
                $replaceImage = true;
            }
        }

        $slug = Str::slug($data['name']);
        $exist = Brand::where('slug', $slug)->where('id', '<>', $brand->id)->first();
        $data['slug'] = $exist ? $slug.'-'.$exist->id : $slug;

        try {
            $brand->update($data);
        } catch (\Throwable $exception) {
            if ($newPath) {
                FileStorageService::delete($newPath);
            }
            throw $exception;
        }

        if ($replaceImage && $oldPath && ! FileStorageService::referencesMatch($oldPath, $newPath)) {
            FileStorageService::delete($oldPath);
        }

        return response()->json(['message' => 'Marca actualizada correctamente'], 201);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $brand = Brand::find($id);
        if ($brand) {
            if ($brand->image) {
                FileStorageService::delete($brand->getRawOriginal('image'), $brand->image_key);
            }
            $brand->delete();
        }

        return response()->json([
            'message' => 'Marca eliminada correctamente',
        ], 201);
    }

    /**
     * Remove all brands from storage.
     */
    public function destroyAll(): \Illuminate\Http\JsonResponse
    {
        $connection = (new Brand)->getConnection();
        return $connection->transaction(function () use ($connection) {
            // Desvincular productos asociados poniendo brand_id en null
            $connection->table('products')->whereNotNull('brand_id')->update(['brand_id' => null]);

            // Eliminar archivos de imágenes de las marcas
            $brandsWithImages = Brand::whereNotNull('image')->orWhereNotNull('image_key')->get();
            foreach ($brandsWithImages as $brand) {
                try {
                    FileStorageService::delete($brand->getRawOriginal('image'), $brand->image_key);
                } catch (\Throwable $e) {
                    // Silently continue deleting DB records
                }
            }

            $deletedCount = $connection->table('brands')->delete();

            return response()->json([
                'message' => "Se eliminaron {$deletedCount} marcas correctamente",
                'deleted_count' => $deletedCount,
            ], 200);
        });
    }

    /**
     * Descargar plantilla Excel/CSV para importación de marcas (solo columna NOMBRE).
     */
    public function downloadTemplate(Request $request)
    {
        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Plantilla Marcas');

        // Solo columna NOMBRE
        $sheet->setCellValue('A1', 'NOMBRE');

        // Estilo de encabezado
        $headerStyle = [
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 11,
            ],
            'fill' => [
                'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                'startColor' => ['rgb' => '1E293B'],
            ],
            'alignment' => [
                'horizontal' => \PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER,
                'vertical' => \PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER,
            ],
        ];
        $sheet->getStyle('A1')->applyFromArray($headerStyle);
        $sheet->getRowDimension(1)->setRowHeight(26);

        // Filas de ejemplo en mayúsculas
        $samples = [
            'NIKE',
            'SAMSUNG',
            'SONY',
            'ADIDAS',
            'APPLE',
            'LG',
        ];

        $rowNum = 2;
        foreach ($samples as $sample) {
            $sheet->setCellValue('A' . $rowNum, $sample);
            $sheet->getRowDimension($rowNum)->setRowHeight(20);
            $rowNum++;
        }

        $sheet->getColumnDimension('A')->setWidth(35);

        $format = strtolower($request->query('format', 'xlsx'));

        if ($format === 'csv') {
            $writer = new \PhpOffice\PhpSpreadsheet\Writer\Csv($spreadsheet);
            $filename = 'plantilla_marcas.csv';
            $contentType = 'text/csv';
        } else {
            $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
            $filename = 'plantilla_marcas.xlsx';
            $contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        }

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => $contentType,
            'Cache-Control' => 'max-age=0, no-cache, must-revalidate, proxy-revalidate',
        ]);
    }

    /**
     * Exportar todas las marcas a Excel o CSV.
     */
    public function export(Request $request)
    {
        $brands = Brand::orderBy('name', 'asc')->get();

        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Marcas');

        // Encabezados
        $sheet->setCellValue('A1', 'ID');
        $sheet->setCellValue('B1', 'NOMBRE');
        $sheet->setCellValue('C1', 'SLUG');
        $sheet->setCellValue('D1', 'TIENE_IMAGEN');
        $sheet->setCellValue('E1', 'FECHA_REGISTRO');

        $headerStyle = [
            'font' => [
                'bold' => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size' => 11,
            ],
            'fill' => [
                'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                'startColor' => ['rgb' => '0F766E'], // Teal 700
            ],
            'alignment' => [
                'horizontal' => \PhpOffice\PhpSpreadsheet\Style\Alignment::HORIZONTAL_CENTER,
                'vertical' => \PhpOffice\PhpSpreadsheet\Style\Alignment::VERTICAL_CENTER,
            ],
        ];
        $sheet->getStyle('A1:E1')->applyFromArray($headerStyle);
        $sheet->getRowDimension(1)->setRowHeight(26);

        $rowNum = 2;
        foreach ($brands as $brand) {
            $sheet->setCellValue('A' . $rowNum, $brand->id);
            $sheet->setCellValue('B' . $rowNum, $brand->name);
            $sheet->setCellValue('C' . $rowNum, $brand->slug);
            $sheet->setCellValue('D' . $rowNum, $brand->image ? 'SÍ' : 'NO');
            $sheet->setCellValue('E' . $rowNum, $brand->created_at ? $brand->created_at->format('Y-m-d H:i') : '');
            $sheet->getRowDimension($rowNum)->setRowHeight(20);
            $rowNum++;
        }

        $sheet->getColumnDimension('A')->setWidth(10);
        $sheet->getColumnDimension('B')->setWidth(30);
        $sheet->getColumnDimension('C')->setWidth(30);
        $sheet->getColumnDimension('D')->setWidth(16);
        $sheet->getColumnDimension('E')->setWidth(20);

        $format = strtolower($request->query('format', 'xlsx'));

        if ($format === 'csv') {
            $writer = new \PhpOffice\PhpSpreadsheet\Writer\Csv($spreadsheet);
            $filename = 'marcas_' . date('Ymd_His') . '.csv';
            $contentType = 'text/csv';
        } else {
            $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
            $filename = 'marcas_' . date('Ymd_His') . '.xlsx';
            $contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        }

        return response()->streamDownload(function () use ($writer) {
            $writer->save('php://output');
        }, $filename, [
            'Content-Type' => $contentType,
            'Cache-Control' => 'max-age=0, no-cache, must-revalidate, proxy-revalidate',
        ]);
    }

    /**
     * Importar marcas desde archivo Excel (.xlsx, .xls) o CSV con validación estricta e informe.
     */
    public function import(Request $request)
    {
        // 1. Validación estricta del archivo: máximo 1MB (1024KB) y solo extensiones Excel o CSV
        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'file' => [
                'required',
                'file',
                'max:1024', // 1MB en KB
                function ($attribute, $value, $fail) {
                    $ext = strtolower($value->getClientOriginalExtension());
                    if (!in_array($ext, ['xlsx', 'xls', 'csv'])) {
                        $fail('El archivo debe ser un formato válido de Excel (.xlsx, .xls) o archivo separado por comas (.csv).');
                    }
                },
            ],
        ], [
            'file.required' => 'Debes adjuntar un archivo para importar.',
            'file.file' => 'El archivo subido no es válido.',
            'file.max' => 'El archivo no debe superar 1MB de tamaño.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $file = $request->file('file');
        $realPath = $file->getRealPath();

        try {
            // Cargar archivo con PhpSpreadsheet
            $spreadsheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($realPath);
            $sheet = $spreadsheet->getActiveSheet();
            $highestRow = $sheet->getHighestDataRow();
            $highestCol = $sheet->getHighestDataColumn();
            $highestColIndex = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($highestCol);

            // Verificar que tenga contenido
            if ($highestRow < 2) {
                return response()->json([
                    'message' => 'El archivo no contiene filas de datos para importar. Por favor usa la plantilla oficial.',
                ], 422);
            }

            // 2. Validación estricta de encabezados
            $headerColIndex = null;
            for ($col = 1; $col <= $highestColIndex; $col++) {
                $val = trim((string)$sheet->getCell([$col, 1])->getValue());
                $normalized = strtolower(iconv('UTF-8', 'ASCII//TRANSLIT', $val));
                $normalized = preg_replace('/[^a-z]/', '', $normalized);

                if (in_array($normalized, ['nombre', 'name', 'marca', 'marcas', 'brand', 'brands'])) {
                    $headerColIndex = $col;
                    break;
                }
            }

            if ($headerColIndex === null) {
                return response()->json([
                    'message' => 'El archivo no cumple con la regla de importación. Falta la columna obligatoria "NOMBRE" o "MARCA". Descarga la plantilla para ver el formato requerido.',
                ], 422);
            }

            // 3. Procesar fila por fila con validación estricta
            $importedCount = 0;
            $notImportedCount = 0;
            $errors = [];
            $importedList = [];

            // Conjunto en memoria de marcas existentes en DB (en mayúsculas para comparación estricta)
            $existingDbNames = Brand::pluck('name')->map(function ($name) {
                return mb_strtoupper(trim($name), 'UTF-8');
            })->flip()->toArray();

            $seenInFile = [];

            for ($row = 2; $row <= $highestRow; $row++) {
                // Leer valor de la celda de nombre
                $cellValue = $sheet->getCell([$headerColIndex, $row])->getValue();
                $name = trim((string)$cellValue);

                // Si toda la fila está vacía, la ignoramos silenciosamente
                if ($name === '') {
                    $hasAnyData = false;
                    for ($c = 1; $c <= min($highestColIndex, 5); $c++) {
                        if (trim((string)$sheet->getCell([$c, $row])->getValue()) !== '') {
                            $hasAnyData = true;
                            break;
                        }
                    }
                    if (!$hasAnyData) {
                        continue; // Fila vacía al final del archivo
                    }

                    $notImportedCount++;
                    $errors[] = [
                        'fila' => $row,
                        'nombre' => '(Vacío)',
                        'motivo' => 'El nombre de la marca es obligatorio en esta fila.',
                    ];

                    continue;
                }

                // Longitud máxima
                if (mb_strlen($name, 'UTF-8') > 255) {
                    $notImportedCount++;
                    $errors[] = [
                        'fila' => $row,
                        'nombre' => mb_substr($name, 0, 30).'...',
                        'motivo' => 'El nombre excede el límite máximo de 255 caracteres.',
                    ];

                    continue;
                }

                // 1. Convertir a MAYÚSCULAS antes de validar y registrar
                $nameUpper = mb_strtoupper($name, 'UTF-8');

                // 2. Verificar duplicados en el mismo archivo: Si existe, omitir y continuar
                if (isset($seenInFile[$nameUpper])) {
                    $notImportedCount++;
                    $errors[] = [
                        'fila' => $row,
                        'nombre' => $nameUpper,
                        'motivo' => 'Marca duplicada en el archivo (omitida).',
                    ];

                    continue; // Omitir y seguir continuando hasta importar todo
                }
                $seenInFile[$nameUpper] = $row;

                // 3. Verificar duplicados en la base de datos: Si existe, omitir y continuar
                if (isset($existingDbNames[$nameUpper])) {
                    $notImportedCount++;
                    $errors[] = [
                        'fila' => $row,
                        'nombre' => $nameUpper,
                        'motivo' => "La marca '{$nameUpper}' ya existe en el sistema (omitida).",
                    ];

                    continue; // Omitir y seguir continuando hasta importar todo
                }

                // 4. Generar slug solo al momento de registrar en la base de datos
                $slug = Str::slug($nameUpper);
                $existSlug = Brand::where('slug', $slug)->first();
                if ($existSlug) {
                    $slug = $slug . '-' . time() . '-' . rand(10, 99);
                }

                // 5. Registrar en la base de datos en mayúsculas
                $brand = Brand::create([
                    'name' => $nameUpper,
                    'slug' => $slug,
                ]);

                // Registrar en memoria para evitar colisiones con filas posteriores
                $existingDbNames[$nameUpper] = true;
                $importedCount++;
                $importedList[] = [
                    'id' => $brand->id,
                    'fila' => $row,
                    'nombre' => $brand->name,
                    'slug' => $brand->slug,
                ];
            }

            $totalProcessed = $importedCount + $notImportedCount;

            return response()->json([
                'success' => true,
                'message' => $importedCount > 0
                    ? "Importación completada: {$importedCount} marcas importadas exitosamente."
                    : 'Proceso completado: 0 marcas importadas.',
                'resumen' => [
                    'total_filas' => $totalProcessed,
                    'importados' => $importedCount,
                    'no_importados' => $notImportedCount,
                ],
                'errores' => $errors,
                'importados_lista' => $importedList,
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error al procesar el archivo: ' . $e->getMessage(),
            ], 500);
        }
    }
}
