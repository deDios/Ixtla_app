<?php
// PRI\db\WEB\ixtla-login.php

declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

date_default_timezone_set('America/Mexico_City');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

$allowed_origins = [
    'https://ixtla-app.com',
    'https://www.ixtla-app.com'
];

if (in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: $origin");
    header("Vary: Origin");
}

header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Max-Age: 86400");
header("X-Content-Type-Options: nosniff");
header("Referrer-Policy: no-referrer");
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ============================================================
   FUNCIONES INTERNAS
   ============================================================ */

function json_response(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function internal_error(string $logMessage): void {
    error_log('[IXTLA_LOGIN] ' . $logMessage);

    json_response([
        "ok" => false,
        "error" => "Error interno del servidor"
    ], 500);
}

function client_ip(): string {
    $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';

    if ($xff !== '') {
        $parts = explode(',', $xff);
        return trim($parts[0]);
    }

    return $_SERVER['REMOTE_ADDR'] ?? '';
}

function user_agent(): string {
    return substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 500);
}

function base64url_encode_str(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function create_jwt(array $payload, string $secret): string {
    $header = [
        "typ" => "JWT",
        "alg" => "HS256"
    ];

    $header64 = base64url_encode_str(json_encode($header, JSON_UNESCAPED_UNICODE));
    $payload64 = base64url_encode_str(json_encode($payload, JSON_UNESCAPED_UNICODE));

    $signature = hash_hmac(
        'sha256',
        "$header64.$payload64",
        $secret,
        true
    );

    $signature64 = base64url_encode_str($signature);

    return "$header64.$payload64.$signature64";
}

/* ============================================================
   CONFIGURACIÓN PRODUCCIÓN
   ============================================================ */

const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;
const TOKEN_HORAS = 8;

$JWT_SECRET = getenv('IXTLA_JWT_SECRET') ?: 'c6028c94e5ab1473f2dc40a327cd2faf5041afa364155b9778f4353a35b6f973b1b526619f9c1dbb561926df1fa0de68e97f297206c36ced85b8a39388112343';

if (strlen($JWT_SECRET) < 64) {
    error_log('[IXTLA_LOGIN] IXTLA_JWT_SECRET no configurado o demasiado corto.');

    json_response([
        "ok" => false,
        "error" => "Configuración de seguridad incompleta"
    ], 500);
}

$JWT_ISSUER = 'ixtla-app';
$JWT_AUDIENCE = 'ixtla-portal';

/* ============================================================
   VALIDAR MÉTODO
   ============================================================ */

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_response([
        "ok" => false,
        "error" => "Método no permitido. Usa POST."
    ], 405);
}

/* ============================================================
   LEER BODY
   ============================================================ */

$raw = file_get_contents("php://input");
$in = json_decode($raw, true);

if (!is_array($in)) {
    json_response([
        "ok" => false,
        "error" => "JSON inválido"
    ], 400);
}

$username = trim((string)($in['username'] ?? ''));
$password = (string)($in['password'] ?? '');

if ($username === '' || $password === '') {
    json_response([
        "ok" => false,
        "error" => "Faltan parámetros: username y password"
    ], 400);
}

if (strlen($username) > 180 || strlen($password) > 500) {
    json_response([
        "ok" => false,
        "error" => "Parámetros inválidos"
    ], 400);
}

/* ============================================================
   CONEXIÓN
   ============================================================ */

try {
    $path = realpath("/home/site/wwwroot/db/conn/conn_db_2.php");

    if (!$path || !file_exists($path)) {
        internal_error("No se encontró conn_db_2.php en /home/site/wwwroot/db/conn/conn_db_2.php");
    }

    include_once $path;

    if (!function_exists('conectar')) {
        internal_error("No existe la función conectar() en conn_db_2.php");
    }

    $con = conectar();

    if (!$con instanceof mysqli) {
        internal_error("conectar() no regresó una instancia mysqli");
    }

    $con->set_charset('utf8mb4');
    $con->query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");

} catch (Throwable $e) {
    internal_error("Error de conexión: " . $e->getMessage());
}

/* ============================================================
   LOGIN
   ============================================================ */

