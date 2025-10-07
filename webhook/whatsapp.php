<?php
// /webhook/whatsapp.php

// 1) Verificación (GET)
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $verify_token_conf = getenv('WHATSAPP_VERIFY_TOKEN') ?: 'webhook_token_4855797';
  $mode = $_GET['hub_mode'] ?? '';
  $token = $_GET['hub_verify_token'] ?? '';
  $challenge = $_GET['hub_challenge'] ?? '';

  if ($mode === 'subscribe' && $token === $verify_token_conf) {
    http_response_code(200);
    echo $challenge;
    exit;
  }
  http_response_code(403);
  exit;
}

header('Content-Type: application/json; charset=utf-8');

// (opcional) Límite de tamaño del body (ej. 256 KB)
$maxBytes = 256 * 1024;
$raw = file_get_contents('php://input', false, null, 0, $maxBytes+1);
if ($raw === false || strlen($raw) > $maxBytes) {
  http_response_code(413); // Payload Too Large
  echo json_encode(["ok"=>false, "error"=>"Body too large"]);
  exit;
}

// (opcional recomendado) Validar firma HMAC de Meta
// $appSecret = getenv('APP_SECRET') ?: '';
// $sigHeader = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
// if ($appSecret && $sigHeader) {
//   if (!preg_match('/^sha256=([a-f0-9]{64})$/i', $sigHeader, $m)) {
//     http_response_code(401); echo json_encode(["ok"=>false,"error"=>"Bad signature format"]); exit;
//   }
//   $expected = 'sha256=' . hash_hmac('sha256', $raw, $appSecret);
//   if (!hash_equals($expected, $sigHeader)) {
//     http_response_code(401); echo json_encode(["ok"=>false,"error"=>"Invalid signature"]); exit;
//   }
// }

$body = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE) {
  http_response_code(400);
  echo json_encode(["ok"=>false, "error"=>"Invalid JSON"]);
  exit;
}

// 3) Conecta a DB
include_once __DIR__ . '/../db/conn/conexion.php';
$con = conectar();
if (!$con) { http_response_code(500); echo json_encode(["ok"=>false,"error"=>"DB down"]); exit; }
$con->set_charset('utf8mb4');

// Helpers
function upsert_contact(mysqli $con, string $wa_phone, ?string $name) : int {
  $s = $con->prepare("SELECT id FROM contacts WHERE wa_phone=? LIMIT 1");
  $s->bind_param('s', $wa_phone);
  $s->execute();
  $id = $s->get_result()->fetch_assoc()['id'] ?? null;
  $s->close();

  if ($id) return (int)$id;

  $s = $con->prepare("INSERT INTO contacts(wa_phone,name) VALUES(?,?)");
  $s->bind_param('ss', $wa_phone, $name);
  $s->execute();
  $new_id = (int)$s->insert_id;
  $s->close();
  return $new_id;
}

function get_or_open_conversation(mysqli $con, int $contact_id) : int {
  $s = $con->prepare("SELECT id FROM conversations WHERE contact_id=? AND status!='closed' LIMIT 1");
  $s->bind_param('i', $contact_id);
  $s->execute();
  $row = $s->get_result()->fetch_assoc();
  $s->close();

  if ($row) return (int)$row['id'];

  $s = $con->prepare("INSERT INTO conversations(contact_id,status) VALUES(?, 'open')");
  $s->bind_param('i', $contact_id);
  $s->execute();
  $cid = (int)$s->insert_id;
  $s->close();
  return $cid;
}

// 4) Procesa entries/changes (maneja múltiples eventos en un POST)
$entries = $body['entry'] ?? [];
foreach ($entries as $entry) {
  $changes = $entry['changes'] ?? [];
  foreach ($changes as $change) {
    $value = $change['value'] ?? [];

    // A) MENSAJES ENTRANTES
    $messages = $value['messages'] ?? [];
    $contacts = $value['contacts'] ?? [];

    foreach ($messages as $idx => $m) {
      $type = $m['type'] ?? '';
      $from = $m['from'] ?? null; // E.164 sin '+'
      if (!$from) continue;

      $name = $contacts[$idx]['profile']['name'] ?? ($contacts[0]['profile']['name'] ?? null);

      $contact_id = upsert_contact($con, $from, $name);
      $conv_id = get_or_open_conversation($con, $contact_id);

      $waid = $m['id'] ?? null;
      $raw_msg = json_encode($m, JSON_UNESCAPED_UNICODE);

      switch ($type) {
        case 'text':
          $text = $m['text']['body'] ?? '';
          // Idempotencia por wa_message_id único (usa INSERT IGNORE)
          $sql = "INSERT IGNORE INTO messages(conversation_id, direction, wa_message_id, msg_type, text, raw_json)
                  VALUES(?, 'in', ?, 'text', ?, ?)";
          $s = $con->prepare($sql);
          $s->bind_param('isss', $conv_id, $waid, $text, $raw_msg);
          $s->execute(); $s->close();
          break;

        default:
          $genericText = "[tipo:$type] evento recibido";
          $sql = "INSERT IGNORE INTO messages(conversation_id, direction, wa_message_id, msg_type, text, raw_json)
                  VALUES(?, 'in', ?, 'text', ?, ?)";
          $s = $con->prepare($sql);
          $s->bind_param('isss', $conv_id, $waid, $genericText, $raw_msg);
          $s->execute(); $s->close();
          break;
      }

      // Actualiza último entrante
      $s = $con->prepare("UPDATE conversations SET last_incoming_at=NOW(), updated_at=NOW() WHERE id=?");
      $s->bind_param('i', $conv_id);
      $s->execute(); $s->close();
    }

    // B) ESTADOS (delivered/read/etc) — opcional
    $statuses = $value['statuses'] ?? [];
    foreach ($statuses as $st) {
      // Aquí podrías insertar en una tabla de estados si decides llevar tracking granular.
      // Ejemplo: $st['status'], $st['id'] (wa_message_id), $st['timestamp'], $st['recipient_id']...
    }
  }
}

$con->close();
http_response_code(200);
echo json_encode(["ok" => true]);
