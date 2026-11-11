<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\ActivateAccountRequest;
use App\Services\EmployeeInvitationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvitationActivationController extends Controller
{
    public function __construct(
        private readonly EmployeeInvitationService $invitationService,
    ) {}

    public function show(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'size:64'],
        ]);

        $invitation = $this->invitationService->inspect($validated['token']);

        return response()->json([
            'data' => [
                'name' => $invitation->user->name,
                'email' => $invitation->user->email,
                'tenant_name' => tenant('name') ?? 'Inventarya',
                'expires_at' => $invitation->expires_at->toIso8601String(),
            ],
        ]);
    }

    public function store(ActivateAccountRequest $request): JsonResponse
    {
        $user = $this->invitationService->activate(
            $request->validated('token'),
            $request->validated('password'),
        );

        return response()->json([
            'message' => 'Cuenta activada correctamente. Ya puedes iniciar sesión.',
            'data' => [
                'email' => $user->email,
                'login_url' => '/login',
            ],
        ]);
    }
}
