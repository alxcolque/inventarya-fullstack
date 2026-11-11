<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Factura Fiscal #{{ $invoice['invoice_number'] }}</title>
    <style>
        @page {
            margin: 4mm 4mm 6mm 4mm;
            size: 80mm 297mm; /* Ancho estándar de rollo 80mm */
        }
        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 8.5pt;
            line-height: 1.25;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 0;
            width: 72mm;
        }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        .divider {
            border-top: 1px dashed #333;
            margin: 4px 0;
        }
        .divider-solid {
            border-top: 1px solid #000;
            margin: 4px 0;
        }
        .header-title {
            font-size: 10pt;
            font-weight: bold;
            margin-bottom: 2px;
        }
        .cuf-box {
            word-break: break-all;
            font-size: 6.5pt;
            line-height: 1.1;
            padding: 2px 0;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 7.5pt;
            margin: 4px 0;
        }
        .items-table th {
            border-bottom: 1px solid #000;
            padding: 2px 0;
            text-align: left;
        }
        .items-table td {
            padding: 2px 0;
            vertical-align: top;
        }
        .totals-table {
            width: 100%;
            font-size: 8pt;
            margin: 4px 0;
        }
        .totals-table td {
            padding: 1px 0;
        }
        .total-highlight {
            font-size: 9.5pt;
            font-weight: bold;
        }
        .qr-container {
            text-align: center;
            margin: 6px 0 4px 0;
        }
        .qr-img {
            width: 30mm;
            height: 30mm;
            min-width: 30mm;
            min-height: 30mm;
            display: inline-block;
        }
        .legal-text {
            font-size: 6.5pt;
            line-height: 1.2;
            text-align: center;
            margin: 3px 0;
        }
        .watermark-banner {
            border: 1px solid #c00;
            background-color: #fee;
            color: #c00;
            font-weight: bold;
            font-size: 7.5pt;
            padding: 3px;
            text-align: center;
            margin: 4px 0;
            text-transform: uppercase;
        }
        .logo-img {
            max-width: 140px;
            max-height: 50px;
            margin-bottom: 4px;
        }
    </style>
</head>
<body>

    @if (!empty($fiscalStatus['watermark_text']))
        <div class="watermark-banner">
            {{ $fiscalStatus['watermark_text'] }}
        </div>
    @endif

    <!-- ENCABEZADO EMISOR -->
    <div class="text-center">
        @if (!empty($branding['logo_data_uri']))
            <img src="{{ $branding['logo_data_uri'] }}" class="logo-img" alt="Logo"><br>
        @endif
        <div class="header-title">{{ $issuer['business_name'] }}</div>
        <div>{{ $issuer['branch_name'] }}</div>
        @if (!empty($issuer['phone']))
            <div>Tel: {{ $issuer['phone'] }}</div>
        @endif
        <div>{{ $issuer['address'] }}</div>
        <div>{{ $issuer['municipality'] }}</div>
    </div>

    <div class="divider"></div>

    <!-- DATOS DE LA FACTURA -->
    <div class="text-center">
        <div class="bold" style="font-size: 9pt;">{{ $legends['title'] }}</div>
        <div style="font-size: 7.5pt;">{{ $legends['subtitle'] }}</div>
    </div>

    <div class="divider"></div>

    <table style="width: 100%; font-size: 8pt;">
        <tr>
            <td class="bold">NIT:</td>
            <td class="text-right">{{ $issuer['nit'] }}</td>
        </tr>
        <tr>
            <td class="bold">FACTURA N°:</td>
            <td class="text-right bold">{{ $invoice['invoice_number'] }}</td>
        </tr>
        <tr>
            <td class="bold" colspan="2">CÓD. AUTORIZACIÓN (CUF):</td>
        </tr>
        <tr>
            <td colspan="2" class="cuf-box">{{ $invoice['cuf'] }}</td>
        </tr>
    </table>

    <div class="divider"></div>

    <!-- DATOS DEL CLIENTE -->
    <table style="width: 100%; font-size: 8pt;">
        <tr>
            <td class="bold" style="width: 30%;">Fecha:</td>
            <td>{{ $invoice['issued_at_formatted'] }}</td>
        </tr>
        <tr>
            <td class="bold">Nombre/Razón:</td>
            <td style="word-break: break-all;">{{ $buyer['name'] }}</td>
        </tr>
        <tr>
            <td class="bold">{{ $buyer['document_type_label'] }}:</td>
            <td>{{ $buyer['document_full'] }}</td>
        </tr>
    </table>

    <div class="divider"></div>

    <!-- DETALLE DE ITEMS -->
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 15%;">Cant.</th>
                <th style="width: 45%;">Detalle</th>
                <th style="width: 20%;" class="text-right">P.Unit</th>
                <th style="width: 20%;" class="text-right">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($items as $item)
                <tr>
                    <td>{{ $item['quantity'] }}</td>
                    <td style="word-break: break-word;">{{ $item['description'] }}</td>
                    <td class="text-right">{{ $item['unit_price'] }}</td>
                    <td class="text-right">{{ $item['subtotal'] }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <div class="divider"></div>

    <!-- TOTALES -->
    <table class="totals-table">
        <tr>
            <td>SUBTOTAL {{ $totals['currency_symbol'] }}:</td>
            <td class="text-right">{{ $totals['subtotal'] }}</td>
        </tr>
        @if ((float) $totals['discount'] > 0)
            <tr>
                <td>DESCUENTO {{ $totals['currency_symbol'] }}:</td>
                <td class="text-right">{{ $totals['discount'] }}</td>
            </tr>
        @endif
        @if ((float) $totals['additional_discount'] > 0)
            <tr>
                <td>DESC. ADICIONAL {{ $totals['currency_symbol'] }}:</td>
                <td class="text-right">{{ $totals['additional_discount'] }}</td>
            </tr>
        @endif
        @if ((float) $totals['gift_card_amount'] > 0)
            <tr>
                <td>MONTO GIFT CARD {{ $totals['currency_symbol'] }}:</td>
                <td class="text-right">{{ $totals['gift_card_amount'] }}</td>
            </tr>
        @endif
        <tr class="total-highlight">
            <td>TOTAL A PAGAR {{ $totals['currency_symbol'] }}:</td>
            <td class="text-right">{{ $totals['total'] }}</td>
        </tr>
        <tr>
            <td>IMPORTE BASE CRÉD. FISCAL:</td>
            <td class="text-right">{{ $totals['total_subject_to_vat'] }}</td>
        </tr>
    </table>

    <div style="font-size: 7.5pt; font-style: italic; margin: 3px 0;">
        {{ $totals['total_literal'] }}
    </div>

    <div class="divider"></div>

    <!-- CÓDIGO QR -->
    <div class="qr-container">
        <img src="{{ $qr['svg_base64'] }}" class="qr-img" alt="QR Fiscal"><br>
    </div>

    <!-- LEYENDAS NORMATIVAS -->
    <div class="legal-text bold">
        "{{ $legends['state_legend'] }}"
    </div>

    @if (!empty($legends['activity_legend']))
        <div class="legal-text">
            "{{ $legends['activity_legend'] }}"
        </div>
    @endif

    <div class="legal-text" style="font-size: 6pt;">
        "{{ $legends['system_legend'] }}"
    </div>

    <div class="text-center" style="font-size: 6pt; color: #555; margin-top: 6px;">
        {{ $branding['app_attribution'] }}
    </div>

</body>
</html>
