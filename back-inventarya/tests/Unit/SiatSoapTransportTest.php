<?php

namespace Tests\Unit;

use App\Models\Setting;
use App\Services\Siat\SiatSoapClient;
use Tests\TestCase;

/**
 * SiatSoapTransportTest — Fase 3B.1.1
 *
 * Pruebas unitarias de la capa de transporte y autenticación SOAP:
 *  - Formato oficial del HTTP header: 'apikey: TokenApi <token>'
 *  - Ausencia total de SoapHeader TokenUsua o mecanismos duplicados
 *  - Configuración efectiva de timeouts (connection_timeout y socket read timeout)
 *  - Sanitización de secretos en mensajes de error
 */
class SiatSoapTransportTest extends TestCase
{
    private Setting $setting;
    private string $fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake-token-content-12345';

    protected function setUp(): void
    {
        parent::setUp();

        $this->setting = new Setting([
            'tax_nit'          => '123456789',
            'siat_environment' => 2, // Piloto
            'siat_modality'    => 2,
            'siat_system_code' => 'SYS-INVENTARYA-TEST',
            'siat_api_token'   => $this->fakeToken,
        ]);
    }

    public function test_auth_header_utiliza_nombre_apikey_y_prefijo_tokenapi(): void
    {
        $client = new SiatSoapClient($this->setting);
        $header = $client->getAuthHeader();

        $this->assertStringStartsWith('apikey: TokenApi ', $header);
        $this->assertEquals("apikey: TokenApi {$this->fakeToken}", $header);
    }

    public function test_stream_context_configura_header_oficial_y_timeout_de_lectura(): void
    {
        config(['siat.soap.timeout' => 25]);

        $client  = new SiatSoapClient($this->setting);
        $options = $client->buildStreamContextOptions();

        $this->assertArrayHasKey('http', $options);
        $this->assertArrayHasKey('header', $options['http']);
        $this->assertArrayHasKey('timeout', $options['http']);

        $this->assertStringContainsString("apikey: TokenApi {$this->fakeToken}\r\n", $options['http']['header']);
        $this->assertStringNotContainsString('TokenUsua', $options['http']['header']);
        $this->assertEquals(25.0, $options['http']['timeout']);
    }

    public function test_soap_client_options_incluyen_connection_timeout(): void
    {
        config(['siat.soap.connection_timeout' => 12]);

        $client  = new SiatSoapClient($this->setting);
        $options = $client->getSoapOptions();

        $this->assertArrayHasKey('connection_timeout', $options);
        $this->assertEquals(12, $options['connection_timeout']);
        $this->assertFalse($options['trace']);
    }

    public function test_token_y_credenciales_son_removidos_en_mensajes_sanitizados(): void
    {
        $client = new SiatSoapClient($this->setting);

        $rawMessageWithToken = "SoapFault: Authentication failed with apikey: TokenApi {$this->fakeToken} at endpoint";
        $sanitized           = $client->sanitizeErrorMessage($rawMessageWithToken);

        $this->assertStringNotContainsString($this->fakeToken, $sanitized);
        $this->assertStringContainsString('***', $sanitized);
    }

    public function test_passwords_y_tokens_genericos_son_sanitizados(): void
    {
        $client = new SiatSoapClient($this->setting);

        $rawMsg    = "Error in request: password: SuperSecretPassword123, token: SomeOtherToken456";
        $sanitized = $client->sanitizeErrorMessage($rawMsg);

        $this->assertStringNotContainsString('SuperSecretPassword123', $sanitized);
        $this->assertStringNotContainsString('SomeOtherToken456', $sanitized);
    }

    public function test_retry_idempotente_reintenta_y_tiene_exito(): void
    {
        $client = new SiatSoapClient($this->setting);
        $attempts = 0;

        $result = $client->retryIdempotent(function () use (&$attempts) {
            $attempts++;
            if ($attempts === 1) {
                throw new \RuntimeException('Temporary network timeout');
            }
            return ['status' => 'success'];
        }, 2);

        $this->assertEquals(2, $attempts);
        $this->assertEquals(['status' => 'success'], $result);
    }

    public function test_retry_idempotente_lanza_excepcion_tras_max_intentos(): void
    {
        $client = new SiatSoapClient($this->setting);
        $attempts = 0;

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Persistent network error');

        $client->retryIdempotent(function () use (&$attempts) {
            $attempts++;
            throw new \RuntimeException('Persistent network error');
        }, 2);
    }

    public function test_cuis_y_cufd_no_usan_retry_idempotente_automatico(): void
    {
        $reflector = new \ReflectionClass(SiatSoapClient::class);

        // obtenerCuis y obtenerCufd deben invocar directamente callCodigos sin retryIdempotent
        $cuisSource = file_get_contents($reflector->getFileName());

        preg_match('/public function obtenerCuis\([^\)]*\): array\s*\{([^\}]+)\}/s', $cuisSource, $cuisMatch);
        $this->assertNotEmpty($cuisMatch);
        $this->assertStringNotContainsString('retryIdempotent', $cuisMatch[1]);
        $this->assertStringContainsString('callCodigos', $cuisMatch[1]);

        preg_match('/public function obtenerCufd\([^\)]*\): array\s*\{([^\}]+)\}/s', $cuisSource, $cufdMatch);
        $this->assertNotEmpty($cufdMatch);
        $this->assertStringNotContainsString('retryIdempotent', $cufdMatch[1]);
        $this->assertStringContainsString('callCodigos', $cufdMatch[1]);
    }

    public function test_production_environment_throws_production_siat_blocked_during_pilot_guard(): void
    {
        config(['siat.live_submission_enabled' => true]);

        $prodSetting = new Setting([
            'tax_nit'          => '123456789',
            'siat_environment' => 1, // PRODUCCIÓN
            'siat_modality'    => 2,
            'siat_system_code' => 'SYS-INVENTARYA-TEST',
            'siat_api_token'   => $this->fakeToken,
        ]);

        $this->expectException(\App\Exceptions\SiatFiscalException::class);
        $this->expectExceptionMessage('PRODUCTION_SIAT_BLOCKED_DURING_PILOT');

        // Garantiza 0 sockets y 0 llamadas SOAP
        new SiatSoapClient($prodSetting);
    }
}

