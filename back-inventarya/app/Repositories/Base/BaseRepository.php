<?php

namespace App\Repositories\Base;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;

abstract class BaseRepository
{
    /**
     * @var Model
     */
    protected $model;

    /**
     * BaseRepository constructor.
     *
     * @param Model $model
     */
    public function __construct(Model $model)
    {
        $this->model = $model;
    }

    /**
     * Get the query builder.
     */
    public function query(): Builder
    {
        return $this->model->newQuery();
    }

    /**
     * Apply filters, search, and sorting.
     */
    public function applyCriteria(Builder $query, array $filters = []): Builder
    {
        if (isset($filters['search']) && !empty($filters['search'])) {
            $this->applySearch($query, $filters['search']);
        }

        if (isset($filters['sort_by'])) {
            $direction = $filters['sort_direction'] ?? 'asc';
            $query->orderBy($filters['sort_by'], $direction);
        }

        return $query;
    }

    /**
     * Standard search implementation (override in child classes).
     */
    protected function applySearch(Builder $query, string $term): void
    {
        // Default search logic (can be empty)
    }

    /**
     * Paginate results.
     */
    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = $this->query();
        $this->applyCriteria($query, $filters);
        
        return $query->paginate($perPage);
    }

    /**
     * Create a record.
     */
    public function create(array $data): Model
    {
        return $this->model->create($data);
    }

    /**
     * Update a record.
     */
    public function update(int|string $id, array $data): Model
    {
        $record = $this->findOrFail($id);
        $record->update($data);
        return $record;
    }

    /**
     * Delete a record.
     */
    public function delete(int|string $id): bool
    {
        $record = $this->findOrFail($id);
        return $record->delete();
    }

    /**
     * Restore a record.
     */
    public function restore(int|string $id): bool
    {
        return $this->model->onlyTrashed()->findOrFail($id)->restore();
    }

    /**
     * Find a record or fail.
     */
    public function findOrFail(int|string $id): Model
    {
        return $this->model->findOrFail($id);
    }
}
