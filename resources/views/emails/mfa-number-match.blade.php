<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Alibaton sign-in request</title>
</head>
<body style="margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#f5f6f8;">
    <tr>
        <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
                <tr>
                    <td style="padding:30px 32px 12px;text-align:center;">
                        <div style="font-size:13px;font-weight:700;letter-spacing:.14em;color:#b77900;text-transform:uppercase;">Alibaton Security</div>
                        <h1 style="margin:14px 0 6px;font-size:24px;line-height:1.25;">Sign-in request</h1>
                        <p style="margin:0;color:#64748b;font-size:14px;line-height:1.6;">
                            Hi {{ $accountName }}, select the number currently shown on the device where you started signing in.
                        </p>
                    </td>
                </tr>
                <tr>
                    <td style="padding:20px 32px 10px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                                @foreach ($choices as $choice)
                                    <td width="33.33%" align="center" style="padding:6px;">
                                        <a href="{{ $choice['url'] }}" style="display:block;text-decoration:none;background:#111827;color:#ffffff;border-radius:12px;padding:16px 6px;font-size:24px;font-weight:800;letter-spacing:.08em;">
                                            {{ $choice['value'] }}
                                        </a>
                                    </td>
                                @endforeach
                            </tr>
                        </table>
                    </td>
                </tr>
                <tr>
                    <td style="padding:8px 38px 8px;text-align:center;">
                        <a href="{{ $denyUrl }}" style="display:block;text-decoration:none;border:1px solid #fecaca;background:#fff;color:#b91c1c;border-radius:12px;padding:13px 16px;font-size:14px;font-weight:700;">
                            This wasn't me
                        </a>
                    </td>
                </tr>
                <tr>
                    <td style="padding:10px 32px 30px;text-align:center;">
                        <p style="margin:0 0 8px;color:#475569;font-size:12px;line-height:1.6;">
                            Requested {{ $requestedAt->format('M j, Y · g:i A') }} · IP {{ $requestIp ?: 'Unavailable' }}
                        </p>
                        <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
                            Selecting a number opens a confirmation screen; it does not approve the request by itself. This request expires at {{ $expiresAt->format('g:i A') }}. If you did not start this sign-in, use “This wasn't me” directly—do not select a number.
                        </p>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>
</body>
</html>
