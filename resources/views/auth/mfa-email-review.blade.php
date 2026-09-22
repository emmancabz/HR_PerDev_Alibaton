<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Review sign-in request</title>
    <style>
        body{margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}
        .card{width:min(460px,100%);background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:30px;box-shadow:0 12px 30px rgba(15,23,42,.06)}
        .eyebrow{font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#b77900;text-align:center}
        h1{margin:10px 0 6px;text-align:center;font-size:23px}.muted{color:#64748b;line-height:1.6;font-size:14px;text-align:center;margin:0}
        .number{margin:24px 0 18px;background:#020617;color:#fff;border-radius:16px;padding:24px;text-align:center;font-size:48px;font-weight:900;letter-spacing:.18em}
        .details{border:1px solid #e5e7eb;border-radius:14px;padding:14px 16px;font-size:13px;line-height:1.7;color:#475569}.details strong{color:#0f172a}
        .warning{margin:14px 0;border-radius:12px;background:#fff7ed;color:#9a3412;padding:12px 14px;font-size:13px;line-height:1.55}
        button{width:100%;border:0;border-radius:12px;padding:12px 14px;font-weight:700;font-size:14px;cursor:pointer}.confirm{margin-top:16px;background:#111827;color:#fff}.deny{margin-top:10px;background:#fff;border:1px solid #e5e7eb;color:#b91c1c}
    </style>
</head>
<body>
<div class="card">
    <div class="eyebrow">Alibaton Security</div>
    <h1>Confirm sign-in request</h1>
    <p class="muted">Only approve this if the same number is currently shown on the device where you started signing in.</p>

    <div class="number">{{ $selectedChoice }}</div>

    <div class="details">
        <div><strong>Account:</strong> {{ $accountName }}</div>
        <div><strong>Requested:</strong> {{ $requestedAt->format('M j, Y · g:i A') }}</div>
        <div><strong>Request IP:</strong> {{ $requestIp ?: 'Unavailable' }}</div>
        <div><strong>Expires:</strong> {{ $expiresAt->format('g:i A') }}</div>
    </div>

    <div class="warning">Opening this page did not approve anything. Confirmation below is required. If you did not start this sign-in, deny it.</div>

    <form method="POST" action="{{ $confirmUrl }}">
        @csrf
        <button class="confirm" type="submit">Confirm {{ $selectedChoice }}</button>
    </form>

    <form method="POST" action="{{ $denyUrl }}">
        @csrf
        <button class="deny" type="submit">This wasn't me — deny request</button>
    </form>
</div>
</body>
</html>
