<?php

namespace App\Http\Controllers;

use App\Models\SystemSetting;
use App\Services\Reporting\CrossModuleReportService;
use App\Support\ReadModelCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportsStateController extends Controller
{
    public function __construct(private readonly CrossModuleReportService $reports) {}

    public function show(Request $request): JsonResponse
    {
        $filters = $this->filters($request);
        $data = ReadModelCache::rememberRequest(
            'reports',
            $request->user(),
            $request,
            fn (): array => $this->reports->state($request->user(), $filters),
            $filters,
        );

        return response()->json(['data' => $data]);
    }

    public function export(Request $request, string $report, string $format): StreamedResponse
    {
        abort_unless(in_array($format, ['csv', 'excel', 'json', 'print'], true), 404);
        $filters = $this->filters($request);
        $rows = $this->reports->rows($request->user(), $report, $filters);
        $this->reports->recordExport($request->user(), $report, $format, $filters, $rows->count());
        $defaults = config('governance.settings');
        $storedPrefix = SystemSetting::query()->where('setting_key', 'reporting.filename_prefix')->first()?->value;
        $prefixValue = is_array($storedPrefix) ? ($storedPrefix['value'] ?? null) : null;
        $prefix = preg_replace('/[^a-z0-9-]+/i', '-', (string) ($prefixValue ?: ($defaults['reporting.filename_prefix'] ?? 'alibaton-pd')));

        if ($format === 'json') {
            return response()->streamDownload(
                fn () => print json_encode($rows->values()->all(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES),
                "{$prefix}-{$report}.json",
                ['Content-Type' => 'application/json; charset=UTF-8'],
            );
        }

        if ($format === 'excel') {
            return response()->streamDownload(function () use ($rows): void {
                $escape = static fn ($value): string => htmlspecialchars(
                    is_scalar($value) || $value === null ? (string) $value : json_encode($value),
                    ENT_QUOTES | ENT_XML1,
                    'UTF-8',
                );
                $first = $rows->first();
                echo '<html><head><meta charset="UTF-8"></head><body><table border="1">';
                if ($first !== null) {
                    echo '<thead><tr>';
                    foreach (array_keys($first) as $heading) echo '<th>'.$escape($heading).'</th>';
                    echo '</tr></thead><tbody>';
                    foreach ($rows as $row) {
                        echo '<tr>';
                        foreach ($row as $value) echo '<td>'.$escape($value).'</td>';
                        echo '</tr>';
                    }
                    echo '</tbody>';
                }
                echo '</table></body></html>';
            }, "{$prefix}-{$report}.xls", [
                'Content-Type' => 'application/vnd.ms-excel; charset=UTF-8',
            ]);
        }

        if ($format === 'print') {
            $stored = SystemSetting::query()->get()->mapWithKeys(fn (SystemSetting $setting) => [
                $setting->setting_key => $setting->value['value'] ?? null,
            ]);
            $timezone = (string) ($stored->get('organization.timezone') ?: ($defaults['organization.timezone'] ?? 'Asia/Manila'));
            $html = view('reports.print', [
                'title' => CrossModuleReportService::REPORTS[$report], 'rows' => $rows,
                'organizationName' => $stored->get('organization.name') ?: ($defaults['organization.name'] ?? 'Alibaton Construction Incorporated'),
                'dateFormat' => $stored->get('organization.date_format') ?: ($defaults['organization.date_format'] ?? 'M d, Y'),
                'generatedAt' => now()->timezone($timezone), 'generatedBy' => $request->user()->name,
            ])->render();
            return response()->streamDownload(fn () => print $html, "{$prefix}-{$report}.html", ['Content-Type' => 'text/html']);
        }

        return response()->streamDownload(function () use ($rows): void {
            $output = fopen('php://output', 'wb');
            $first = $rows->first();
            if ($first !== null) {
                fputcsv($output, array_keys($first), ',', '"', '');
                foreach ($rows as $row) fputcsv($output, array_map(fn ($value) => is_scalar($value) || $value === null ? $value : json_encode($value), $row), ',', '"', '');
            }
            fclose($output);
        }, "{$prefix}-{$report}.csv", ['Content-Type' => 'text/csv']);
    }

    private function filters(Request $request): array
    {
        return $request->validate([
            'report' => ['nullable', 'string'], 'department' => ['nullable', 'string', 'max:120'],
            'date_from' => ['nullable', 'date'], 'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
        ]);
    }
}
