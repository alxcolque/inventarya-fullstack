<?php

namespace App\Services;

use App\Models\Category;
use Illuminate\Validation\ValidationException;

class CategoryHierarchyService
{
    /** All category writes share row locks, including creation under a parent. */
    public function save(array $data, ?int $id = null): Category
    {
        $connection = (new Category)->getConnection();

        return $connection->transaction(function () use ($data, $id) {
            $parentId = isset($data['parent_id']) ? (int) $data['parent_id'] : null;
            $ids = array_filter([$id, $parentId]);
            $locked = Category::whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $category = $id === null ? new Category : $locked->get($id);
            abort_if($category === null, 404, 'Categoría no encontrada');

            if ($id === null || array_key_exists('parent_id', $data)) {
                if ($parentId !== null) {
                    if ($parentId === $id) {
                        $this->reject('Una categoría no puede ser padre de sí misma.');
                    }
                    $parent = $locked->get($parentId);
                    if (!$parent) {
                        $this->reject('La categoría superior seleccionada no existe.');
                    }
                    if ($id !== null) {
                        $checkId = $parentId;
                        while ($checkId !== null) {
                            if ((int) $checkId === (int) $id) {
                                $this->reject('No puedes mover una categoría dentro de sí misma o de una de sus subcategorías.');
                            }
                            $checkCategory = Category::find($checkId);
                            $checkId = $checkCategory?->parent_id;
                        }
                    }
                }
            }

            $category->fill($data);
            if (empty($category->color)) {
                $category->color = Category::randomLightColor();
            }
            if ($category->isDirty()) {
                // A hierarchy-only PATCH changes no other column, including timestamps.
                if ($id !== null && array_keys($data) === ['parent_id']) {
                    $category->timestamps = false;
                }
                $category->save();
                $category->timestamps = true;
            }
            return $category;
        }, 3);
    }

    private function reject(string $message): never
    {
        throw ValidationException::withMessages(['parent_id' => $message]);
    }
}
