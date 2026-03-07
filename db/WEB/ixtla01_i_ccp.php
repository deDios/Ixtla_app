<?php
// --- CORS ---
$allowed = [
  'https://ixtla-app.com',
  'https://www.ixtla-app.com',
  'https://ixtlahuacan-fvasgmddcxd3gbc3.mexicocentral-01.azurewebsites.net',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host   = ($_SERVER['REQUEST_SCHEME'] ?? 'https') . '://' . ($_SERVER['HTTP_HOST'] ?? '');

// Preferir Origin si viene; si no, considerar el host (same-origin)
$reflect = '';
if ($origin && in_array($origin, $allowed, true)) {
  $reflect = $origin;
} elseif ($host && in_array($host, $allowed, true)) {
  $reflect = $host;
}
if ($reflect) {
  header("Access-Control-Allow-Origin: $reflect");
  header("Vary: Origin");
}

header("Access-Control-Allow-Credentials: true"); // si usas cookies/sesión
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");

// Responder preflight siempre con los headers ya puestos
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}
// --- fin CORS ---

header('Content-Type: application/json');
date_default_timezone_set('America/Mexico_City');

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && file_exists($path)) { include $path; }
else {
  http_response_code(500);
  die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php en $path"]));
}

$in = json_decode(file_get_contents("php://input"), true) ?? [];

$requerimiento_id = isset($in['requerimiento_id']) ? (int)$in['requerimiento_id'] : null;
$empleado_id      = isset($in['empleado_id']) ? (int)$in['empleado_id'] : null; // opcional
$tipo             = isset($in['tipo']) ? (int)$in['tipo'] : null;               // 1=Pausa, 2=Cancelado
$comentario       = isset($in['comentario']) ? trim($in['comentario']) : null;
$created_by       = isset($in['created_by']) ? (int)$in['created_by'] : null;
$status           = isset($in['status']) ? (int)$in['status'] : 1;

if (!$requerimiento_id || !$tipo || !$comentario || !$created_by) {
  http_response_code(400);
  echo json_encode([
    "ok"=>false,
    "error"=>"Faltan datos obligatorios: requerimiento_id, tipo, comentario, created_by"
  ]);
  exit;
}
if (!in_array($tipo,[1,2],true)) {
  http_response_code(422);
  echo json_encode(["ok"=>false,"error"=>"tipo debe ser 1 (Pausa) o 2 (Cancelado)"]);
  exit;
}

$con = conectar();
if (!$con) { echo json_encode(["ok"=>false,"error"=>"No se pudo conectar a la base de datos"]); exit; }
$con->set_charset('utf8mb4');

/* =========================
 * INSERT CCP
 * ========================= */
$sql = "INSERT INTO comentario_cancelacion_pausa
          (requerimiento_id, empleado_id, tipo, comentario, status, created_by)
        VALUES (?,?,?,?,?,?)";
$stmt = $con->prepare($sql);
$stmt->bind_param("iiisii", $requerimiento_id, $empleado_id, $tipo, $comentario, $status, $created_by);

if (!$stmt->execute()) {
  http_response_code(500);
  echo json_encode(["ok"=>false,"error"=>"Error al insertar: ".$stmt->error]);
  $stmt->close(); $con->close();
  exit;
}
$new_id = $stmt->insert_id;
$stmt->close();

/* =========================
 * Lee el CCP creado
 * ========================= */
$q = $con->prepare("SELECT * FROM comentario_cancelacion_pausa WHERE id=? LIMIT 1");
$q->bind_param("i", $new_id);
$q->execute();
$row = $q->get_result()->fetch_assoc();
$q->close();

/* =========================
 * WhatsApp event_04 para tipo 1(pausa) y 2(cancelado)
 * Params: [folio, estatusLabel, motivo]
 * ========================= */

// Helpers locales 
function onlyDigits(string $s): string {
  return preg_replace("/\\D+/", "", $s) ?? "";
}

//normalizador de folio
function folioFromReqId(int $id): string {
  return "REQ-" . str_pad((string)$id, 10, "0", STR_PAD_LEFT);
}

function tipoToLabel(int $t): string {
  return match ($t) {
    1 => "Pausado",
    2 => "Cancelado",
    default => "—",
  };
}

// Resultado de envío
$wapp = [
  "attempted" => false,
  "sent" => false,
  "reason" => null,
  "http_code" => null,
  "message_id" => null,
];

// Solo si CCP activo (status=1)
if ((int)$status === 1) {
  // Solo para tipo 1/2, se pueden agregar mas pero queda sellado en 1(pausa) y 2(cancelado)
  if (in_array((int)$tipo, [1,2], true)) {
    $wapp["attempted"] = true;

    // consulta rapida para obtener el telefono
    $rq = $con->prepare("SELECT contacto_telefono, estatus FROM requerimiento WHERE id=? LIMIT 1");
    if ($rq) {
      $rq->bind_param("i", $requerimiento_id);
      $rq->execute();
      $req = $rq->get_result()->fetch_assoc();
      $rq->close();

      $to = onlyDigits((string)($req["contacto_telefono"] ?? ""));

      // validacion de telefono rapida
      if (!$to || !preg_match("/^\\d{10,15}$/", $to)) {
        $wapp["reason"] = "Teléfono inválido/vacío en requerimiento.contacto_telefono";
      } else {
        // validar coherencia con estatus 4/5 si existe
        // 4=pausado, 5=cancelado
        $estatusReq = isset($req["estatus"]) ? (int)$req["estatus"] : null;
        $match = true;
        if ($estatusReq !== null) {
          $match = ((int)$tipo === 1 && $estatusReq === 4) || ((int)$tipo === 2 && $estatusReq === 5);
        }
        if (!$match) {
          $wapp["reason"] = "No coincide tipo CCP con estatus del requerimiento (tipo={$tipo}, estatus={$estatusReq})";
        } else {
          // parametros para el event_04
          $folio = folioFromReqId((int)$requerimiento_id);
          $paramsWapp = [
            $folio,
            tipoToLabel((int)$tipo),
            (string)$comentario,
          ];

          // endpoint del event_04
          $WAPP_URL = "https://ixtla-app.com/db/WEB/send_wapp_template_event_04.php";

          $payload = json_encode([
            "to" => $to,
            "lang" => "es_MX",
            "params" => $paramsWapp,
          ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

          $ch = curl_init($WAPP_URL);
          curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
              "Content-Type: application/json",
              "Accept: application/json",
            ],
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 6,
          ]);

          $resp = curl_exec($ch);
          $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
          curl_close($ch);

          $wapp["http_code"] = $code;

          $decoded = json_decode((string)$resp, true);
          if (is_array($decoded)) {
            $wapp["sent"] = (bool)($decoded["ok"] ?? false);
            $wapp["message_id"] = $decoded["message_id"] ?? null;
            if (!$wapp["sent"]) {
              $wapp["reason"] = $decoded["error"] ?? "Sender no confirmó ok:true";
            }
          } else {
            $wapp["sent"] = ($code >= 200 && $code < 300);
            if (!$wapp["sent"]) $wapp["reason"] = "Respuesta no JSON del sender";
          }
        }
      }
    } else {
      $wapp["reason"] = "No se pudo preparar SELECT de requerimiento (schema/permiso)";
    }
  } else {
    $wapp["reason"] = "tipo no aplicable (no 1/2)";
  }
} else {
  $wapp["reason"] = "CCP status != 1 (no activo)";
}

$con->close();

// Response
echo json_encode(
  ["ok"=>true, "data"=>$row, "wapp"=>$wapp],
  JSON_UNESCAPED_UNICODE
);