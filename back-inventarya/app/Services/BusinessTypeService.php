<?php

namespace App\Services;

use App\Models\BusinessType;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BusinessTypeService
{
    public function paginate(?string $search, int $perPage = 15): LengthAwarePaginator
    {
        return BusinessType::query()
            ->withCount(['fields', 'tenants'])
            ->when($search !== null && trim($search) !== '', function ($query) use ($search) {
                $query->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower(trim($search)).'%']);
            })
            ->orderBy('name')
            ->paginate(max(1, min($perPage, 100)));
    }

    /**
     * Active types only: used by the tenant create / edit forms.
     */
    public function activeOptions()
    {
        return BusinessType::query()
            ->active()
            ->orderBy('name')
            ->get(['id', 'name', 'slug']);
    }

    public function find(int $id): ?BusinessType
    {
        return BusinessType::query()->withCount(['fields', 'tenants'])->with('fields')->find($id);
    }

    public function create(array $data): BusinessType
    {
        $data['slug'] = ! empty($data['slug'])
            ? $data['slug']
            : SlugService::generate($data['name'], 'business_types', 'slug');

        return BusinessType::create($data);
    }

    public function update(BusinessType $type, array $data): BusinessType
    {
        $type->update($data);

        return $type;
    }

    public function toggleStatus(BusinessType $type): BusinessType
    {
        $type->update(['is_active' => ! $type->is_active]);

        return $type;
    }

    /**
     * Physical deletion is blocked while tenants depend on the type.
     * The database also enforces it (tenants.business_type_id restrictOnDelete).
     *
     * @throws ValidationException
     */
    public function delete(BusinessType $type): void
    {
        if ($type->tenants()->exists()) {
            throw ValidationException::withMessages([
                'business_type' => 'Este tipo de negocio está asignado a uno o más tenants y no puede eliminarse. Puedes desactivarlo en su lugar.',
            ]);
        }

        DB::connection($type->getConnectionName())->transaction(fn () => $type->delete());
    }
}
