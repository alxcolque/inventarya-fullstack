<?php

namespace App\Traits;

use App\Http\Responses\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Pagination\LengthAwarePaginator;

trait ApiResponseTrait
{
    /**
     * Return a success JSON response.
     */
    protected function successResponse($data = null, string $message = 'Success', int $code = 200, $meta = null): JsonResponse
    {
        return ApiResponse::success($data, $message, $code, $meta)->toResponse(request());
    }

    /**
     * Return an error JSON response.
     */
    protected function errorResponse(string $message = 'Error', int $code = 400, $errors = null): JsonResponse
    {
        return ApiResponse::error($message, $code, $errors)->toResponse(request());
    }

    /**
     * Return a paginated JSON response.
     */
    protected function paginationResponse(LengthAwarePaginator $paginator, string $message = 'Success'): JsonResponse
    {
        return ApiResponse::success(
            $paginator->items(),
            $message,
            200,
            [
                'pagination' => [
                    'total'        => $paginator->total(),
                    'count'        => $paginator->count(),
                    'per_page'     => $paginator->perPage(),
                    'current_page' => $paginator->currentPage(),
                    'total_pages'  => $paginator->lastPage(),
                ],
            ]
        )->toResponse(request());
    }
}
