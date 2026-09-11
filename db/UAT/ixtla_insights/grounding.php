<?php
declare(strict_types=1);

/**
 * Valida que una respuesta de datos tenga evidencia exitosa y que sus cifras
 * aparezcan en los resultados autorizados de la ronda.
 *
 * @return array{ok:bool,reason:string}
 */
function ixtla_insights_validate_grounded_answer(string $answer, array $toolEvidence): array
{
    $successful = array_values(array_filter(
        $toolEvidence,
        static fn (mixed $item): bool => is_array($item) && ($item['ok'] ?? false) === true
    ));
    if ($successful === []) {
        return ['ok' => false, 'reason' => 'no_successful_evidence'];
    }

    $evidenceText = json_encode($successful, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if (!is_string($evidenceText)) {
        return ['ok' => false, 'reason' => 'evidence_serialization_failed'];
    }

    $hasTotalMatching = false;
    $hasPositiveResult = false;
    foreach ($successful as $item) {
        $data = is_array($item['data'] ?? null) ? $item['data'] : [];
        if (array_key_exists('total_matching', $data)) {
            $hasTotalMatching = true;
            $hasPositiveResult = $hasPositiveResult || (int) $data['total_matching'] > 0;
        }
    }
    if ($hasTotalMatching && $hasPositiveResult
        && preg_match('/\b(no hay|ningun(?:a|o)?|sin coincidencias|no se encontraron)\b/iu', $answer) === 1) {
        return ['ok' => false, 'reason' => 'contradictory_empty_result'];
    }

    preg_match_all('/(?<![\pL])(?:\d{2,}(?:[.,]\d+)?%?|\d+(?:[.,]\d+)%)(?![\pL])/u', $answer, $matches);
    foreach (array_unique($matches[0] ?? []) as $token) {
        $canonical = str_replace([',', '%'], '', $token);
        $variants = [$token, $canonical];
        if (str_contains($canonical, '.')) {
            $variants[] = str_replace('.', ',', $canonical);
        }
        $found = false;
        foreach ($variants as $variant) {
            if (str_contains($evidenceText, $variant)) {
                $found = true;
                break;
            }
        }
        // Años y límites temporales no son métricas inventadas.
        $integer = (int) preg_replace('/\D+/', '', $canonical);
        if (!$found && $integer >= 1900 && $integer <= 2100) {
            $found = true;
        }
        if (!$found) {
            return ['ok' => false, 'reason' => 'ungrounded_numeric_token'];
        }
    }

    return ['ok' => true, 'reason' => 'grounded'];
}
