<?php

namespace App\Services;

use App\Models\BusinessType;
use App\Models\BusinessTypeField;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BusinessTypeFieldService
{
    /**
     * Fields whose values may already be stored in tenant products are
     * "locked": their key and type are immutable and they cannot be deleted
     * (only deactivated). A field may hold data as soon as one tenant uses
     * the business type, since product values live in each tenant database.
     */
    public function isLocked(BusinessType $type): bool
    {
        return $type->tenants()->exists();
    }

    public function create(BusinessType $type, array $data): BusinessTypeField
    {
        $data = $this->sanitize($data);
        $data['sort_order'] ??= ((int) $type->fields()->max('sort_order')) + 1;

        return $type->fields()->create($data);
    }

    /**
     * @throws ValidationException
     */
    public function update(BusinessType $type, BusinessTypeField $field, array $data): BusinessTypeField
    {
        if ($this->isLocked($type)) {
            $this->assertIdentityUnchanged($field, $data);
        }

        $merged = array_merge(
            $field->only(['type', 'options', 'validation']),
            $data,
        );
        $sanitized = $this->sanitize($merged);

        $field->update(array_merge($data, [
            'options' => $sanitized['options'],
            'validation' => $sanitized['validation'],
        ]));

        return $field;
    }

    public function toggleStatus(BusinessTypeField $field): BusinessTypeField
    {
        $field->update(['is_active' => ! $field->is_active]);

        return $field;
    }

    /**
     * @throws ValidationException
     */
    public function delete(BusinessType $type, BusinessTypeField $field): void
    {
        if ($this->isLocked($type)) {
            throw ValidationException::withMessages([
                'field' => 'Este campo pertenece a un tipo de negocio en uso y puede tener valores guardados en productos. Desactívalo en lugar de eliminarlo.',
            ]);
        }

        $field->delete();
    }

    /**
     * @param  array<int, int>  $orderedIds
     *
     * @throws ValidationException
     */
    public function reorder(BusinessType $type, array $orderedIds): void
    {
        $ownIds = $type->fields()->pluck('id')->map(fn ($id) => (int) $id)->all();
        $orderedIds = array_map('intval', $orderedIds);

        if (array_diff($orderedIds, $ownIds) !== []) {
            throw ValidationException::withMessages([
                'order' => 'El orden contiene campos que no pertenecen a este tipo de negocio.',
            ]);
        }

        DB::connection($type->getConnectionName())->transaction(function () use ($type, $orderedIds) {
            foreach ($orderedIds as $position => $id) {
                $type->fields()->whereKey($id)->update(['sort_order' => $position + 1]);
            }
        });

        // Bulk updates skip model events: invalidate explicitly.
        app(ProductAttributeService::class)->forget((int) $type->getKey());
    }

    /**
     * @throws ValidationException
     */
    private function assertIdentityUnchanged(BusinessTypeField $field, array $data): void
    {
        $errors = [];

        if (array_key_exists('key', $data) && $data['key'] !== $field->key) {
            $errors['key'] = 'La clave interna no puede cambiarse porque el tipo de negocio está en uso.';
        }
        if (array_key_exists('type', $data) && $data['type'] !== $field->type) {
            $errors['type'] = 'El tipo de dato no puede cambiarse porque el tipo de negocio está en uso.';
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /**
     * Keeps only the options / validation settings that apply to the type.
     */
    private function sanitize(array $data): array
    {
        $type = $data['type'] ?? null;

        $data['options'] = $type === BusinessTypeField::TYPE_SELECT
            ? array_values(array_unique(array_map('strval', $data['options'] ?? [])))
            : null;

        $allowed = BusinessTypeField::VALIDATION_KEYS[$type] ?? [];
        $validation = array_intersect_key((array) ($data['validation'] ?? []), array_flip($allowed));
        $validation = array_filter($validation, fn ($value) => $value !== null && $value !== '');
        $data['validation'] = $validation === [] ? null : $validation;

        return $data;
    }
}

