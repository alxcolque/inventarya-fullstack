<?php

namespace Tests\Unit;

use App\Models\Setting;
use App\Services\Siat\SiatInvoicePackageBuilder;
use App\Services\Siat\SiatSoapClient;
use Tests\TestCase;
use SoapClient;

/**
 * Cliente de prueba para interceptar el Envelope SOAP generado sin realizar llamadas de red.
 */
class InterceptingSoapClient extends SoapClient
{
    public string $lastRequestXml = '';

    public function __doRequest($request, $location, $action, $version, $one_way = 0): ?string
    {
        $this->lastRequestXml = $request;

        // Respuesta simulada para completar el ciclo de SoapClient
        return '<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <recepcionFacturaResponse xmlns="https://siat.impuestos.gob.bo/">
      <RespuestaServicioFacturacion>
        <codigoEstado>908</codigoEstado>
        <codigoRecepcion>REC-TEST-123</codigoRecepcion>
        <transaccion>true</transaccion>
      </RespuestaServicioFacturacion>
    </recepcionFacturaResponse>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>';
    }
}

class SiatSoapEnvelopeTest extends TestCase
{
    private static string $tempWsdlPath;

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();

        // WSDL mínimo fiel al contrato oficial del SIN para recepcionFactura
        $wsdl = '<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/"
             xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
             xmlns:tns="https://siat.impuestos.gob.bo/"
             xmlns:xsd="http://www.w3.org/2001/XMLSchema"
             targetNamespace="https://siat.impuestos.gob.bo/">
  <types>
    <xsd:schema targetNamespace="https://siat.impuestos.gob.bo/">
      <xsd:element name="recepcionFactura">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="SolicitudServicioRecepcionFactura">
              <xsd:complexType>
                <xsd:sequence>
                  <xsd:element name="codigoAmbiente" type="xsd:int"/>
                  <xsd:element name="codigoDocumentoSector" type="xsd:int"/>
                  <xsd:element name="codigoEmision" type="xsd:int"/>
                  <xsd:element name="codigoModalidad" type="xsd:int"/>
                  <xsd:element minOccurs="0" name="codigoPuntoVenta" type="xsd:int"/>
                  <xsd:element name="codigoSistema" type="xsd:string"/>
                  <xsd:element name="codigoSucursal" type="xsd:int"/>
                  <xsd:element name="cufd" type="xsd:string"/>
                  <xsd:element name="cuis" type="xsd:string"/>
                  <xsd:element name="nit" type="xsd:long"/>
                  <xsd:element name="tipoFacturaDocumento" type="xsd:int"/>
                  <xsd:element name="archivo" type="xsd:base64Binary"/>
                  <xsd:element name="fechaEnvio" type="xsd:string"/>
                  <xsd:element name="hashArchivo" type="xsd:string"/>
                </xsd:sequence>
              </xsd:complexType>
            </xsd:element>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="recepcionFacturaResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="RespuestaServicioFacturacion">
              <xsd:complexType>
                <xsd:sequence>
                  <xsd:element name="codigoEstado" type="xsd:int"/>
                  <xsd:element name="codigoRecepcion" type="xsd:string"/>
                  <xsd:element name="transaccion" type="xsd:boolean"/>
                </xsd:sequence>
              </xsd:complexType>
            </xsd:element>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </types>
  <message name="recepcionFacturaRequest">
    <part name="parameters" element="tns:recepcionFactura"/>
  </message>
  <message name="recepcionFacturaResponse">
    <part name="parameters" element="tns:recepcionFacturaResponse"/>
  </message>
  <portType name="ServicioFacturacionPortType">
    <operation name="recepcionFactura">
      <input message="tns:recepcionFacturaRequest"/>
      <output message="tns:recepcionFacturaResponse"/>
    </operation>
  </portType>
  <binding name="ServicioFacturacionBinding" type="tns:ServicioFacturacionPortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="recepcionFactura">
      <soap:operation soapAction="recepcionFactura"/>
      <input><soap:body use="literal"/></input>
      <output><soap:body use="literal"/></output>
    </operation>
  </binding>
  <service name="ServicioFacturacion">
    <port name="ServicioFacturacionPort" binding="tns:ServicioFacturacionBinding">
      <soap:address location="http://127.0.0.1:9/dummy"/>
    </port>
  </service>
</definitions>';

