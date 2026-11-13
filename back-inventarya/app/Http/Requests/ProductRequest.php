<?php

namespace App\Http\Requests;

use App\Models\Product;
use App\Rules\PublicImage;
use App\Services\ProductAttributeService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;

class ProductRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'        => ($this->isMethod('put') || $this->isMethod('patch')) ? 'sometimes|required|string|max:150' : 'required|string|max:150',
            'category_id' => 'nullable|exists:categories,id',
            'brand_id'    => 'nullable|exists:brands,id',
            'sku' => 'nullable|string|max:100',
            'barcode' => 'nullable|string|max:100',
            'sin_product_code' => 'nullable|string|max:100',
            'sin_activity_code' => 'nullable|string|max:100',
            'sin_unit_code' => 'nullable|integer',
            'description' => 'nullable|string',
            'image' => ['nullable', new PublicImage(2048)],
            'attributes' => ['sometimes', 'nullable', 'array'],
            ...$this->attributeService()->rules($this->attributeFields()),
        ];
    }

    /**
     * Dynamic attributes must match the business-type contract of the
     * authenticated tenant: no unknown / inactive keys and all required
     * fields present (considering the values already stored on update).
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $incoming = $this->input('attributes');
                $incoming = is_array($incoming) ? $incoming : [];
                $fields = $this->attributeFields();
                $service = $this->attributeService();

                foreach ($service->unknownKeys($incoming, $fields) as $key) {
                    $validator->errors()->add(
                        "attributes.{$key}",
                        "El atributo '{$key}' no está definido o no está activo para este tipo de negocio."
                    );
                }

                $isUpdate = $this->isMethod('put') || $this->isMethod('patch');
                if ($isUpdate && ! $this->has('attributes')) {
                    return;
                }

                $merged = $service->merge($incoming, $fields, $this->existingAttributes());

                foreach ($service->missingRequired($merged, $fields) as $field) {
                    if (! $validator->errors()->has("attributes.{$field['key']}")) {
                        $validator->errors()->add("attributes.{$field['key']}", "El campo {$field['label']} es obligatorio.");
                    }
                }
            },
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function attributeFields(): array
    {
        return $this->attributeService()->activeFieldsForCurrentTenant();
    }

    private function attributeService(): ProductAttributeService
    {
        return app(ProductAttributeService::class);
    }

    /**
     * @return array<string, mixed>
     */
    private function existingAttributes(): array
    {
        $id = $this->route('product');

        return is_string($id) && Str::isUuid($id)
            ? (Product::query()->whereKey($id)->first()?->attributes ?? [])
            : [];
    }

    public function messages(): array
    {
        return [
            'name.required'       => 'El nombre del producto es obligatorio.',
            'name.string'         => 'El nombre debe ser una cadena de texto.',
            'name.max'            => 'El nombre no debe exceder los 150 caracteres.',
            'category_id.exists'  => 'La categoría seleccionada no existe.',
            'brand_id.exists'     => 'La marca seleccionada no existe.',
            'sku.max'             => 'El SKU no debe exceder los 100 caracteres.',
            'barcode.string'      => 'El código de barras debe ser una cadena de texto.',
            'barcode.max'         => 'El código de barras no debe exceder los 100 caracteres.',
        ];
    }
}
