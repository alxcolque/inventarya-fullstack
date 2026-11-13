<?php

namespace App\Services;

use App\Models\BusinessType;
use App\Models\BusinessTypeField;
use Closure;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\Rule;

/**
 * Resolves the product-attribute contract of a business type (central source
 * of truth) and turns it into validation rules / normalized JSON values.
 *
 * Field definitions are cached under a tenant-agnostic key so that changing a
 * definition in the central panel invalidates it for every tenant at once.
 */
class ProductAttributeService
{
    private const CACHE_TTL_SECONDS = 3600;

    private const DEFAULT_TEXT_MAX = 255;

    private const DEFAULT_TEXTAREA_MAX = 5000;

    /** @var array<int, array{business_type: array{id:int,name:string,slug:string}, fields: array<int, array<string, mixed>>}|null> */
    private array $memo = [];

    /**
     * Contract of the business type assigned to the authenticated tenant.
     *
     * The tenant is always resolved from the tenancy context, never from
     * request input.
     *
     * @return array{business_type: array{id:int,name:string,slug:string}|null, fields: array<int, array<string, mixed>>}
     */
    public function contractForCurrentTenant(): array
    {
        $businessTypeId = tenant()?->business_type_id;

        return $this->contractFor($businessTypeId ? (int) $businessTypeId : null);
    }

    /**
     * @return array{business_type: array{id:int,name:string,slug:string}|null, fields: array<int, array<string, mixed>>}
     */
    public function contractFor(?int $businessTypeId): array
    {
        if (! $businessTypeId) {
            return ['business_type' => null, 'fields' => []];
        }

        if (! array_key_exists($businessTypeId, $this->memo)) {
            $this->memo[$businessTypeId] = Cache::store()->remember(
                $this->cacheKey($businessTypeId),
                self::CACHE_TTL_SECONDS,
                fn () => $this->loadContract($businessTypeId),
            );
        }

        return $this->memo[$businessTypeId] ?? ['business_type' => null, 'fields' => []];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function activeFieldsForCurrentTenant(): array
    {
        return $this->contractForCurrentTenant()['fields'];
    }

    public function forget(int $businessTypeId): void
    {
        unset($this->memo[$businessTypeId]);
        Cache::store()->forget($this->cacheKey($businessTypeId));
    }

    /**
     * Laravel rules for `attributes.<key>`. Presence of required fields is
     * checked separately against the merged result (see missingRequired()).
     *
     * @param  array<int, array<string, mixed>>  $fields
     * @return array<string, array<int, mixed>>
     */
    public function rules(array $fields, string $prefix = 'attributes'): array
    {
        $rules = [];

        foreach ($fields as $field) {
            $rules["{$prefix}.{$field['key']}"] = ['nullable', ...$this->typeRules($field)];
        }

        return $rules;
    }

    /**
     * Keys that are not an active field of the contract.
     *
     * @param  array<string, mixed>  $incoming
     * @param  array<int, array<string, mixed>>  $fields
     * @return array<int, string>
     */
    public function unknownKeys(array $incoming, array $fields): array
    {
        $known = array_column($fields, 'key');

        return array_values(array_diff(array_map('strval', array_keys($incoming)), $known));
    }

    /**
     * Applies incoming (already validated) values over the stored ones.
     *
     * - keys that are not sent are preserved (partial updates never wipe data),
     *   including historical values of fields that were later deactivated;
     * - null / empty string clears a value;
     * - values are cast to their field type.
     *
     * @param  array<string, mixed>  $incoming
     * @param  array<int, array<string, mixed>>  $fields
     * @param  array<string, mixed>  $existing
     * @return array<string, mixed>
     */
    public function merge(array $incoming, array $fields, array $existing = []): array
    {
        $byKey = [];
        foreach ($fields as $field) {
            $byKey[$field['key']] = $field;
        }

        $result = $existing;

        foreach ($incoming as $key => $value) {
            $key = (string) $key;
            if (! isset($byKey[$key])) {
                continue;
            }

            if ($value === null || $value === '') {
                unset($result[$key]);

                continue;
            }

            $result[$key] = $this->cast($byKey[$key], $value);
        }

        return $result;
    }

    /**
     * Required active fields without a value in the given attributes.
     *
     * @param  array<string, mixed>  $attributes
     * @param  array<int, array<string, mixed>>  $fields
     * @return array<int, array<string, mixed>>
     */
    public function missingRequired(array $attributes, array $fields): array
    {
        return array_values(array_filter($fields, function (array $field) use ($attributes): bool {
            if (! $field['is_required']) {
                return false;
            }

            return ! array_key_exists($field['key'], $attributes)
                || $attributes[$field['key']] === null
                || $attributes[$field['key']] === '';
        }));
    }

    /**
     * @param  array<string, mixed>  $field
     * @return array<int, mixed>
     */
    private function typeRules(array $field): array
    {
        $validation = $field['validation'] ?? [];

        return match ($field['type']) {
            BusinessTypeField::TYPE_TEXT => [
                'string',
                'min:'.(int) ($validation['min_length'] ?? 0),
                'max:'.(int) ($validation['max_length'] ?? self::DEFAULT_TEXT_MAX),
            ],
            BusinessTypeField::TYPE_TEXTAREA => [
                'string',
                'min:'.(int) ($validation['min_length'] ?? 0),
                'max:'.(int) ($validation['max_length'] ?? self::DEFAULT_TEXTAREA_MAX),
            ],
            BusinessTypeField::TYPE_NUMBER => array_merge(['integer'], $this->rangeRules($validation)),
            BusinessTypeField::TYPE_DECIMAL => array_merge(
                ['numeric'],
                $this->rangeRules($validation),
                isset($validation['decimals']) ? [$this->decimalsRule((int) $validation['decimals'], $field['label'])] : [],
            ),
            BusinessTypeField::TYPE_BOOLEAN => ['boolean'],
            BusinessTypeField::TYPE_DATE => ['date_format:Y-m-d'],
            BusinessTypeField::TYPE_SELECT => [Rule::in($field['options'] ?? [])],
            default => ['prohibited'],
        };
    }

    /**
     * @param  array<string, mixed>  $validation
     * @return array<int, string>
     */
    private function rangeRules(array $validation): array
    {
        $rules = [];

        if (isset($validation['min'])) {
            $rules[] = 'min:'.$validation['min'];
        }
        if (isset($validation['max'])) {
            $rules[] = 'max:'.$validation['max'];
        }

        return $rules;
    }

    private function decimalsRule(int $decimals, string $label): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($decimals, $label): void {
            if (! is_numeric($value)) {
                return;
            }

            $string = is_float($value) ? rtrim(number_format($value, 10, '.', ''), '0') : (string) $value;
            $fraction = str_contains($string, '.') ? substr($string, strpos($string, '.') + 1) : '';

            if (strlen(rtrim($fraction, '0')) > $decimals) {
                $fail("El campo {$label} admite como máximo {$decimals} decimales.");
            }
        };
    }

