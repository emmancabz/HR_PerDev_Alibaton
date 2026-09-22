<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>{{ $title }}</title>
    <style>
        body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; }
        header { border-bottom: 3px solid #f4b400; margin-bottom: 20px; padding-bottom: 12px; }
        h1 { font-size: 22px; margin: 0 0 6px; }
        p { color: #64748b; font-size: 12px; margin: 0; }
        table { border-collapse: collapse; font-size: 11px; margin-top: 18px; width: 100%; }
        th, td { border: 1px solid #cbd5e1; padding: 7px; text-align: left; vertical-align: top; }
        th { background: #f1f5f9; text-transform: uppercase; }
        @media print { .print-note { display: none; } body { margin: 12mm; } }
    </style>
</head>
<body>
<header>
    <p>{{ $organizationName }}</p>
    <h1>{{ $title }}</h1>
    <p>Generated {{ $generatedAt->format($dateFormat.' g:i A T') }} by {{ $generatedBy }} · {{ $rows->count() }} record(s)</p>
</header>
<p class="print-note">Open this file in a browser and choose Print → Save as PDF.</p>
<table>
    @if($rows->isNotEmpty())
        <thead><tr>@foreach(array_keys($rows->first()) as $column)<th>{{ str_replace('_', ' ', $column) }}</th>@endforeach</tr></thead>
        <tbody>@foreach($rows as $row)<tr>@foreach($row as $value)<td>{{ is_scalar($value) || is_null($value) ? $value : json_encode($value) }}</td>@endforeach</tr>@endforeach</tbody>
    @else
        <tbody><tr><td>No records match the selected scope.</td></tr></tbody>
    @endif
</table>
</body>
</html>
