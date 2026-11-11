<?php

namespace App\Services;

use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;

class SlugService
{
    /**
     * Generate a unique slug for a given table and column.
     *
     * @param string $title The source string to generate slug from.
     * @param string $table The database table to check for uniqueness.
     * @param string $column The column name in the table.
     * @param string|null $ignoreId Optional ID to ignore (for updates).
     * @param string $separator The separator to use (default: '-').
     * @return string
     */
    public static function generate(string $title, string $table, string $column = 'slug', ?string $ignoreId = null, string $separator = '-'): string
    {
        $slug = Str::slug($title, $separator);
        
        // Strip out any characters that are not alphanumeric or separator to ensure perfect URLs
        $slug = preg_replace('/[^\w' . preg_quote($separator) . ']+/u', '', $slug);
        
        $originalSlug = $slug;
        $count = 1;
        
        while (self::slugExists($slug, $table, $column, $ignoreId)) {
            $slug = $originalSlug . $separator . $count;
            $count++;
        }
        
        return $slug;
    }
    
    /**
     * Check if a slug already exists in the database.
     *
     * @param string $slug
     * @param string $table
     * @param string $column
     * @param string|null $ignoreId
     * @return bool
     */
    protected static function slugExists(string $slug, string $table, string $column, ?string $ignoreId = null): bool
    {
        $query = DB::table($table)->where($column, $slug);
        
        if ($ignoreId !== null) {
            // For tables like 'tenants', the primary key is 'id' (which is the slug itself)
            $idColumn = ($table === 'tenants') ? 'id' : 'id';
            $query->where($idColumn, '!=', $ignoreId);
        }
        
        return $query->exists();
    }
}