    /**
     * @param  array<string, mixed>  $field
     */
    private function cast(array $field, mixed $value): mixed
    {
        return match ($field['type']) {
            BusinessTypeField::TYPE_NUMBER => (int) $value,
            BusinessTypeField::TYPE_DECIMAL => (float) $value,
            BusinessTypeField::TYPE_BOOLEAN => filter_var($value, FILTER_VALIDATE_BOOLEAN),
            default => is_string($value) ? trim($value) : $value,
        };
    }

    /**
     * @return array{business_type: array{id:int,name:string,slug:string}, fields: array<int, array<string, mixed>>}|null
     */
    private function loadContract(int $businessTypeId): ?array
    {
        $type = BusinessType::query()->find($businessTypeId);

        if (! $type) {
            return null;
        }

        return [
            'business_type' => [
                'id' => (int) $type->id,
                'name' => $type->name,
                'slug' => $type->slug,
            ],
            'fields' => $type->fields()
                ->where('is_active', true)
                ->get()
                ->map(fn (BusinessTypeField $field): array => [
                    'id' => (int) $field->id,
                    'key' => $field->key,
                    'label' => $field->label,
                    'type' => $field->type,
                    'is_required' => (bool) $field->is_required,
                    'is_active' => true,
                    'options' => $field->options,
                    'validation' => $field->validation,
                    'sort_order' => (int) $field->sort_order,
                ])
                ->all(),
        ];
    }

    private function cacheKey(int $businessTypeId): string
    {
        return "business_type_contract:{$businessTypeId}";
    }
}

