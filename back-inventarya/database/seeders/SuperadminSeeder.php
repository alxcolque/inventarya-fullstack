<?php

namespace Database\Seeders;

use App\Models\CentralUser;
use Illuminate\Database\Seeder;

class SuperadminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $name = trim((string) config('superadmin.name'));
        $email = strtolower(trim((string) config('superadmin.email')));
        $password = (string) config('superadmin.password');

        $missingVariables = collect([
            'SUPERADMIN_NAME' => $name,
            'SUPERADMIN_EMAIL' => $email,
            'SUPERADMIN_PASSWORD' => $password,
        ])->filter(fn (string $value): bool => $value === '')->keys();

        if ($missingVariables->isNotEmpty()) {
            throw new \RuntimeException(
                'SuperadminSeeder cancelado: faltan las variables de entorno '.
                $missingVariables->implode(', ').'.'
            );
        }

        if (! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new \RuntimeException(
                'SuperadminSeeder cancelado: SUPERADMIN_EMAIL no contiene un correo válido.'
            );
        }

        $usesPlaceholder = collect([$name, $email, $password])
            ->contains(fn (string $value): bool => str_contains(strtoupper($value), 'CHANGE_ME'));
        $hasStrongPassword = strlen($password) >= 12
            && preg_match('/[a-z]/', $password)
            && preg_match('/[A-Z]/', $password)
            && preg_match('/\d/', $password)
            && preg_match('/[^a-zA-Z0-9]/', $password);

        if ($usesPlaceholder || ! $hasStrongPassword) {
            throw new \RuntimeException(
                'SuperadminSeeder cancelado: usa valores reales y una SUPERADMIN_PASSWORD de al menos '.
                '12 caracteres con mayúscula, minúscula, número y símbolo.'
            );
        }

        CentralUser::query()->firstOrCreate(
            ['email' => $email],
            [
                'name' => $name,
                'password' => $password,
                'role' => 'superadmin',
                'status' => 'active',
            ]
        );
    }
}
