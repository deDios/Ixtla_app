<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/conversation_state.php';

ixtla_insights_bootstrap(['POST']);
$body = ixtla_insights_request_body();
$action = trim((string) ($body['action'] ?? 'get'));
if (!in_array($action, ['get', 'save', 'delete'], true)) {
    ixtla_insights_json(['ok' => false, 'error' => 'La accion del borrador no es valida.'], 422);
}

ixtla_insights_conversation_start();
$owner = (string) (ixtla_insights_scope()['empleado_id'] ?? 'anonymous');
$key = 'visualization_draft:' . $owner;

if ($action === 'delete') {
    unset($_SESSION[$key]);
    ixtla_insights_json(['ok' => true, 'deleted' => true]);
}
if ($action === 'get') {
    $stored = is_array($_SESSION[$key] ?? null) ? $_SESSION[$key] : [];
    $expired = (int) ($stored['updated_at'] ?? 0) < time() - 21600;
    if ($expired) unset($_SESSION[$key]);
    ixtla_insights_json(['ok' => true, 'draft' => $expired ? null : ($stored['draft'] ?? null)]);
}

$draft = is_array($body['draft'] ?? null) ? $body['draft'] : null;
$allowedModes = ['topic_selection', 'planner_clarification', 'structured_visualization', 'natural_visualization', 'preset_visualization', 'preview_edit', 'kpi_kit', 'single_kpi', 'free_visualization', 'remote_visualization', 'guided'];
if (!is_array($draft) || !in_array((string) ($draft['mode'] ?? ''), $allowedModes, true)) {
    ixtla_insights_json(['ok' => false, 'error' => 'El borrador de visualizacion no es valido.'], 422);
}
$encoded = json_encode($draft, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if (!is_string($encoded) || strlen($encoded) > 24000) {
    ixtla_insights_json(['ok' => false, 'error' => 'El borrador excede el tamaño permitido.'], 422);
}
$_SESSION[$key] = ['updated_at' => time(), 'draft' => json_decode($encoded, true)];
ixtla_insights_json(['ok' => true, 'saved' => true]);
