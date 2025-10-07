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

// ---- Logging sencillo (cambia la ruta si no tienes permisos en /tmp)
$LOG = '/tmp/wa_webhook.log';
function wlog($msg) {
  global $LOG;
  @file_put_contents($LOG, date('c').' '.$msg.PHP_EOL, FILE_APPEND);
}

// Límite de tamaño (256 KB)
$maxBytes = 256 * 1024;
$raw = file_get_contents('php://input', false, null, 0, $maxBytes+1);
if ($raw === false || strlen($raw) > $maxBytes) {
  http_response_code(413);
  echo json_encode(["ok"=>false, "error"=>"Body too large"]);
  wlog('ERROR: body too large or unreadable');
  exit;
}
wlog('RAW: '.$raw);

// (Opcional) Validación HMAC — descomentarlo cuando configures APP_SECRET
// $appSecret = getenv('APP_SECRET') ?: '';
// $sigHeader = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
// if ($appSecret && $sigHeader) {
//   if (!preg_match('/^sha256=([a-f0-9]{64})$/i', $sigHeader, $m)) { http_response_code(401); echo json_encode(["ok"=>false,"error"=>"Bad signature"]); wlog('ERROR: bad signature header'); exit; }
//   $expected = 'sha256=' . hash_hmac('sha256', $raw, $appSecret);
//   if (!hash_equals($expected, $sigHeader)) { http_response_code(401); echo json_encode(["ok"=>false,"error"=>"Invalid signature"]); wlog('ERROR: invalid signature'); exit; }
// }

$body = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE) {
  http_response_code(400);
  echo json_encode(["ok"=>false, "error"=>"Invalid JSON"]);
  wlog('ERROR: invalid json: '.json_last_error_msg());
  exit;
}

// *** Normalización importante ***
// Si el panel envía solo {field, value} (sin entry/changes), lo convertimos:
if (!isset($body['entry']) && isset($body['field'], $body['value'])) {
  $body = [ "entry" => [ [ "changes" => [ [ "field" => $body['field'], "value" => $body['value'] ] ] ] ] ];
  wlog('INFO: normalized mock payload to entry/changes');
}

// 3) Conecta a DB
include_once __DIR__ . '../db/conn/conn_db.php.php';
$con = conectar();
if (!$con) { http_response_code(500); echo json_encode(["ok"=>false,"error"=>"DB down"]); wlog('ERROR: DB down'); exit; }
$con->set_charset('utf8mb4');

// Helpers
function upsert_contact(mysqli $con, string $wa_phone, ?string $name) : int {
  $s = $con->prepare("SELECT id FROM contacts WHERE wa_phone=? LIMIT 1");
  $s->bind_param('s', $wa_phone);
  if (!$s->execute()) { wlog('SQL ERR upsert_contact SELECT: '.$s->error); }
  $id = $s->get_result()->fetch_assoc()['id'] ?? null;
  $s->close();

  if ($id) return (int)$id;

  $s = $con->prepare("INSERT INTO contacts(wa_phone,name) VALUES(?,?)");
  $s->bind_param('ss', $wa_phone, $name);
  if (!$s->execute()) { wlog('SQL ERR upsert_contact INSERT: '.$s->error); }
  $new_id = (int)$s->insert_id;
  $s->close();
  return $new_id;
}

function get_or_open_conversation(mysqli $con, int $contact_id) : int {
  $s = $con->prepare("SELECT id FROM conversations WHERE contact_id=? AND status!='closed' LIMIT 1");
  $s->bind_param('i', $contact_id);
  if (!$s->execute()) { wlog('SQL ERR get_or_open SELECT: '.$s->error); }
  $row = $s->get_result()->fetch_assoc();
  $s->close();

  if ($row) return (int)$row['id'];

  $s = $con->prepare("INSERT INTO conversations(contact_id,status) VALUES(?, 'open')");
  $s->bind_param('i', $contact_id);
  if (!$s->execute()) { wlog('SQL ERR get_or_open INSERT: '.$s->error); }
  $cid = (int)$s->insert_id;
  $s->close();
  return $cid;
}

// 4) Procesa entries/changes (maneja múltiples eventos en un POST)
$entries = $body['entry'] ?? [];
$inserted = 0;

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
      if (!$from) { wlog('WARN: message without from'); continue; }

      $name = $contacts[$idx]['profile']['name'] ?? ($contacts[0]['profile']['name'] ?? null);

      $contact_id = upsert_contact($con, $from, $name);
      $conv_id = get_or_open_conversation($con, $contact_id);

      $waid = $m['id'] ?? null;
      $raw_msg = json_encode($m, JSON_UNESCAPED_UNICODE);

      switch ($type) {
        case 'text':
          $text = $m['text']['body'] ?? '';
          $sql = "INSERT IGNORE INTO messages(conversation_id, direction, wa_message_id, msg_type, text, raw_json)
                  VALUES(?, 'in', ?, 'text', ?, ?)";
          $s = $con->prepare($sql);
          $s->bind_param('isss', $conv_id, $waid, $text, $raw_msg);
          if (!$s->execute()) { wlog('SQL ERR insert message text: '.$s->error); }
          else { $inserted += $s->affected_rows; }
          $s->close();
          break;

        default:
          $genericText = "[tipo:$type] evento recibido";
          $sql = "INSERT IGNORE INTO messages(conversation_id, direction, wa_message_id, msg_type, text, raw_json)
                  VALUES(?, 'in', ?, 'text', ?, ?)";
          $s = $con->prepare($sql);
          $s->bind_param('isss', $conv_id, $waid, $genericText, $raw_msg);
          if (!$s->execute()) { wlog('SQL ERR insert message default: '.$s->error); }
          else { $inserted += $s->affected_rows; }
          $s->close();
          break;
      }

      $s = $con->prepare("UPDATE conversations SET last_incoming_at=NOW(), updated_at=NOW() WHERE id=?");
      $s->bind_param('i', $conv_id);
      if (!$s->execute()) { wlog('SQL ERR update conversation: '.$s->error); }
      $s->close();
    }

    // B) ESTADOS — si quieres loguearlos, agrégalos aquí
    // $statuses = $value['statuses'] ?? [];
  }
}

$con->close();
wlog("DONE inserted_rows=$inserted");
http_response_code(200);
echo json_encode(["ok" => true, "inserted" => $inserted]);
