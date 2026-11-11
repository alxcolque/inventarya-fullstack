<?php

namespace App\Services\Siat;

use App\Exceptions\SiatFiscalException;
use DOMDocument;

class SiatInvoiceXmlValidator
{
    /**
     * Valida un contenido XML contra su respectivo esquema XSD oficial local.
     *
     * @throws SiatFiscalException
     */
    public function validate(string $xmlContent, ?string $xsdPath = null): bool
    {
        if (trim($xmlContent) === '') {
            throw new SiatFiscalException("El contenido XML para validación XSD está vacío.");
        }

        $dom = new DOMDocument();
        $previousLibxmlUseErrors = libxml_use_internal_errors(true);
        libxml_clear_errors();

        $loaded = $dom->loadXML($xmlContent);
        if (! $loaded) {
            $errors = $this->collectLibxmlErrors();
            libxml_use_internal_errors($previousLibxmlUseErrors);
            throw new SiatFiscalException("Error de sintaxis XML: " . implode('; ', $errors));
        }

        if ($xsdPath === null) {
            $rootName = $dom->documentElement?->tagName ?? '';
            $xsdPath = $this->resolveXsdPathForRoot($rootName);
        }

        if (! file_exists($xsdPath)) {
            libxml_use_internal_errors($previousLibxmlUseErrors);
            throw new SiatFiscalException("El archivo de esquema XSD oficial no se encuentra en la ruta esperada.");
        }

        $isValid = $dom->schemaValidate($xsdPath);

        if (! $isValid) {
            $errors = $this->collectLibxmlErrors();
            libxml_use_internal_errors($previousLibxmlUseErrors);
            throw new SiatFiscalException("El XML no cumple con el esquema XSD oficial del SIN: " . implode('; ', $errors));
        }

        libxml_clear_errors();
        libxml_use_internal_errors($previousLibxmlUseErrors);

        return true;
    }

    /**
     * Determina la ruta del XSD a partir del nombre del elemento raíz.
     *
     * @throws SiatFiscalException
     */
    public function resolveXsdPathForRoot(string $rootName): string
    {
        return match ($rootName) {
            'facturaElectronicaCompraVenta' => resource_path('siat/xsd/facturaElectronicaCompraVenta.xsd'),
            'facturaComputarizadaCompraVenta' => resource_path('siat/xsd/facturaComputarizadaCompraVenta.xsd'),
            default => throw new SiatFiscalException("Elemento raíz no reconocido para validación XSD: '{$rootName}'."),
        };
    }

    /**
     * Determina la ruta del XSD para la modalidad configurada (1 = Electrónica, 2 = Computarizada).
     *
     * @throws SiatFiscalException
     */
    public function getXsdPathForModality(int $modality): string
    {
        return match ($modality) {
            1 => resource_path('siat/xsd/facturaElectronicaCompraVenta.xsd'),
            2 => resource_path('siat/xsd/facturaComputarizadaCompraVenta.xsd'),
            default => throw new SiatFiscalException("Modalidad SIAT no soportada para validación XSD: '{$modality}'."),
        };
    }

    /**
     * Sanitiza los errores de libxml eliminando rutas internas del servidor.
     *
     * @return array<string>
     */
    private function collectLibxmlErrors(): array
    {
        $messages = [];
        foreach (libxml_get_errors() as $error) {
            $msg = trim($error->message);
            // Reemplazar rutas internas del sistema de archivos
            $msg = preg_replace('/in\s+.*?(factura\w+\.xsd)/i', 'in $1', $msg);
            $msg = preg_replace('/[a-zA-Z]:\\\\[^\s:]+/i', '[schema]', $msg);
            $messages[] = "Línea {$error->line}: {$msg}";
        }
        libxml_clear_errors();
        return $messages ?: ['Error de validación de estructura XML/XSD.'];
    }
}
