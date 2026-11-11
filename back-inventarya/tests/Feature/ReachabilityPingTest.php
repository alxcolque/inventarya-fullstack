<?php

namespace Tests\Feature;

use Tests\TestCase;

class ReachabilityPingTest extends TestCase
{
    public function test_api_ping_returns_ok_and_is_lightweight(): void
    {
        $response = $this->getJson('/api/ping');

        $response->assertStatus(200);
        $response->assertJson([
            'ok' => true,
            'status' => 'ok',
            'online' => true,
        ]);
        $response->assertJsonStructure(['ok', 'status', 'online', 'timestamp']);
    }

    public function test_api_ping_with_tenant_header_returns_200(): void
    {
        $response = $this->withHeaders([
            'X-Tenant' => 'alex',
        ])->getJson('/api/ping');

        $response->assertStatus(200);
        $response->assertJson([
            'ok' => true,
            'status' => 'ok',
            'online' => true,
        ]);
    }
}
