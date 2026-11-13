<?php

namespace App\Models;

use App\Services\ProductAttributeService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BusinessTypeField extends Model
{
    public const TYPE_TEXT = 'text';

    public const TYPE_TEXTAREA = 'textarea';

    public const TYPE_NUMBER = 'number';

    public const TYPE_DECIMAL = 'decimal';

    public const TYPE_BOOLEAN = 'boolean';

    public const TYPE_DATE = 'date';

    public const TYPE_SELECT = 'select';

    public const TYPES = [
        self::TYPE_TEXT,
        self::TYPE_TEXTAREA,
        self::TYPE_NUMBER,
        self::TYPE_DECIMAL,
        self::TYPE_BOOLEAN,
        self::TYPE_DATE,
        self::TYPE_SELECT,
    ];

    /**
     * Validation settings that make sense for each type.
     */
    public const VALIDATION_KEYS = [
        self::TYPE_TEXT => ['min_length', 'max_length'],
        self::TYPE_TEXTAREA => ['min_length', 'max_length'],
        self::TYPE_NUMBER => ['min', 'max'],
        self::TYPE_DECIMAL => ['min', 'max', 'decimals'],
        self::TYPE_BOOLEAN => [],
        self::TYPE_DATE => [],
        self::TYPE_SELECT => [],
    ];

    protected $connection = 'central';

    protected $fillable = [
        'business_type_id',
        'key',
        'label',
        'type',
        'is_required',
        'is_active',
        'options',
        'validation',
        'sort_order',
    ];

    protected $casts = [
        'is_required' => 'boolean',
        'is_active' => 'boolean',
        'options' => 'array',
        'validation' => 'array',
        'sort_order' => 'integer',
    ];

    protected static function booted(): void
    {
        $forget = fn (BusinessTypeField $field) => app(ProductAttributeService::class)
            ->forget((int) $field->business_type_id);

        static::saved($forget);
        static::deleted($forget);
    }

    public function businessType(): BelongsTo
    {
        return $this->belongsTo(BusinessType::class);
    }
}

