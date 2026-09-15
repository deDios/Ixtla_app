<?php
declare(strict_types=1);

/** Normaliza una cifra para compararla sin depender del formato es-MX. */
function ixtla_insights_grounding_number(string $token): ?string
{
    $value = trim(str_replace(['%', "\u{00A0}", ' '], '', $token));
    if ($value === '') return null;

    if (str_contains($value, ',') && str_contains($value, '.')) {
        $value = str_replace(',', '', $value);
    } elseif (str_contains($value, ',')) {
        $parts = explode(',', $value);
        $value = count($parts) === 2 && strlen($parts[1]) === 3
            ? implode('', $parts)
            : str_replace(',', '.', $value);
    } elseif (substr_count($value, '.') === 1) {
        [$whole, $fraction] = explode('.', $value, 2);
        if ($whole !== '' && strlen($fraction) === 3) $value = $whole . $fraction;
    }

    if (!is_numeric($value)) return null;
    $number = (float) $value;
    if (!is_finite($number)) return null;
    return abs($number - round($number)) < 0.0000001
        ? (string) (int) round($number)
        : rtrim(rtrim(number_format($number, 8, '.', ''), '0'), '.');
}

/** @return list<array{token:string,value:string,offset:int}> */
function ixtla_insights_grounding_number_tokens(string $text): array
{
    // Los numerales al inicio de una linea son estructura de la respuesta.
    $text = preg_replace('/^\s*\d+[.)]\s+/mu', '', $text) ?? $text;
    // Una fecha contiene varios digitos, pero ninguno representa por si solo
    // una metrica. La fecha completa ya proviene de la fila autorizada.
    $text = preg_replace('/\b\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?\b/u', '', $text) ?? $text;
    $text = preg_replace('/\b\d{1,2}\/\d{1,2}\/\d{4}\b/u', '', $text) ?? $text;
    preg_match_all('/(?<![\pL\d])\d+(?:[.,]\d+)?%?(?![\pL\d])/u', $text, $matches, PREG_OFFSET_CAPTURE);
    $tokens = [];
    foreach ($matches[0] ?? [] as $match) {
        $token = (string) ($match[0] ?? '');
        $normalized = ixtla_insights_grounding_number($token);
        if ($normalized !== null) $tokens[] = ['token' => $token, 'value' => $normalized, 'offset' => (int) ($match[1] ?? 0)];
    }
    return $tokens;
}

/** @param array<string,list<array{evidence_id:string,path:string,kind:string}>> $index */
function ixtla_insights_grounding_index_value(mixed $value, string $evidenceId, string $path, array &$index, int &$visited): void
{
    if ($visited >= 10000) return;
    $visited++;
    if (is_array($value)) {
        // Los filtros explican el universo consultado, pero no prueban el valor
        // de una metrica. Se conservan en la procedencia, fuera del indice.
        if (str_starts_with($path, 'data.filters') || str_starts_with($path, 'data.scope')) return;
        foreach ($value as $key => $item) {
            ixtla_insights_grounding_index_value($item, $evidenceId, $path . '.' . (string) $key, $index, $visited);
        }
        return;
    }
    if (!is_int($value) && !is_float($value) && !is_string($value)) return;
    $leaf = strtolower((string) preg_replace('/^.*\./', '', $path));
    if (preg_match('/(?:version|expires|generated_at|created_at|updated_at|closed_at)$/', $leaf) === 1
        || in_array($leaf, ['query_id', 'period', 'date_field', 'date_basis', 'outcome', 'schema', 'scope'], true)) return;
    $kind = preg_match('/(?:^id$|_id$|^folio$|^status$|^calificacion$|^canal$|^label$)/', $leaf) === 1
        ? 'identifier'
        : 'value';
    foreach (ixtla_insights_grounding_number_tokens((string) $value) as $number) {
        $index[$number['value']] ??= [];
        if (count($index[$number['value']]) < 8) {
            $index[$number['value']][] = ['evidence_id' => $evidenceId, 'path' => $path, 'kind' => $kind];
        }
    }
}

/**
 * Construye procedencia compacta. No expone filas, comentarios ni contactos.
 *
 * @return array{version:int,sources:list<array<string,mixed>>}
 */
