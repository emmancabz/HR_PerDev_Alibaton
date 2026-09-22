<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $approved ? 'Sign-in approved' : 'Sign-in not approved' }}</title>
    <style>
        body{margin:0;background:#f5f6f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}
        .card{width:min(420px,100%);background:#fff;border:1px solid #e5e7eb;border-radius:18px;padding:30px;text-align:center;box-shadow:0 12px 30px rgba(15,23,42,.06)}
        .mark{width:58px;height:58px;border-radius:50%;display:grid;place-items:center;margin:0 auto 18px;font-size:28px;font-weight:800;background:{{ $approved ? '#ecfdf5' : '#fff7ed' }};color:{{ $approved ? '#047857' : '#c2410c' }}}
        h1{margin:0;font-size:23px}.muted{color:#64748b;line-height:1.6;font-size:14px;margin:10px 0 0}.close{margin-top:18px;border:1px solid #e2e8f0;background:#fff;color:#334155;border-radius:10px;padding:10px 16px;font-weight:700;cursor:pointer}
    </style>
</head>
<body>
<div class="card">
    <div class="mark">{{ $approved ? '✓' : '!' }}</div>
    <h1>{{ $approved ? 'Sign-in approved' : 'Sign-in not approved' }}</h1>
    <p class="muted">{{ $message }}</p>
    <button type="button" class="close" onclick="window.close()">Close this tab</button>
</div>
<script>
    // Gmail and most mail clients open approval links in a disposable tab.
    // Close it after the explicit action; the original sign-in tab independently
    // observes the server state and redirects to Dashboard or Login.
    window.setTimeout(() => {
        window.close();
    }, 350);
</script>
</body>
</html>
