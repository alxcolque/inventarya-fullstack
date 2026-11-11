<?php

namespace Tests\Unit;

use SoapClient;
use Tests\TestCase;

/**
 * Cliente de prueba para interceptar el Envelope SOAP de anulacionFactura.
 */
class InterceptingCancellationSoapClient extends SoapClient
{
    public string $lastRequestXml = '';

    public function __doRequest($request, $location, $action, $version, $one_way = 0): ?string
    {
        $this->lastRequestXml = $request;

        return '<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Body>
    <anulacionFacturaResponse xmlns="https://siat.impuestos.gob.bo/">
      <RespuestaServicioFacturacion>
        <codigoEstado>905</codigoEstado>
        <codigoRecepcion>REC-CANCEL-001</codigoRecepcion>
        <transaccion>true</transaccion>
      </RespuestaServicioFacturacion>
    </anulacionFacturaResponse>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>';
    }
}

class SiatCancellationSoapEnvelopeTest extends TestCase
{
    private static string $tempWsdlPath;

    public static function setUpBeforeClass(): void
    {
        parent::setUpBeforeClass();

        // WSDL fiel a la operación oficial anulacionFactura de ServicioFacturacionCompraVenta
        $wsdl = '<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/"
             xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
             xmlns:tns="https://siat.impuestos.gob.bo/"
             xmlns:xsd="http://www.w3.org/2001/XMLSchema"
             targetNamespace="https://siat.impuestos.gob.bo/">
  <types>
    <xsd:schema targetNamespace="https://siat.impuestos.gob.bo/">
      <xsd:element name="anulacionFactura">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="SolicitudServicioAnulacionFactura">
              <xsd:complexType>
                <xsd:sequence>
                  <xsd:element name="codigoAmbiente" type="xsd:int"/>
                  <xsd:element name="codigoDocumentoSector" type="xsd:int"/>
                  <xsd:element name="codigoEmision" type="xsd:int"/>
                  <xsd:element name="codigoModalidad" type="xsd:int"/>
                  <xsd:element minOccurs="0" name="codigoMotivo" type="xsd:int"/>
                  <xsd:element minOccurs="0" name="codigoPuntoVenta" type="xsd:int"/>
                  <xsd:element name="codigoSistema" type="xsd:string"/>
                  <xsd:element name="codigoSucursal" type="xsd:int"/>
                  <xsd:element name="cufd" type="xsd:string"/>
                  <xsd:element name="cuis" type="xsd:string"/>
                  <xsd:element name="nit" type="xsd:long"/>
                  <xsd:element name="tipoFacturaDocumento" type="xsd:int"/>
                  <xsd:element name="cuf" type="xsd:string"/>
                </xsd:sequence>
              </xsd:complexType>
            </xsd:element>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="anulacionFacturaResponse">
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
  <message name="anulacionFacturaRequest">
    <part name="parameters" element="tns:anulacionFactura"/>
  </message>
  <message name="anulacionFacturaResponse">
    <part name="parameters" element="tns:anulacionFacturaResponse"/>
  </message>
  <portType name="ServicioFacturacionPortType">
    <operation name="anulacionFactura">
      <input message="tns:anulacionFacturaRequest"/>
      <output message="tns:anulacionFacturaResponse"/>
    </operation>
  </portType>
  <binding name="ServicioFacturacionBinding" type="tns:ServicioFacturacionPortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="anulacionFactura">
      <soap:operation soapAction="anulacionFactura"/>
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

        self::$tempWsdlPath = tempnam(sys_get_temp_dir(), 'siat_cancel_wsdl_') . '.wsdl';
        file_put_contents(self::$tempWsdlPath, $wsdl);
    }

    public static function tearDownAfterClass(): void
    {
        if (file_exists(self::$tempWsdlPath)) {
            unlink(self::$tempWsdlPath);
        }
        parent::tearDownAfterClass();
    }

    public function test_anulacion_factura_soap_envelope_structure(): void
    {
        $client = new InterceptingCancellationSoapClient(self::$tempWsdlPath, [
            'trace'      => 1,
            'exceptions' => 1,
            'cache_wsdl' => WSDL_CACHE_NONE,
        ]);

        $solicitud = [
            'codigoAmbiente'        => 2,
            'codigoDocumentoSector' => 1,
            'codigoEmision'         => 1,
            'codigoModalidad'       => 1,
            'codigoMotivo'          => 1,
            'codigoPuntoVenta'      => 0,
            'codigoSistema'         => 'SYS-CANCEL-001',
            'codigoSucursal'        => 0,
            'cufd'                  => 'CUFD-CANCEL-TEST-123456',
            'cuis'                  => 'CUIS-CANCEL-TEST-789012',
            'nit'                   => 1003579028,
            'tipoFacturaDocumento'  => 1,
            'cuf'                   => 'CUF-TEST-ALPHANUMERIC-998877665544',
        ];

        $client->anulacionFactura([
            'SolicitudServicioAnulacionFactura' => $solicitud,
        ]);

        $xmlSent = $client->lastRequestXml;

        // 1. Operación y envolvente correcta
        $this->assertStringContainsString('anulacionFactura', $xmlSent);
        $this->assertStringContainsString('SolicitudServicioAnulacionFactura', $xmlSent);

        // 2. Elementos obligatorios presentes con sus valores
        $this->assertStringContainsString('<codigoAmbiente>2</codigoAmbiente>', $xmlSent);
        $this->assertStringContainsString('<codigoDocumentoSector>1</codigoDocumentoSector>', $xmlSent);
        $this->assertStringContainsString('<codigoEmision>1</codigoEmision>', $xmlSent);
        $this->assertStringContainsString('<codigoModalidad>1</codigoModalidad>', $xmlSent);
        $this->assertStringContainsString('<codigoMotivo>1</codigoMotivo>', $xmlSent);
        $this->assertStringContainsString('<codigoPuntoVenta>0</codigoPuntoVenta>', $xmlSent);
        $this->assertStringContainsString('<codigoSistema>SYS-CANCEL-001</codigoSistema>', $xmlSent);
        $this->assertStringContainsString('<codigoSucursal>0</codigoSucursal>', $xmlSent);
        $this->assertStringContainsString('<cufd>CUFD-CANCEL-TEST-123456</cufd>', $xmlSent);
        $this->assertStringContainsString('<cuis>CUIS-CANCEL-TEST-789012</cuis>', $xmlSent);
        $this->assertStringContainsString('<nit>1003579028</nit>', $xmlSent);
        $this->assertStringContainsString('<tipoFacturaDocumento>1</tipoFacturaDocumento>', $xmlSent);
        $this->assertStringContainsString('<cuf>CUF-TEST-ALPHANUMERIC-998877665544</cuf>', $xmlSent);

        // 3. Ausencia estricta de campos no solicitados por el contrato de anulación
        $this->assertStringNotContainsString('<archivo>', $xmlSent);
        $this->assertStringNotContainsString('<hashArchivo>', $xmlSent);
        $this->assertStringNotContainsString('<fechaEnvio>', $xmlSent);
        $this->assertStringNotContainsString('<numeroFactura>', $xmlSent);
        $this->assertStringNotContainsString('<xml>', $xmlSent);

        // 4. Ausencia estricta de TokenUsua
        $this->assertStringNotContainsString('TokenUsua', $xmlSent);
    }
}
