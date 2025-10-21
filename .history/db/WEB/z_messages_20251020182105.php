<?php
header('Content-Type: application/json; charset=utf-8');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === 'https://ixtla-app.com' || $origin === 'https://www.ixtla-app.com') {
  header("Access-Control-Allow-Origin: $origin");
  header("Vary: Origin");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

$path = realpath("/home/site/wwwroot/db/conn/conn_db.php");
if ($path && is_file($path)) { include_once $path; }
else { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"No se encontró conn_db.php en $path"])); }
if (!function_exists('conectar')) { http_response_code(500); die(json_encode(["ok"=>false,"error"=>"conectar() no definida"])); }

$con = conectar(); $con->set_charset('utf8mb4');

$convId   = (int)($_GET['conversation_id'] ?? 0);
$page     = max(1, (int)($_GET['page'] ?? 1));
$pageSize = max(1, min(200, (int)($_GET['page_size'] ?? 50)));
$offset   = ($page-1)*$pageSize;

if (!$convId) { http_response_code(400); die(json_encode(["ok"=>false,"error"=>"conversation_id requerido"])); }

$st=$con->prepare("SELECT id,direction,wa_message_id,msg_type,text,created_at
                   FROM messages WHERE conversation_id=? ORDER BY created_at ASC LIMIT ? OFFSET ?");
$st->bind_param('iii',$convId,$pageSize,$offset);
$st->execute(); $rows=$st->get_result()->fetch_all(MYSQLI_ASSOC); $st->close();

echo json_encode(["ok"=>true,"data"=>$rows], JSON_UNESCAPED_UNICODE);
