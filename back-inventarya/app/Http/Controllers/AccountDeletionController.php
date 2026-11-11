<?php

namespace App\Http\Controllers;

use App\Services\AccountDeletionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountDeletionController extends Controller
{
    public function __construct(
        private readonly AccountDeletionService $deletionService,
    ) {}

    /**
     * Public endpoint to submit an account deletion request.
     * Protected against account enumeration.
     */
    public function publicRequest(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email|max:255',
            'tenant' => 'required|string|max:100',
        ], [
            'email.required' => 'El correo electrónico es obligatorio.',
            'email.email' => 'Debe ingresar un correo electrónico válido.',
            'tenant.required' => 'La empresa o identificador de organización es obligatorio.',
        ]);

        $result = $this->deletionService->requestDeletion(
            email: $validated['email'],
            tenantIdentifier: $validated['tenant'],
            ip: $request->ip(),
            userAgent: $request->userAgent()
        );

        return response()->json($result);
    }

    /**
     * Consult the status of an account deletion request by its ticket.
     */
    public function status(Request $request): JsonResponse
    {
        $ticket = (string) $request->query('ticket', $request->input('ticket', ''));

        if (trim($ticket) === '') {
            return response()->json([
                'success' => false,
                'message' => 'El ticket de solicitud es obligatorio.',
            ], 422);
        }

        $result = $this->deletionService->checkStatus($ticket);

        return response()->json($result, $result['success'] ? 200 : 404);
    }

    /**
     * Confirm account deletion using the verification token.
     */
    public function confirm(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string|min:32|max:128',
        ], [
            'token.required' => 'El token de confirmación es obligatorio.',
        ]);

        $result = $this->deletionService->confirmDeletion($validated['token']);

        return response()->json($result, $result['success'] ? 200 : 422);
    }

    /**
     * Authenticated endpoint inside tenant application.
     */
    public function tenantRequest(Request $request): JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        $tenant = tenant();
        $tenantId = (string) ($tenant?->slug ?? $tenant?->id ?? '');

        $result = $this->deletionService->requestDeletion(
            email: $user->email,
            tenantIdentifier: $tenantId,
            ip: $request->ip(),
            userAgent: $request->userAgent(),
            authenticatedUser: $user
        );

        $result['user_role'] = $user->role;
        $result['is_owner'] = ($user->role === 'owner');

        return response()->json($result);
    }

    /**
     * Check status of requests for the authenticated tenant user.
     */
    public function tenantStatus(Request $request): JsonResponse
    {
        $ticket = $request->query('ticket');

        if ($ticket) {
            $result = $this->deletionService->checkStatus($ticket);

            return response()->json($result, $result['success'] ? 200 : 404);
        }

        $user = $request->user();
        $tenant = tenant();
        $requests = $tenant?->data['deletion_requests'] ?? [];

        $userRequests = [];
        foreach ($requests as $req) {
            if (isset($req['user_id']) && $req['user_id'] === $user?->id) {
                $userRequests[] = [
                    'ticket' => $req['ticket'],
                    'status' => $req['status'],
                    'is_owner' => $req['is_owner'],
                    'requested_at' => $req['requested_at'],
                    'expires_at' => $req['expires_at'],
                    'completed_at' => $req['completed_at'] ?? null,
                ];
            }
        }

        return response()->json([
            'success' => true,
            'requests' => $userRequests,
        ]);
    }
}
