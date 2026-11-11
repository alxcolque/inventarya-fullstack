<!doctype html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Activa tu cuenta</title>
</head>
<body style="margin:0;background:#f4f4f5;font-family:Arial,sans-serif;color:#18181b">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px">
        <tr>
            <td align="center">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:16px;border:1px solid #e4e4e7;overflow:hidden">
                    <tr>
                        <td style="padding:32px">
                            <p style="margin:0 0 8px;color:#52525b;font-size:14px">Hola, {{ $recipientName }}</p>
                            <h1 style="margin:0 0 16px;font-size:24px">Activa tu cuenta en {{ $tenantName }}</h1>
                            <p style="margin:0 0 24px;line-height:1.6;color:#52525b">
                                {{ $invitedByName }} te invitó a formar parte de su equipo. Define tu contraseña para completar la activación.
                            </p>
                            <a href="{{ $activationUrl }}" style="display:inline-block;padding:12px 20px;background:#006fee;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">
                                Activar mi cuenta
                            </a>
                            <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#71717a">
                                Este enlace vence el {{ $expiresAt }} y puede utilizarse una sola vez. Si no esperabas esta invitación, ignora este correo.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