try {
    $sql = "
        SELECT
            u.usuario_id,
            u.uuid,
            u.username,
            u.persona_id,
            u.rol_id,
            u.nombre,
            u.apellido_paterno,
            u.apellido_materno,
            u.email,
            u.telefono,
            u.password_hash,
            u.estatus_id,
            u.ultimo_login_at,
            u.ultimo_login_ip,
            u.requiere_cambio_password,
            u.intentos_fallidos,
            u.bloqueado_hasta,
            u.token_version,

            r.codigo AS rol_codigo,
            r.nombre AS rol_nombre,
            r.nivel_jerarquico,

            e.codigo AS estatus_codigo,
            e.nombre AS estatus_nombre,

            p.nombres AS persona_nombres,
            p.apellido_paterno AS persona_apellido_paterno,
            p.apellido_materno AS persona_apellido_materno

        FROM usuario u
        INNER JOIN cat_rol r
            ON r.rol_id = u.rol_id
        INNER JOIN cat_estatus e
            ON e.estatus_id = u.estatus_id
        LEFT JOIN persona p
            ON p.persona_id = u.persona_id
        WHERE (
            u.username COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
            OR u.email COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
        )
          AND u.deleted_at IS NULL
        LIMIT 1
    ";

    $st = $con->prepare($sql);
    $st->bind_param("ss", $username, $username);
    $st->execute();
    $acc = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$acc || $acc['estatus_codigo'] !== 'ACTIVO') {
        $con->close();

        json_response([
            "ok" => false,
            "error" => "Usuario o contraseña inválidos"
        ], 401);
    }

    $uid = (int)$acc['usuario_id'];

    /* ========================================================
       VALIDAR BLOQUEO TEMPORAL
       ======================================================== */

    if (!empty($acc['bloqueado_hasta'])) {
        $now = new DateTimeImmutable('now');
        $until = DateTimeImmutable::createFromFormat('Y-m-d H:i:s', $acc['bloqueado_hasta']);

        if ($until && $until > $now) {
            $mins = (int)ceil(($until->getTimestamp() - $now->getTimestamp()) / 60);

            $con->close();

            json_response([
                "ok" => false,
                "error" => "Cuenta temporalmente bloqueada",
                "locked_until" => $acc['bloqueado_hasta'],
                "minutes_left" => $mins
            ], 423);
        }
    }

    /* ========================================================
       VALIDAR PASSWORD
       ======================================================== */

    $password_ok = password_verify($password, $acc['password_hash'] ?? '');

    if (!$password_ok) {
        $fallidos = (int)$acc['intentos_fallidos'] + 1;

        if ($fallidos >= MAX_INTENTOS) {
            $upd = $con->prepare("
                UPDATE usuario
                SET intentos_fallidos = 0,
                    bloqueado_hasta = DATE_ADD(NOW(), INTERVAL ? MINUTE)
                WHERE usuario_id = ?
            ");

            $mins = BLOQUEO_MIN;
            $upd->bind_param("ii", $mins, $uid);
            $upd->execute();
            $upd->close();

            $con->close();

            json_response([
                "ok" => false,
                "error" => "Cuenta bloqueada por múltiples intentos fallidos",
                "blocked_minutes" => BLOQUEO_MIN
            ], 423);
        }

        $upd = $con->prepare("
            UPDATE usuario
            SET intentos_fallidos = ?
            WHERE usuario_id = ?
        ");

        $upd->bind_param("ii", $fallidos, $uid);
        $upd->execute();
        $upd->close();

        $con->close();

        json_response([
            "ok" => false,
            "error" => "Usuario o contraseña inválidos",
            "attempts_left" => MAX_INTENTOS - $fallidos
        ], 401);
    }

    /* ========================================================
       REHASH OPCIONAL DEL PASSWORD
       ======================================================== */

    if (password_needs_rehash($acc['password_hash'], PASSWORD_DEFAULT)) {
        $newHash = password_hash($password, PASSWORD_DEFAULT);

        $rh = $con->prepare("
            UPDATE usuario
            SET password_hash = ?
            WHERE usuario_id = ?
        ");

        $rh->bind_param("si", $newHash, $uid);
        $rh->execute();
        $rh->close();
    }

    /* ========================================================
       LOGIN EXITOSO
       ======================================================== */

    $ip = client_ip();
    $ua = user_agent();

    $upd = $con->prepare("
        UPDATE usuario
        SET intentos_fallidos = 0,
            bloqueado_hasta = NULL,
            ultimo_login_at = NOW(),
            ultimo_login_ip = ?
        WHERE usuario_id = ?
    ");

    $upd->bind_param("si", $ip, $uid);
    $upd->execute();
    $upd->close();

    /* ========================================================
       CONSULTAR PADRE DIRECTO
       ======================================================== */

    $parent = null;

    $qParent = $con->prepare("
        SELECT
            up.usuario_id,
            up.username,
            up.nombre,
            up.apellido_paterno,
            up.apellido_materno,
            up.email,
            rp.codigo AS rol_codigo,
            rp.nombre AS rol_nombre
        FROM usuario_jerarquia uj
        INNER JOIN usuario up
            ON up.usuario_id = uj.usuario_padre_id
        INNER JOIN cat_rol rp
            ON rp.rol_id = up.rol_id
        WHERE uj.usuario_hijo_id = ?
          AND uj.activo = 1
          AND uj.fecha_fin IS NULL
          AND up.deleted_at IS NULL
        LIMIT 1
    ");

    $qParent->bind_param("i", $uid);
    $qParent->execute();
    $parent = $qParent->get_result()->fetch_assoc();
    $qParent->close();

    if ($parent) {
        $parent['usuario_id'] = (int)$parent['usuario_id'];
    }

    /* ========================================================
       CONSULTAR TERRITORIOS ASIGNADOS
       ======================================================== */

    $territorios = [];

    $qTerr = $con->prepare("
        SELECT
            t.territorio_id,
            t.territorio_padre_id,
            t.tipo,
            t.codigo,
            t.nombre,
            t.municipio,
            t.estado,
            t.distrito_local,
            t.distrito_federal,
            ut.fecha_inicio,
            ut.fecha_fin
        FROM usuario_territorio ut
        INNER JOIN territorio t
            ON t.territorio_id = ut.territorio_id
        WHERE ut.usuario_id = ?
          AND ut.activo = 1
          AND t.activo = 1
          AND t.deleted_at IS NULL
        ORDER BY t.tipo, t.codigo
    ");

    $qTerr->bind_param("i", $uid);
    $qTerr->execute();
    $rsTerr = $qTerr->get_result();

    while ($row = $rsTerr->fetch_assoc()) {
        $row['territorio_id'] = (int)$row['territorio_id'];
        $row['territorio_padre_id'] = isset($row['territorio_padre_id'])
            ? (int)$row['territorio_padre_id']
            : null;

        $territorios[] = $row;
    }

    $qTerr->close();

    /* ========================================================
       TOTAL DE HIJOS DIRECTOS
       ======================================================== */

    $total_hijos = 0;

    $qHijos = $con->prepare("
        SELECT COUNT(*) AS total
        FROM usuario_jerarquia uj
        INNER JOIN usuario uh
            ON uh.usuario_id = uj.usuario_hijo_id
        WHERE uj.usuario_padre_id = ?
          AND uj.activo = 1
          AND uj.fecha_fin IS NULL
          AND uh.deleted_at IS NULL
    ");

    $qHijos->bind_param("i", $uid);
    $qHijos->execute();
    $total_hijos = (int)($qHijos->get_result()->fetch_assoc()['total'] ?? 0);
    $qHijos->close();

    /* ========================================================
       BITÁCORA DE LOGIN
       ======================================================== */

    $descripcion = 'Login exitoso';

    $bit = $con->prepare("
        INSERT INTO bitacora_registro (
            tabla_nombre,
            registro_id,
            accion,
            descripcion,
            realizado_por,
            ip_origen,
            user_agent
        )
        VALUES (
            'usuario',
            ?,
            'LOGIN',
            ?,
            ?,
            ?,
            ?
        )
    ");

    $bit->bind_param("isiss", $uid, $descripcion, $uid, $ip, $ua);
    $bit->execute();
    $bit->close();

    /* ========================================================
       CREAR TOKEN JWT
       ======================================================== */

    $issuedAt = time();
    $expiresAt = $issuedAt + (TOKEN_HORAS * 60 * 60);
    $jti = bin2hex(random_bytes(16));

    $token = create_jwt([
        "iss" => $JWT_ISSUER,
        "aud" => $JWT_AUDIENCE,
        "jti" => $jti,
        "sub" => $uid,
        "username" => $acc['username'],
        "rol_id" => (int)$acc['rol_id'],
        "rol_codigo" => $acc['rol_codigo'],
        "persona_id" => isset($acc['persona_id']) ? (int)$acc['persona_id'] : null,
        "tv" => (int)$acc['token_version'],
        "iat" => $issuedAt,
        "nbf" => $issuedAt,
        "exp" => $expiresAt
    ], $JWT_SECRET);

    /* ========================================================
       RESPUESTA
       ======================================================== */

    $data = [
        "token" => $token,
        "token_type" => "Bearer",
        "expires_at" => date('Y-m-d H:i:s', $expiresAt),
        "expires_in_seconds" => TOKEN_HORAS * 60 * 60,

        "usuario" => [
            "usuario_id" => $uid,
            "uuid" => $acc['uuid'],
            "username" => $acc['username'],
            "nombre" => $acc['nombre'],
            "apellido_paterno" => $acc['apellido_paterno'],
            "apellido_materno" => $acc['apellido_materno'],
            "email" => $acc['email'],
            "telefono" => $acc['telefono'],
            "persona_id" => isset($acc['persona_id']) ? (int)$acc['persona_id'] : null,
            "requiere_cambio_password" => (int)$acc['requiere_cambio_password'] === 1,
            "ultimo_login_at" => date('Y-m-d H:i:s'),
            "total_hijos_directos" => $total_hijos
        ],

        "persona" => [
            "persona_id" => isset($acc['persona_id']) ? (int)$acc['persona_id'] : null,
            "nombres" => $acc['persona_nombres'],
            "apellido_paterno" => $acc['persona_apellido_paterno'],
            "apellido_materno" => $acc['persona_apellido_materno']
        ],

        "rol" => [
            "rol_id" => (int)$acc['rol_id'],
            "codigo" => $acc['rol_codigo'],
            "nombre" => $acc['rol_nombre'],
            "nivel_jerarquico" => (int)$acc['nivel_jerarquico']
        ],

        "reporta_a" => $parent,

        "territorios" => $territorios
    ];

    $con->close();

    json_response([
        "ok" => true,
        "data" => $data
    ]);

} catch (Throwable $e) {
    if (isset($con) && $con instanceof mysqli) {
        $con->close();
    }

    internal_error($e->getMessage());
}