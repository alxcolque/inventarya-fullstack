<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Factura Fiscal #{{ $invoice['invoice_number'] }}</title>
    <style>
        @page {
            margin: 12mm 15mm 15mm 15mm;
            size: letter portrait;
        }
        body {
            font-family: 'DejaVu Sans', Arial, Helvetica, sans-serif;
            font-size: 8.5pt;
            line-height: 1.3;
            color: #222;
            background: #fff;
            margin: 0;
            padding: 0;
        }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .bold { font-weight: bold; }
        
        .header-table {
            width: 100%;
            margin-bottom: 12px;
            border-collapse: collapse;
        }
        .issuer-info {
            width: 55%;
            vertical-align: top;
            padding-right: 15px;
        }
        .issuer-title {
            font-size: 12pt;
            font-weight: bold;
            color: #111;
            margin-bottom: 2px;
        }
        .issuer-details {
            font-size: 8pt;
            color: #444;
            line-height: 1.35;
        }
        .fiscal-box-container {
            width: 45%;
            vertical-align: top;
        }
        .fiscal-box {
            border: 1.5px solid #2b4c7e;
            border-radius: 4px;
            padding: 8px 10px;
            background-color: #f8fafc;
            text-align: center;
        }
        .fiscal-box-nit {
            font-size: 10pt;
            font-weight: bold;
            margin-bottom: 3px;
        }
        .fiscal-box-num {
            font-size: 11pt;
            font-weight: bold;
            color: #1e3a8a;
            margin-bottom: 4px;
        }
        .fiscal-box-cuf-title {
            font-size: 7.5pt;
            font-weight: bold;
            color: #475569;
            margin-top: 2px;
        }
        .fiscal-box-cuf {
            font-size: 6.5pt;
            word-break: break-all;
            line-height: 1.15;
            color: #1e293b;
        }

        .title-section {
            text-align: center;
            margin: 8px 0 12px 0;
        }
        .title-main {
            font-size: 14pt;
            font-weight: bold;
            letter-spacing: 1px;
            color: #0f172a;
        }
        .title-sub {
            font-size: 8.5pt;
            font-style: italic;
            color: #475569;
        }

        .customer-card {
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            padding: 6px 10px;
            margin-bottom: 12px;
            background-color: #ffffff;
        }
        .customer-table {
            width: 100%;
            font-size: 8.5pt;
            border-collapse: collapse;
        }
        .customer-table td {
            padding: 2px 4px;
        }

        .items-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8pt;
            margin-bottom: 12px;
        }
        .items-table th {
            background-color: #1e293b;
            color: #ffffff;
            font-weight: bold;
            padding: 5px 6px;
            text-align: left;
            border: 1px solid #1e293b;
        }
        .items-table td {
            padding: 5px 6px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
        }
        .items-table tr:nth-child(even) td {
            background-color: #f8fafc;
        }

        .summary-section {
            width: 100%;
            margin-bottom: 15px;
            border-collapse: collapse;
        }
        .literal-container {
            width: 60%;
            vertical-align: top;
            padding-right: 15px;
        }
        .literal-box {
            border: 1px solid #cbd5e1;
            background-color: #f8fafc;
            padding: 8px 10px;
            border-radius: 4px;
            font-size: 8.5pt;
            font-style: italic;
        }
        .totals-container {
            width: 40%;
            vertical-align: top;
        }
        .totals-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 8.5pt;
        }
        .totals-table td {
            padding: 3px 6px;
            border-bottom: 1px solid #e2e8f0;
        }
        .totals-table tr.grand-total td {
            font-size: 10.5pt;
            font-weight: bold;
            color: #0f172a;
            border-top: 1.5px solid #0f172a;
            border-bottom: 2px solid #0f172a;
            background-color: #f1f5f9;
        }

        .bottom-section {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            border-top: 1px solid #cbd5e1;
            padding-top: 10px;
        }
        .qr-cell {
            width: 35mm;
            vertical-align: top;
            text-align: center;
        }
        .qr-img {
            width: 30mm;
            height: 30mm;
            min-width: 30mm;
            min-height: 30mm;
        }
        .legends-cell {
            vertical-align: middle;
            padding-left: 15px;
        }
        .legal-banner {
            font-size: 7.5pt;
            line-height: 1.35;
            text-align: center;
            margin-bottom: 5px;
        }
        .legal-banner.state {
            font-weight: bold;
            color: #0f172a;
        }
        .legal-banner.activity {
            color: #334155;
        }
        .legal-banner.system {
            font-size: 6.5pt;
            color: #64748b;
        }

        .watermark-banner {
            border: 2px solid #b91c1c;
            background-color: #fef2f2;
            color: #b91c1c;
            font-weight: bold;
            font-size: 9pt;
            padding: 6px;
            text-align: center;
            margin-bottom: 10px;
            text-transform: uppercase;
            border-radius: 4px;
        }
        .logo-img {
            max-width: 160px;
            max-height: 55px;
            margin-bottom: 6px;
        }
        .footer-attribution {
            text-align: center;
            font-size: 7pt;
            color: #94a3b8;
            margin-top: 12px;
        }
    </style>
