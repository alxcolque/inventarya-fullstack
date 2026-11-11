<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Confirmación de eliminación de cuenta - Inventarya</title>
</head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#fff;border-radius:16px;border:1px solid #e4e4e7;overflow:hidden">
                    <tr>
                        <td style="padding:28px 32px;background:#18181b;color:#fff">
                            <h2 style="margin:0;font-size:20px;font-weight:700;letter-spacing:-0.5px">INVENTARYA</h2>
                            <p style="margin:4px 0 0;font-size:12px;color:#a1a1aa">Gestión de Cuentas y Privacidad de Datos</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:32px">
                            <p style="margin:0 0 8px;color:#52525b;font-size:14px">Estimado/a <strong>{{ $recipientName }}</strong>,</p>
                            <h1 style="margin:0 0 16px;font-size:22px;color:#18181b">Confirmación de solicitud de eliminación de cuenta</h1>
                            
                            <p style="margin:0 0 16px;line-height:1.6;color:#52525b;font-size:14px">
                                Hemos recibido una solicitud para eliminar la cuenta asociada al correo <strong>{{ $email }}</strong> en la organización <strong>{{ $tenantName }}</strong>.
                            </p>

                            <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:14px 16px;border-radius:8px;margin-bottom:20px">
                                <p style="margin:0 0 6px;font-weight:700;color:#991b1b;font-size:13px">Ticket de solicitud: {{ $ticket }}</p>
                                <p style="margin:0;color:#7f1d1d;font-size:12px;line-height:1.5">
                                    @if ($isOwner)
                                        <strong>Atención Propietario:</strong> Al ser propietario de la organización, la eliminación de su cuenta personal requiere verificar la titularidad. Los datos comerciales de la empresa no se borrarán automáticamente para salvaguardar la continuidad del negocio y el cumplimiento legal.
                                    @else
                                        <strong>Cuenta de Empleado/Colaborador:</strong> Al confirmar, se revocarán todos sus accesos, sesiones y datos de perfil. Los registros de ventas y operaciones comerciales se conservarán archivados conforme a las obligaciones legales de la empresa.
                                    @endif
                                </p>
                            </div>

                            <p style="margin:0 0 24px;line-height:1.6;color:#52525b;font-size:14px">
                                Para confirmar que usted es el titular y autorizar este procedimiento, haga clic en el siguiente botón:
                            </p>

                            <div style="text-align:center;margin:28px 0">
                                <a href="{{ $verificationUrl }}" style="display:inline-block;padding:14px 28px;background:#dc2626;color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;box-shadow:0 2px 4px rgba(220,38,38,0.25)">
                                    Confirmar Eliminación de Cuenta
                                </a>
                            </div>

                            <p style="margin:24px 0 8px;font-size:12px;line-height:1.5;color:#71717a">
                                Si el botón no funciona, copie y pegue el siguiente enlace en su navegador:
                            </p>
                            <p style="margin:0 0 24px;font-size:11px;word-break:break-all;color:#006fee">
                                <a href="{{ $verificationUrl }}" style="color:#006fee;text-decoration:underline">{{ $verificationUrl }}</a>
                            </p>

                            <hr style="border:0;border-top:1px solid #e4e4e7;margin:24px 0">

                            <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a">
                                <strong>Validez:</strong> Este enlace expirará el <strong>{{ $expiresAt }}</strong> (válido por 48 horas). Si usted no solicitó la eliminación de su cuenta, desestime este mensaje. Su cuenta permanecerá segura y activa.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:16px 32px;background:#f4f4f5;border-top:1px solid #e4e4e7;text-align:center;font-size:11px;color:#a1a1aa">
                            © {{ date('Y') }} Inventarya. Todos los derechos reservados. Cumplimiento de políticas de privacidad y protección de datos de Google Play.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