function ixtla_insights_grounding_manifest(array $toolEvidence): array
{
    $sources = [];
    foreach ($toolEvidence as $index => $item) {
        if (!is_array($item)) continue;
        $data = is_array($item['data'] ?? null) ? $item['data'] : [];
        $arguments = is_array($item['arguments'] ?? null) ? $item['arguments'] : [];
        $source = [
            'evidence_id' => 'e' . ($index + 1),
            'tool' => (string) ($item['tool'] ?? ''),
            'outcome' => (string) ($item['outcome'] ?? (($item['ok'] ?? false) ? 'success' : 'query_failed')),
            'period' => (string) ($arguments['period'] ?? $data['period'] ?? ''),
            'date_field' => (string) ($arguments['date_field'] ?? $data['date_field'] ?? ''),
            'date_basis' => (string) ($data['date_basis'] ?? ''),
            'scope' => is_string($data['scope'] ?? null)
                ? (string) $data['scope']
                : (string) (($data['scope']['label'] ?? '')),
        ];
        foreach (['query_id', 'total_matching', 'returned', 'has_more', 'generated_at', 'schema_version', 'contract_version'] as $key) {
            if (array_key_exists($key, $data) && (is_scalar($data[$key]) || $data[$key] === null)) $source[$key] = $data[$key];
        }
        $sources[] = $source;
    }
    return ['version' => 1, 'sources' => $sources];
}

/**
 * Valida que una respuesta de datos tenga evidencia exitosa y relaciona cada
 * cifra con rutas exactas de los resultados autorizados de la ronda.
 *
 * @return array{ok:bool,reason:string,claims:list<array<string,mixed>>,evidence:array}
 */
function ixtla_insights_validate_grounded_answer(string $answer, array $toolEvidence): array
{
    $manifest = ixtla_insights_grounding_manifest($toolEvidence);
    $successful = [];
    foreach ($toolEvidence as $index => $item) {
        if (is_array($item) && ($item['ok'] ?? false) === true) {
            $item['_evidence_id'] = 'e' . ($index + 1);
            $successful[] = $item;
        }
    }
    if ($successful === []) {
        return ['ok' => false, 'reason' => 'no_successful_evidence', 'claims' => [], 'evidence' => $manifest];
    }

    $hasCount = false;
    $hasPositiveResult = false;
    foreach ($successful as $item) {
        $data = is_array($item['data'] ?? null) ? $item['data'] : [];
        foreach (['total_matching', 'total', 'total_records'] as $key) {
            if (!array_key_exists($key, $data) || !is_numeric($data[$key])) continue;
            $hasCount = true;
            $hasPositiveResult = $hasPositiveResult || (float) $data[$key] > 0;
        }
    }
    if ($hasCount && $hasPositiveResult
        && preg_match('/\b(no hay|ningun(?:a|o)?|sin coincidencias|no se encontraron)\b/iu', $answer) === 1) {
        return ['ok' => false, 'reason' => 'contradictory_empty_result', 'claims' => [], 'evidence' => $manifest];
    }

    $numberIndex = [];
    $visited = 0;
    foreach ($successful as $item) {
        $evidenceId = (string) $item['_evidence_id'];
        ixtla_insights_grounding_index_value($item['data'] ?? [], $evidenceId, 'data', $numberIndex, $visited);
    }

    $claims = [];
    foreach (ixtla_insights_grounding_number_tokens($answer) as $number) {
        $integer = ctype_digit($number['value']) ? (int) $number['value'] : null;
        $prefixStart = max(0, $number['offset'] - 35);
        $prefix = mb_strtolower(substr($answer, $prefixStart, $number['offset'] - $prefixStart), 'UTF-8');
        $expectsIdentifier = preg_match('/\b(folio|identificador|id)\s*(?:numero|n[uú]mero|#)?\s*$/u', $prefix) === 1;
        $sources = array_values(array_filter(
            $numberIndex[$number['value']] ?? [],
            static fn (array $source): bool => ($source['kind'] ?? 'value') === ($expectsIdentifier ? 'identifier' : 'value')
        ));
        if ($sources === [] && $integer !== null && $integer >= 1900 && $integer <= 2100) continue;
        if ($sources === []) {
            return ['ok' => false, 'reason' => 'ungrounded_numeric_token', 'claims' => $claims, 'evidence' => $manifest];
        }
        $claims[] = [
            'token' => $number['token'],
            'value' => $number['value'],
            'sources' => $sources,
        ];
    }

    return ['ok' => true, 'reason' => 'grounded', 'claims' => $claims, 'evidence' => $manifest];
}