</head>
<body>

    @if (!empty($fiscalStatus['watermark_text']))
        <div class="watermark-banner">
            {{ $fiscalStatus['watermark_text'] }}
        </div>
    @endif

    <!-- ENCABEZADO: EMISOR (IZQ) Y CAJA FISCAL (DER) -->
    <table class="header-table">
        <tr>
            <td class="issuer-info">
                @if (!empty($branding['logo_data_uri']))
                    <img src="{{ $branding['logo_data_uri'] }}" class="logo-img" alt="Logo"><br>
                @endif
                <div class="issuer-title">{{ $issuer['business_name'] }}</div>
                <div class="issuer-details">
                    <span class="bold">{{ $issuer['branch_name'] }}</span><br>
                    {{ $issuer['address'] }}<br>
                    @if (!empty($issuer['phone']))
                        Teléfono: {{ $issuer['phone'] }} | 
                    @endif
                    {{ $issuer['municipality'] }}
                </div>
            </td>
            <td class="fiscal-box-container">
                <div class="fiscal-box">
                    <div class="fiscal-box-nit">NIT: {{ $issuer['nit'] }}</div>
                    <div class="fiscal-box-num">FACTURA N° {{ $invoice['invoice_number'] }}</div>
                    <div class="fiscal-box-cuf-title">CÓD. AUTORIZACIÓN (CUF):</div>
                    <div class="fiscal-box-cuf">{{ $invoice['cuf'] }}</div>
                </div>
            </td>
        </tr>
    </table>

    <!-- TÍTULO DE LA FACTURA -->
    <div class="title-section">
        <div class="title-main">{{ $legends['title'] }}</div>
        <div class="title-sub">({{ $legends['subtitle'] }})</div>
    </div>

    <!-- DATOS DEL CLIENTE / RECEPTOR -->
    <div class="customer-card">
        <table class="customer-table">
            <tr>
                <td style="width: 18%;" class="bold">Fecha:</td>
                <td style="width: 42%;">{{ $invoice['issued_at_formatted'] }}</td>
                <td style="width: 18%;" class="bold">NIT / CI / CEX:</td>
                <td style="width: 22%;">{{ $buyer['document_full'] }}</td>
            </tr>
            <tr>
                <td class="bold">Nombre/Razón:</td>
                <td>{{ $buyer['name'] }}</td>
                <td class="bold">Punto de Venta:</td>
                <td>{{ $invoice['point_of_sale_code'] }}</td>
            </tr>
        </table>
    </div>

    <!-- TABLA DE DETALLES -->
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 14%;">Código</th>
                <th style="width: 10%; text-align: center;">Cantidad</th>
                <th style="width: 44%;">Descripción</th>
                <th style="width: 16%; text-align: right;">Precio Unitario</th>
                <th style="width: 16%; text-align: right;">Subtotal</th>
            </tr>
        </thead>
        <tbody>
            @foreach ($items as $item)
                <tr>
                    <td>{{ $item['product_code'] }}</td>
                    <td class="text-center">{{ $item['quantity'] }}</td>
                    <td>
                        {{ $item['description'] }}
                        @if ((float) $item['discount'] > 0)
                            <div style="font-size: 7pt; color: #64748b;">(Descuento: {{ $item['discount'] }})</div>
                        @endif
                    </td>
                    <td class="text-right">{{ $item['unit_price'] }}</td>
                    <td class="text-right">{{ $item['subtotal'] }}</td>
                </tr>
            @endforeach
        </tbody>
    </table>

    <!-- TOTALES Y MONTO LITERAL -->
    <table class="summary-section">
        <tr>
            <td class="literal-container">
                <div class="literal-box">
                    <span class="bold">Monto en Literal:</span><br>
                    {{ $totals['total_literal'] }}
                </div>
            </td>
            <td class="totals-container">
                <table class="totals-table">
                    <tr>
                        <td>Subtotal {{ $totals['currency_symbol'] }}:</td>
                        <td class="text-right">{{ $totals['subtotal'] }}</td>
                    </tr>
                    @if ((float) $totals['discount'] > 0)
                        <tr>
                            <td>Descuento {{ $totals['currency_symbol'] }}:</td>
                            <td class="text-right">{{ $totals['discount'] }}</td>
                        </tr>
                    @endif
                    @if ((float) $totals['additional_discount'] > 0)
                        <tr>
                            <td>Desc. Adicional {{ $totals['currency_symbol'] }}:</td>
                            <td class="text-right">{{ $totals['additional_discount'] }}</td>
                        </tr>
                    @endif
                    @if ((float) $totals['gift_card_amount'] > 0)
                        <tr>
                            <td>Monto Gift Card {{ $totals['currency_symbol'] }}:</td>
                            <td class="text-right">{{ $totals['gift_card_amount'] }}</td>
                        </tr>
                    @endif
                    <tr class="grand-total">
                        <td>Total a Pagar {{ $totals['currency_symbol'] }}:</td>
                        <td class="text-right">{{ $totals['total'] }}</td>
                    </tr>
                    <tr>
                        <td style="font-size: 7.5pt; color: #475569;">Importe Base Créd. Fiscal:</td>
                        <td class="text-right" style="font-size: 7.5pt; color: #475569;">{{ $totals['total_subject_to_vat'] }}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    <!-- SECCIÓN INFERIOR: QR Y LEYENDAS LEGALES OBLIGATORIAS -->
    <table class="bottom-section">
        <tr>
            <td class="qr-cell">
                <img src="{{ $qr['svg_base64'] }}" class="qr-img" alt="QR Fiscal">
            </td>
            <td class="legends-cell">
                <div class="legal-banner state">
                    "{{ $legends['state_legend'] }}"
                </div>
                @if (!empty($legends['activity_legend']))
                    <div class="legal-banner activity">
                        "{{ $legends['activity_legend'] }}"
                    </div>
                @endif
                <div class="legal-banner system">
                    "{{ $legends['system_legend'] }}"
                </div>
            </td>
        </tr>
    </table>

    <div class="footer-attribution">
        {{ $branding['app_attribution'] }}
    </div>

</body>
</html>
