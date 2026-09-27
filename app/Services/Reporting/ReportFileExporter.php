<?php

namespace App\Services\Reporting;

use Illuminate\Support\Collection;

final class ReportFileExporter
{
    public function pdf(Collection $rows, string $title, array $metadata = []): string
    {
        $records = $rows->values()->map(fn ($row) => (array) $row)->all();
        $headers = array_keys($records[0] ?? []);
        $lines = [$title];

        foreach ($metadata as $label => $value) {
            if ($value !== null && $value !== '') $lines[] = $label.': '.$this->scalar($value);
        }

        $lines[] = '';
        if ($headers !== []) {
            $lines[] = implode(' | ', array_map(fn ($header) => $this->label((string) $header), $headers));
            $lines[] = str_repeat('-', 132);
            foreach ($records as $row) {
                $line = implode(' | ', array_map(fn ($header) => $this->scalar($row[$header] ?? null), $headers));
                foreach (explode("\n", wordwrap($line, 132, "\n", true)) as $wrapped) $lines[] = $wrapped;
            }
        } else {
            $lines[] = 'No records in the selected report scope.';
        }

        $pages = array_chunk($lines, 42) ?: [['No report data.']];
        $objects = [
            1 => '<< /Type /Catalog /Pages 2 0 R >>',
            3 => '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
        ];
        $kids = [];

        foreach ($pages as $index => $pageLines) {
            $pageId = 4 + ($index * 2);
            $contentId = $pageId + 1;
            $kids[] = $pageId.' 0 R';
            $commands = ['BT', '/F1 8 Tf', '30 560 Td', '11 TL'];
            foreach ($pageLines as $lineIndex => $line) {
                if ($lineIndex > 0) $commands[] = 'T*';
                $commands[] = '('.$this->pdfEscape($line).') Tj';
            }
            $commands[] = 'ET';
            $stream = implode("\n", $commands)."\n";
            $objects[$pageId] = sprintf(
                '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents %d 0 R >>',
                $contentId,
            );
            $objects[$contentId] = "<< /Length ".strlen($stream)." >>\nstream\n".$stream."endstream";
        }

        $objects[2] = '<< /Type /Pages /Kids ['.implode(' ', $kids).'] /Count '.count($kids).' >>';
        ksort($objects);

        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [0];
        foreach ($objects as $id => $object) {
            $offsets[$id] = strlen($pdf);
            $pdf .= $id." 0 obj\n".$object."\nendobj\n";
        }
        $xref = strlen($pdf);
        $size = max(array_keys($objects)) + 1;
        $pdf .= "xref\n0 ".$size."\n0000000000 65535 f \n";
        for ($id = 1; $id < $size; $id++) $pdf .= sprintf("%010d 00000 n \n", $offsets[$id] ?? 0);
        $pdf .= "trailer\n<< /Size ".$size." /Root 1 0 R >>\nstartxref\n".$xref."\n%%EOF";

        return $pdf;
    }

    public function xlsx(Collection $rows, string $sheetName = 'Report'): string
    {
        $records = $rows->values()->map(fn ($row) => (array) $row)->all();
        $headers = array_keys($records[0] ?? []);
        $sheetRows = [];
        $rowNumber = 1;

        if ($headers !== []) {
            $cells = [];
            foreach ($headers as $columnIndex => $header) {
                $reference = $this->columnName($columnIndex + 1).$rowNumber;
                $cells[] = '<c r="'.$reference.'" s="1" t="inlineStr"><is><t>'.$this->xml($this->label((string) $header)).'</t></is></c>';
            }
            $sheetRows[] = '<row r="'.$rowNumber.'">'.implode('', $cells).'</row>';
            $rowNumber++;

            foreach ($records as $record) {
                $cells = [];
                foreach ($headers as $columnIndex => $header) {
                    $reference = $this->columnName($columnIndex + 1).$rowNumber;
                    $cells[] = '<c r="'.$reference.'" t="inlineStr"><is><t xml:space="preserve">'.$this->xml($this->scalar($record[$header] ?? null)).'</t></is></c>';
                }
                $sheetRows[] = '<row r="'.$rowNumber.'">'.implode('', $cells).'</row>';
                $rowNumber++;
            }
        }

        $safeSheetName = mb_substr(preg_replace('/[\\\/?*\[\]:]+/u', ' ', $sheetName) ?: 'Report', 0, 31);
        $files = [
            '[Content_Types].xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
            '_rels/.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
            'xl/workbook.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'.$this->xml($safeSheetName).'" sheetId="1" r:id="rId1"/></sheets></workbook>',
            'xl/_rels/workbook.xml.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
            'xl/styles.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>',
            'xl/worksheets/sheet1.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'.implode('', $sheetRows).'</sheetData>'.($headers !== [] ? '<autoFilter ref="A1:'.$this->columnName(count($headers)).'1"/>' : '').'</worksheet>',
        ];

        return $this->zip($files);
    }

    private function zip(array $files): string
    {
        $body = '';
        $central = '';
        $offset = 0;
        $count = 0;

        foreach ($files as $name => $data) {
            $name = str_replace('\\', '/', $name);
            $crc = crc32($data);
            $size = strlen($data);
            $nameLength = strlen($name);
            $local = pack('VvvvvvVVVvv', 0x04034b50, 20, 0, 0, 0, 0, $crc, $size, $size, $nameLength, 0).$name.$data;
            $body .= $local;
            $central .= pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, 0, 0, 0, 0, $crc, $size, $size, $nameLength, 0, 0, 0, 0, 0, $offset).$name;
            $offset += strlen($local);
            $count++;
        }

        return $body.$central.pack('VvvvvVVv', 0x06054b50, 0, 0, $count, $count, strlen($central), strlen($body), 0);
    }

    private function scalar(mixed $value): string
    {
        if ($value === null || $value === '') return '';
        if (is_bool($value)) return $value ? 'Yes' : 'No';
        if (is_scalar($value)) return (string) $value;

        return json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '';
    }

    private function label(string $value): string
    {
        return ucwords(str_replace('_', ' ', $value));
    }

    private function pdfEscape(string $value): string
    {
        $value = preg_replace('/\s+/u', ' ', trim($value)) ?? '';
        $encoded = iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $value);
        if ($encoded === false) $encoded = preg_replace('/[^\x20-\x7E]/', '?', $value) ?? '';

        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $encoded);
    }

    private function xml(string $value): string
    {
        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $value) ?? '';

        return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    private function columnName(int $number): string
    {
        $name = '';
        while ($number > 0) {
            $number--;
            $name = chr(65 + ($number % 26)).$name;
            $number = intdiv($number, 26);
        }

        return $name;
    }
}