        self::$tempWsdlPath = tempnam(sys_get_temp_dir(), 'siat_test_wsdl_') . '.wsdl';
        file_put_contents(self::$tempWsdlPath, $wsdl);
    }

    public static function tearDownAfterClass(): void
    {
        if (file_exists(self::$tempWsdlPath)) {
            unlink(self::$tempWsdlPath);
        }
        parent::tearDownAfterClass();
    }

    public function test_soap_client_serializes_raw_binary_archivo_to_single_base64_without_double_encoding(): void
    {
        $packageBuilder = new SiatInvoicePackageBuilder();
        $originalXml = '<?xml version="1.0" encoding="UTF-8"?><factura><nitEmisor>123456789</nitEmisor></factura>';
        $package = $packageBuilder->buildPackage($originalXml);

        $client = new InterceptingSoapClient(self::$tempWsdlPath, [
            'trace'      => 1,
            'exceptions' => 1,
            'cache_wsdl' => WSDL_CACHE_NONE,
        ]);

        // Pasamos los bytes binarios raw GZIP directamente al campo archivo
        $client->recepcionFactura([
            'SolicitudServicioRecepcionFactura' => [
                'codigoAmbiente'        => 2,
                'codigoDocumentoSector' => 1,
                'codigoEmision'         => 1,
                'codigoModalidad'       => 2,
                'codigoPuntoVenta'      => 0,
                'codigoSistema'         => 'SISTEMA-TEST-001',
                'codigoSucursal'        => 0,
                'cufd'                  => 'CUFD-TEST-123456',
                'cuis'                  => 'CUIS-TEST-789012',
                'nit'                   => 123456789,
                'tipoFacturaDocumento'  => 1,
                'archivo'               => $package['rawGzip'], // RAW GZIP BYTES
                'fechaEnvio'            => '2026-10-15T12:00:00.000',
                'hashArchivo'           => $package['hashArchivo'],
            ]
        ]);

        $xmlSent = $client->lastRequestXml;

        // 1. Debe existir el nodo <archivo> en el XML serializado
        $this->assertStringContainsString('<archivo>', $xmlSent);
        $this->assertStringContainsString('</archivo>', $xmlSent);

        // 2. Extraer el contenido del nodo <archivo>
        preg_match('/<archivo>(.*?)<\/archivo>/s', $xmlSent, $matches);
        $this->assertNotEmpty($matches[1]);
        $wireBase64 = trim($matches[1]);

        // 3. El contenido en el wire coincide exactamente con base64_encode del paquete GZIP
        $this->assertSame($package['base64'], $wireBase64);

        // 4. Decodificar UNA SOLA VEZ recupera exactamente los bytes binarios GZIP
        $decodedGzip = base64_decode($wireBase64, true);
        $this->assertSame($package['rawGzip'], $decodedGzip);

        // 5. Descomprimir los bytes recuperados produce exactamente el XML original byte a byte
        $decompressedXml = $packageBuilder->decompress($decodedGzip);
        $this->assertSame($originalXml, $decompressedXml);

        // 6. El hashArchivo en el wire coincide exactamente con el SHA-256 de los bytes decodificados
        $this->assertSame(hash('sha256', $decodedGzip), $package['hashArchivo']);
    }

    public function test_passing_pre_encoded_base64_causes_double_base64_in_wire_envelope(): void
    {
        $packageBuilder = new SiatInvoicePackageBuilder();
        $originalXml = '<factura>TEST</factura>';
        $package = $packageBuilder->buildPackage($originalXml);

        $client = new InterceptingSoapClient(self::$tempWsdlPath, [
            'trace'      => 1,
            'exceptions' => 1,
            'cache_wsdl' => WSDL_CACHE_NONE,
        ]);

        // Si erróneamente se envía base64_encode($rawGzip) a SoapClient:
        $client->recepcionFactura([
            'SolicitudServicioRecepcionFactura' => [
                'codigoAmbiente'        => 2,
                'codigoDocumentoSector' => 1,
                'codigoEmision'         => 1,
                'codigoModalidad'       => 2,
                'codigoPuntoVenta'      => 0,
                'codigoSistema'         => 'TEST',
                'codigoSucursal'        => 0,
                'cufd'                  => 'CUFD',
                'cuis'                  => 'CUIS',
                'nit'                   => 123,
                'tipoFacturaDocumento'  => 1,
                'archivo'               => base64_encode($package['rawGzip']), // ERRÓNEO: DOBLE BASE64
                'fechaEnvio'            => '2026-10-15T12:00:00.000',
                'hashArchivo'           => $package['hashArchivo'],
            ]
        ]);

        preg_match('/<archivo>(.*?)<\/archivo>/s', $client->lastRequestXml, $matches);
        $wireBase64 = trim($matches[1]);

        // En el wire NO están los bytes GZIP una vez decodificados; está el texto base64 intermedio
        $firstDecode = base64_decode($wireBase64);
        $this->assertNotSame($package['rawGzip'], $firstDecode);
        $this->assertSame($package['base64'], $firstDecode); // Confirmación de doble Base64
    }

    public function test_auth_headers_and_no_token_usua(): void
    {
        $setting = new Setting();
        $setting->tax_nit = '123456789';
        $setting->siat_api_token = 'SECRET-TOKEN-XYZ-999';
        $setting->siat_environment = 2;
        $setting->siat_modality = 1;
        $setting->siat_system_code = 'SYS-01';

        $client = new SiatSoapClient($setting);

        // Encabezado HTTP oficial
        $authHeader = $client->getAuthHeader();
        $this->assertSame('apikey: TokenApi SECRET-TOKEN-XYZ-999', $authHeader);

        // Sin TokenUsua
        $this->assertStringNotContainsString('TokenUsua', $authHeader);

        // Stream context options
        $streamOptions = $client->buildStreamContextOptions();
        $this->assertArrayHasKey('http', $streamOptions);
        $this->assertStringContainsString('apikey: TokenApi SECRET-TOKEN-XYZ-999', $streamOptions['http']['header']);
        $this->assertStringNotContainsString('TokenUsua', $streamOptions['http']['header']);
    }
}
