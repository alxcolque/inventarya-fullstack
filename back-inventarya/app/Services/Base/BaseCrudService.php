<?php

namespace App\Services\Base;

use Exception;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

abstract class BaseCrudService
{
    /**
     * @var \App\Repositories\Base\BaseRepository
     */
    protected $repository;

    /**
     * Get paginated records.
     */
    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        return $this->repository->paginate($filters, $perPage);
    }

    /**
     * Create a new record.
     */
    public function create(array $data): Model
    {
        return DB::transaction(function () use ($data) {
            return $this->repository->create($data);
        });
    }

    /**
     * Update an existing record.
     */
    public function update(int|string $id, array $data): Model
    {
        return DB::transaction(function () use ($id, $data) {
            return $this->repository->update($id, $data);
        });
    }

    /**
     * Delete a record.
     */
    public function delete(int|string $id): bool
    {
        return DB::transaction(function () use ($id) {
            return $this->repository->delete($id);
        });
    }

    /**
     * Restore a soft-deleted record.
     */
    public function restore(int|string $id): bool
    {
        return $this->repository->restore($id);
    }

    /**
     * Find a record or fail.
     */
    public function findOrFail(int|string $id): Model
    {
        return $this->repository->findOrFail($id);
    }
}
