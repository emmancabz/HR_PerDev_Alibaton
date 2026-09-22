<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Deny sign-in request</title>
    <style>
        body{margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}
        .card{width:min(440px,100%);background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:28px;box-shadow:0 12px 30px rgba(15,23,42,.06)}
        .brand{text-align:center;color:#b77900;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}.title{text-align:center;font-size:23px;margin:10px 0 6px}.muted{text-align:center;color:#64748b;font-size:14px;line-height:1.6;margin:0}.meta{margin:22px 0 14px;border:1px solid #e2e8f0;border-radius:12px;padding:14px;font-size:13px;line-height:1.65}.warn{margin:0 0 16px;border-radius:12px;background:#fff7ed;color:#9a3412;padding:12px 14px;font-size:13px;line-height:1.55}.deny{width:100%;border:0;border-radius:10px;background:#b91c1c;color:#fff;padding:12px 16px;font-weight:800;cursor:pointer}.cancel{width:100%;margin-top:9px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;color:#334155;padding:11px 16px;font-weight:700;cursor:pointer}
    </style>
</head>
<body>
<div class="card">
    <div class="brand">Alibaton Security</div>
    <h1 class="title">Wasn't you?</h1>
    <p class="muted">Deny this request only if you did not start the sign-in.</p>

    <div class="meta">
        <div><strong>Account:</strong> {{ $accountName }}</div>
        <div><strong>Requested:</strong> {{ $requestedAt->format('M j, Y · g:i A') }}</div>
        <div><strong>Request IP:</strong> {{ $requestIp ?: 'Unavailable' }}</div>
        <div><strong>Expires:</strong> {{ $expiresAt->format('g:i A') }}</div>
    </div>

    <p class="warn">Opening this page did not deny anything. Confirm below so automated email scanners cannot cancel a legitimate sign-in request.</p>

    <form method="POST" action="{{ $denyUrl }}">
        @csrf
        <button type="submit" class="deny">Deny sign-in request</button>
    </form>
    <button type="button" class="cancel" onclick="window.close()">Keep request and close</button>
</div>
</body>
</html>
