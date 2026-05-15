<?php
// /home/site/wwwroot/db/WEB/ixtla_admin_service.php

declare(strict_types=1);

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
date_default_timezone_set('America/Mexico_City');

/* ============================================================
   CONFIG
   ============================================================ */

$JWT_SECRET = getenv('IXTLA_JWT_SECRET') ?: 'c6028c94e5ab1473f2dc40a327cd2faf5041afa364155b9778f4353a35b6f973b1b526619f9c1dbb561926df1fa0de68e97f297206c36ced85b8a39388112343';

$JWT_ISSUER = 'ixtla-app';
$JWT_AUDIENCE = 'ixtla-portal';

if (strlen($JWT_SECRET) < 64) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        "ok" => false,
        "error" => "Configuración de seguridad incompleta"
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/* ============================================================
   CORS
   ============================================================ */

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
   HELPERS
   ============================================================ */

function json_response(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function internal_error(string $message): void {
    error_log('[IXTLA_ADMIN_SERVICE] ' . $message);
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

function uuidv4(): string {
    $data = random_bytes(16);

    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);

    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function base64url_decode_str(string $data): string|false {
    $remainder = strlen($data) % 4;

    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }

    return base64_decode(strtr($data, '-_', '+/'));
}

function get_bearer_token(): ?string {
    $headers = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']
        ?? '';

    if (preg_match('/Bearer\s+(.*)$/i', $headers, $matches)) {
        return trim($matches[1]);
    }

    return null;
}

function verify_jwt(?string $token, string $secret, string $issuer, string $audience): ?array {
    if (!$token) {
        return null;
    }

    $parts = explode('.', $token);

    if (count($parts) !== 3) {
        return null;
    }

    [$header64, $payload64, $signature64] = $parts;

    $expected = rtrim(strtr(base64_encode(hash_hmac(
        'sha256',
        "$header64.$payload64",
        $secret,
        true
    )), '+/', '-_'), '=');

    if (!hash_equals($expected, $signature64)) {
        return null;
    }

    $payloadJson = base64url_decode_str($payload64);

    if ($payloadJson === false) {
        return null;
    }

    $payload = json_decode($payloadJson, true);

    if (!is_array($payload)) {
        return null;
    }

    if (($payload['iss'] ?? '') !== $issuer) {
        return null;
    }

    if (($payload['aud'] ?? '') !== $audience) {
        return null;
    }

    $now = time();

    if (isset($payload['nbf']) && $now < (int)$payload['nbf']) {
        return null;
    }

    if (isset($payload['exp']) && $now > (int)$payload['exp']) {
        return null;
    }

    return $payload;
}

function bind_params(mysqli_stmt $stmt, string $types, array &$params): void {
    $refs = [];
    $refs[] = $types;

    foreach ($params as $key => &$value) {
        $refs[] = &$value;
    }

    call_user_func_array([$stmt, 'bind_param'], $refs);
}

function db(): mysqli {
    $path = realpath("/home/site/wwwroot/db/conn/conn_db_2.php");

    if (!$path || !file_exists($path)) {
        internal_error("No se encontró conn_db_2.php en /home/site/wwwroot/db/conn/conn_db_2.php");
    }

    include_once $path;

    if (!function_exists('conectar')) {
        internal_error("No existe la función conectar() en conn_db.php");
    }

    $con = conectar();

    if (!$con instanceof mysqli) {
        internal_error("conectar() no regresó una conexión mysqli");
    }

    $con->set_charset('utf8mb4');
    $con->query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");

    return $con;
}

function read_json_body(): array {
    $raw = file_get_contents("php://input");
    $in = json_decode($raw, true);

    if (!is_array($in)) {
        json_response([
            "ok" => false,
            "error" => "JSON inválido"
        ], 400);
    }

    return $in;
}

function value_or_null(array $arr, string $key): mixed {
    if (!array_key_exists($key, $arr)) {
        return null;
    }

    if ($arr[$key] === '') {
        return null;
    }

    return $arr[$key];
}

/* ============================================================
   AUTH
   ============================================================ */

function require_auth(mysqli $con, string $secret, string $issuer, string $audience): array {
    $payload = verify_jwt(get_bearer_token(), $secret, $issuer, $audience);

    if (!$payload || empty($payload['sub'])) {
        json_response([
            "ok" => false,
            "error" => "Token inválido o expirado"
        ], 401);
    }

    $usuario_id = (int)$payload['sub'];
    $token_version = (int)($payload['tv'] ?? 0);

    $sql = "
        SELECT
            u.usuario_id,
            u.username,
            u.token_version,
            u.estatus_id,
            e.codigo AS estatus_codigo,
            r.codigo AS rol_codigo
        FROM usuario u
        INNER JOIN cat_estatus e
            ON e.estatus_id = u.estatus_id
        INNER JOIN cat_rol r
            ON r.rol_id = u.rol_id
        WHERE u.usuario_id = ?
          AND u.deleted_at IS NULL
        LIMIT 1
    ";

    $st = $con->prepare($sql);
    $st->bind_param("i", $usuario_id);
    $st->execute();
    $user = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$user || $user['estatus_codigo'] !== 'ACTIVO') {
        json_response([
            "ok" => false,
            "error" => "Usuario inactivo o no encontrado"
        ], 401);
    }

    if ((int)$user['token_version'] !== $token_version) {
        json_response([
            "ok" => false,
            "error" => "Sesión inválida. Inicia sesión nuevamente."
        ], 401);
    }

    return [
        "usuario_id" => $usuario_id,
        "username" => $user['username'],
        "rol_codigo" => $user['rol_codigo']
    ];
}

/* ============================================================
   CATÁLOGOS
   ============================================================ */

function get_estatus_id(mysqli $con, string $codigo = 'ACTIVO'): int {
    $sql = "SELECT estatus_id FROM cat_estatus WHERE codigo = ? LIMIT 1";

    $st = $con->prepare($sql);
    $st->bind_param("s", $codigo);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$row) {
        throw new Exception("No existe estatus $codigo");
    }

    return (int)$row['estatus_id'];
}

function get_rol_id(mysqli $con, ?int $rol_id, ?string $rol_codigo): int {
    if ($rol_id && $rol_id > 0) {
        return $rol_id;
    }

    if (!$rol_codigo) {
        throw new Exception("Falta rol_id o rol_codigo");
    }

    $sql = "SELECT rol_id FROM cat_rol WHERE codigo = ? LIMIT 1";

    $st = $con->prepare($sql);
    $st->bind_param("s", $rol_codigo);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$row) {
        throw new Exception("No existe rol_codigo $rol_codigo");
    }

    return (int)$row['rol_id'];
}

function consultar_catalogos(mysqli $con): array {
    $estatus = [];
    $roles = [];
    $territorios = [];

    $rs = $con->query("
        SELECT estatus_id, codigo, nombre, descripcion, activo
        FROM cat_estatus
        ORDER BY estatus_id
    ");

    while ($row = $rs->fetch_assoc()) {
        $row['estatus_id'] = (int)$row['estatus_id'];
        $row['activo'] = (int)$row['activo'];
        $estatus[] = $row;
    }

    $rs = $con->query("
        SELECT rol_id, codigo, nombre, descripcion, nivel_jerarquico, activo
        FROM cat_rol
        ORDER BY nivel_jerarquico
    ");

    while ($row = $rs->fetch_assoc()) {
        $row['rol_id'] = (int)$row['rol_id'];
        $row['nivel_jerarquico'] = (int)$row['nivel_jerarquico'];
        $row['activo'] = (int)$row['activo'];
        $roles[] = $row;
    }

    $rs = $con->query("
        SELECT
            z.territorio_id AS zona_id,
            z.codigo AS zona_codigo,
            z.nombre AS zona_nombre,
            s.territorio_id AS seccion_id,
            s.codigo AS seccion_codigo,
            s.nombre AS seccion_nombre,
            s.municipio,
            s.estado
        FROM territorio z
        LEFT JOIN territorio s
            ON s.territorio_padre_id = z.territorio_id
           AND s.tipo = 'SECCION'
           AND s.activo = 1
           AND s.deleted_at IS NULL
        WHERE z.tipo = 'ZONA'
          AND z.activo = 1
          AND z.deleted_at IS NULL
        ORDER BY z.codigo, s.codigo
    ");

    $zonas = [];

    while ($row = $rs->fetch_assoc()) {
        $zonaId = (int)$row['zona_id'];

        if (!isset($zonas[$zonaId])) {
            $zonas[$zonaId] = [
                "territorio_id" => $zonaId,
                "codigo" => $row['zona_codigo'],
                "nombre" => $row['zona_nombre'],
                "secciones" => []
            ];
        }

        if ($row['seccion_id']) {
            $zonas[$zonaId]["secciones"][] = [
                "territorio_id" => (int)$row['seccion_id'],
                "codigo" => $row['seccion_codigo'],
                "nombre" => $row['seccion_nombre'],
                "municipio" => $row['municipio'],
                "estado" => $row['estado']
            ];
        }
    }

    $territorios = array_values($zonas);

    return [
        "estatus" => $estatus,
        "roles" => $roles,
        "territorios" => $territorios
    ];
}

/* ============================================================
   BITÁCORA
   ============================================================ */

function log_bitacora(
    mysqli $con,
    string $tabla,
    int $registro_id,
    string $accion,
    string $descripcion,
    ?int $realizado_por,
    ?array $anteriores = null,
    ?array $nuevos = null
): void {
    $ip = client_ip();
    $ua = user_agent();

    $oldJson = $anteriores ? json_encode($anteriores, JSON_UNESCAPED_UNICODE) : null;
    $newJson = $nuevos ? json_encode($nuevos, JSON_UNESCAPED_UNICODE) : null;

    $sql = "
        INSERT INTO bitacora_registro (
            tabla_nombre,
            registro_id,
            accion,
            descripcion,
            valores_anteriores,
            valores_nuevos,
            realizado_por,
            ip_origen,
            user_agent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ";

    $st = $con->prepare($sql);
    $st->bind_param(
        "sissssiss",
        $tabla,
        $registro_id,
        $accion,
        $descripcion,
        $oldJson,
        $newJson,
        $realizado_por,
        $ip,
        $ua
    );
    $st->execute();
    $st->close();
}

/* ============================================================
   CONSULTAS USUARIO
   ============================================================ */

function get_territorios_usuario(mysqli $con, int $usuario_id): array {
    $sql = "
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
            z.territorio_id AS zona_id,
            z.codigo AS zona_codigo,
            z.nombre AS zona_nombre,
            ut.fecha_inicio,
            ut.fecha_fin,
            ut.activo
        FROM usuario_territorio ut
        INNER JOIN territorio t
            ON t.territorio_id = ut.territorio_id
        LEFT JOIN territorio z
            ON z.territorio_id = t.territorio_padre_id
        WHERE ut.usuario_id = ?
          AND ut.activo = 1
          AND t.activo = 1
          AND t.deleted_at IS NULL
        ORDER BY t.tipo, t.codigo
    ";

    $st = $con->prepare($sql);
    $st->bind_param("i", $usuario_id);
    $st->execute();
    $rs = $st->get_result();

    $items = [];

    while ($row = $rs->fetch_assoc()) {
        $row['territorio_id'] = (int)$row['territorio_id'];
        $row['territorio_padre_id'] = isset($row['territorio_padre_id']) ? (int)$row['territorio_padre_id'] : null;
        $row['zona_id'] = isset($row['zona_id']) ? (int)$row['zona_id'] : null;
        $row['activo'] = (int)$row['activo'];
        $items[] = $row;
    }

    $st->close();

    return $items;
}

function get_usuario_padre(mysqli $con, int $usuario_id): ?array {
    $sql = "
        SELECT
            up.usuario_id,
            up.username,
            up.nombre,
            up.apellido_paterno,
            up.apellido_materno,
            up.email,
            r.codigo AS rol_codigo,
            r.nombre AS rol_nombre
        FROM usuario_jerarquia uj
        INNER JOIN usuario up
            ON up.usuario_id = uj.usuario_padre_id
        INNER JOIN cat_rol r
            ON r.rol_id = up.rol_id
        WHERE uj.usuario_hijo_id = ?
          AND uj.activo = 1
          AND uj.fecha_fin IS NULL
          AND up.deleted_at IS NULL
        LIMIT 1
    ";

    $st = $con->prepare($sql);
    $st->bind_param("i", $usuario_id);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$row) {
        return null;
    }

    $row['usuario_id'] = (int)$row['usuario_id'];

    return $row;
}

function get_hijos_directos(mysqli $con, int $usuario_id): array {
    $sql = "
        SELECT
            uh.usuario_id,
            uh.username,
            uh.nombre,
            uh.apellido_paterno,
            uh.apellido_materno,
            uh.email,
            r.codigo AS rol_codigo,
            r.nombre AS rol_nombre
        FROM usuario_jerarquia uj
        INNER JOIN usuario uh
            ON uh.usuario_id = uj.usuario_hijo_id
        INNER JOIN cat_rol r
            ON r.rol_id = uh.rol_id
        WHERE uj.usuario_padre_id = ?
          AND uj.activo = 1
          AND uj.fecha_fin IS NULL
          AND uh.deleted_at IS NULL
        ORDER BY r.nivel_jerarquico, uh.username
    ";

    $st = $con->prepare($sql);
    $st->bind_param("i", $usuario_id);
    $st->execute();
    $rs = $st->get_result();

    $items = [];

    while ($row = $rs->fetch_assoc()) {
        $row['usuario_id'] = (int)$row['usuario_id'];
        $items[] = $row;
    }

    $st->close();

    return $items;
}

function get_jerarquia_descendente(mysqli $con, int $usuario_id): array {
    $sql = "
        WITH RECURSIVE equipo AS (
            SELECT
                u.usuario_id,
                u.username,
                u.nombre,
                u.apellido_paterno,
                u.apellido_materno,
                u.email,
                u.rol_id,
                r.codigo AS rol_codigo,
                r.nombre AS rol_nombre,
                NULL AS usuario_padre_id,
                0 AS nivel
            FROM usuario u
            INNER JOIN cat_rol r
                ON r.rol_id = u.rol_id
            WHERE u.usuario_id = ?
              AND u.deleted_at IS NULL

            UNION ALL

            SELECT
                h.usuario_id,
                h.username,
                h.nombre,
                h.apellido_paterno,
                h.apellido_materno,
                h.email,
                h.rol_id,
                rh.codigo AS rol_codigo,
                rh.nombre AS rol_nombre,
                uj.usuario_padre_id,
                e.nivel + 1 AS nivel
            FROM usuario_jerarquia uj
            INNER JOIN usuario h
                ON h.usuario_id = uj.usuario_hijo_id
            INNER JOIN cat_rol rh
                ON rh.rol_id = h.rol_id
            INNER JOIN equipo e
                ON e.usuario_id = uj.usuario_padre_id
            WHERE uj.activo = 1
              AND uj.fecha_fin IS NULL
              AND h.deleted_at IS NULL
        )
        SELECT *
        FROM equipo
        ORDER BY nivel, username
    ";

    $st = $con->prepare($sql);
    $st->bind_param("i", $usuario_id);
    $st->execute();
    $rs = $st->get_result();

    $items = [];

    while ($row = $rs->fetch_assoc()) {
        $row['usuario_id'] = (int)$row['usuario_id'];
        $row['rol_id'] = (int)$row['rol_id'];
        $row['usuario_padre_id'] = isset($row['usuario_padre_id']) ? (int)$row['usuario_padre_id'] : null;
        $row['nivel'] = (int)$row['nivel'];
        $items[] = $row;
    }

    $st->close();

    return $items;
}

function get_usuario_full(mysqli $con, int $usuario_id, bool $includeTree = true): ?array {
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
            u.estatus_id,
            u.ultimo_login_at,
            u.ultimo_login_ip,
            u.requiere_cambio_password,
            u.intentos_fallidos,
            u.bloqueado_hasta,
            u.token_version,
            u.created_at,
            u.updated_at,

            r.codigo AS rol_codigo,
            r.nombre AS rol_nombre,
            r.nivel_jerarquico,

            e.codigo AS estatus_codigo,
            e.nombre AS estatus_nombre,

            p.nombres AS persona_nombres,
            p.apellido_paterno AS persona_apellido_paterno,
            p.apellido_materno AS persona_apellido_materno,
            p.email AS persona_email,
            p.telefono AS persona_telefono,
            p.whatsapp AS persona_whatsapp
        FROM usuario u
        INNER JOIN cat_rol r
            ON r.rol_id = u.rol_id
        INNER JOIN cat_estatus e
            ON e.estatus_id = u.estatus_id
        LEFT JOIN persona p
            ON p.persona_id = u.persona_id
        WHERE u.usuario_id = ?
          AND u.deleted_at IS NULL
        LIMIT 1
    ";

    $st = $con->prepare($sql);
    $st->bind_param("i", $usuario_id);
    $st->execute();
    $row = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$row) {
        return null;
    }

    $data = [
        "usuario" => [
            "usuario_id" => (int)$row['usuario_id'],
            "uuid" => $row['uuid'],
            "username" => $row['username'],
            "nombre" => $row['nombre'],
            "apellido_paterno" => $row['apellido_paterno'],
            "apellido_materno" => $row['apellido_materno'],
            "email" => $row['email'],
            "telefono" => $row['telefono'],
            "persona_id" => isset($row['persona_id']) ? (int)$row['persona_id'] : null,
            "ultimo_login_at" => $row['ultimo_login_at'],
            "ultimo_login_ip" => $row['ultimo_login_ip'],
            "requiere_cambio_password" => (int)$row['requiere_cambio_password'] === 1,
            "intentos_fallidos" => (int)$row['intentos_fallidos'],
            "bloqueado_hasta" => $row['bloqueado_hasta'],
            "token_version" => (int)$row['token_version'],
            "created_at" => $row['created_at'],
            "updated_at" => $row['updated_at']
        ],
        "rol" => [
            "rol_id" => (int)$row['rol_id'],
            "codigo" => $row['rol_codigo'],
            "nombre" => $row['rol_nombre'],
            "nivel_jerarquico" => (int)$row['nivel_jerarquico']
        ],
        "estatus" => [
            "estatus_id" => (int)$row['estatus_id'],
            "codigo" => $row['estatus_codigo'],
            "nombre" => $row['estatus_nombre']
        ],
        "persona" => [
            "persona_id" => isset($row['persona_id']) ? (int)$row['persona_id'] : null,
            "nombres" => $row['persona_nombres'],
            "apellido_paterno" => $row['persona_apellido_paterno'],
            "apellido_materno" => $row['persona_apellido_materno'],
            "email" => $row['persona_email'],
            "telefono" => $row['persona_telefono'],
            "whatsapp" => $row['persona_whatsapp']
        ],
        "reporta_a" => get_usuario_padre($con, $usuario_id),
        "territorios" => get_territorios_usuario($con, $usuario_id),
        "hijos_directos" => get_hijos_directos($con, $usuario_id)
    ];

    if ($includeTree) {
        $data["jerarquia_descendente"] = get_jerarquia_descendente($con, $usuario_id);
    }

    return $data;
}

/* ============================================================
   CONSULTAS PERSONA
   ============================================================ */

function get_persona_full(mysqli $con, int $persona_id): ?array {
    $sql = "
        SELECT
            p.*,
            e.codigo AS estatus_codigo,
            e.nombre AS estatus_nombre,
            t.territorio_id AS seccion_territorio_id,
            t.codigo AS seccion_codigo,
            t.nombre AS seccion_nombre,
            t.tipo AS seccion_tipo,
            z.territorio_id AS zona_id,
            z.codigo AS zona_codigo,
            z.nombre AS zona_nombre
        FROM persona p
        INNER JOIN cat_estatus e
            ON e.estatus_id = p.estatus_id
        LEFT JOIN territorio t
            ON t.territorio_id = p.seccion_id
        LEFT JOIN territorio z
            ON z.territorio_id = t.territorio_padre_id
        WHERE p.persona_id = ?
          AND p.deleted_at IS NULL
        LIMIT 1
    ";

    $st = $con->prepare($sql);
    $st->bind_param("i", $persona_id);
    $st->execute();
    $p = $st->get_result()->fetch_assoc();
    $st->close();

    if (!$p) {
        return null;
    }

    $usuario = null;

    $qUser = $con->prepare("
        SELECT
            u.usuario_id,
            u.username,
            u.nombre,
            u.email,
            u.telefono,
            r.codigo AS rol_codigo,
            r.nombre AS rol_nombre,
            e.codigo AS estatus_codigo
        FROM usuario u
        INNER JOIN cat_rol r
            ON r.rol_id = u.rol_id
        INNER JOIN cat_estatus e
            ON e.estatus_id = u.estatus_id
        WHERE u.persona_id = ?
          AND u.deleted_at IS NULL
        LIMIT 1
    ");

    $qUser->bind_param("i", $persona_id);
    $qUser->execute();
    $usuario = $qUser->get_result()->fetch_assoc();
    $qUser->close();

    if ($usuario) {
        $usuario['usuario_id'] = (int)$usuario['usuario_id'];
    }

    $participaciones = [];

    $qPart = $con->prepare("
        SELECT
            pp.participacion_id,
            pp.folio,
            pp.tipo_participacion,
            pp.estatus_id,
            e.codigo AS estatus_codigo,
            e.nombre AS estatus_nombre,
            pp.territorio_id,
            t.codigo AS territorio_codigo,
            t.nombre AS territorio_nombre,
            pp.usuario_responsable_id,
            u.username AS usuario_responsable_username,
            u.nombre AS usuario_responsable_nombre,
            pp.fuente_captura,
            pp.fecha_registro,
            pp.fecha_afiliacion,
            pp.numero_afiliacion,
            pp.activo,
            pp.observaciones
        FROM persona_participacion pp
        INNER JOIN cat_estatus e
            ON e.estatus_id = pp.estatus_id
        LEFT JOIN territorio t
            ON t.territorio_id = pp.territorio_id
        LEFT JOIN usuario u
            ON u.usuario_id = pp.usuario_responsable_id
        WHERE pp.persona_id = ?
          AND pp.deleted_at IS NULL
        ORDER BY pp.fecha_registro DESC
    ");

    $qPart->bind_param("i", $persona_id);
    $qPart->execute();
    $rsPart = $qPart->get_result();

    while ($row = $rsPart->fetch_assoc()) {
        $row['participacion_id'] = (int)$row['participacion_id'];
        $row['estatus_id'] = (int)$row['estatus_id'];
        $row['territorio_id'] = isset($row['territorio_id']) ? (int)$row['territorio_id'] : null;
        $row['usuario_responsable_id'] = isset($row['usuario_responsable_id']) ? (int)$row['usuario_responsable_id'] : null;
        $row['activo'] = (int)$row['activo'];
        $participaciones[] = $row;
    }

    $qPart->close();

    return [
        "persona" => [
            "persona_id" => (int)$p['persona_id'],
            "uuid" => $p['uuid'],
            "nombres" => $p['nombres'],
            "apellido_paterno" => $p['apellido_paterno'],
            "apellido_materno" => $p['apellido_materno'],
            "fecha_nacimiento" => $p['fecha_nacimiento'],
            "sexo" => $p['sexo'],
            "seccion_id" => isset($p['seccion_id']) ? (int)$p['seccion_id'] : null,
            "anio_registro" => isset($p['anio_registro']) ? (int)$p['anio_registro'] : null,
            "emision" => isset($p['emision']) ? (int)$p['emision'] : null,
            "vigencia_inicio" => $p['vigencia_inicio'],
            "vigencia_fin" => $p['vigencia_fin'],
            "domicilio_texto" => $p['domicilio_texto'],
            "calle" => $p['calle'],
            "numero_exterior" => $p['numero_exterior'],
            "numero_interior" => $p['numero_interior'],
            "colonia" => $p['colonia'],
            "localidad" => $p['localidad'],
            "municipio" => $p['municipio'],
            "estado" => $p['estado'],
            "codigo_postal" => $p['codigo_postal'],
            "telefono" => $p['telefono'],
            "whatsapp" => $p['whatsapp'],
            "email" => $p['email'],
            "acepta_tratamiento_datos" => (int)$p['acepta_tratamiento_datos'] === 1,
            "acepta_datos_sensibles" => (int)$p['acepta_datos_sensibles'] === 1,
            "acepta_contacto_whatsapp" => (int)$p['acepta_contacto_whatsapp'] === 1,
            "aviso_privacidad_version" => $p['aviso_privacidad_version'],
            "fecha_consentimiento" => $p['fecha_consentimiento'],
            "observaciones" => $p['observaciones'],
            "created_at" => $p['created_at'],
            "updated_at" => $p['updated_at']
        ],
        "estatus" => [
            "estatus_id" => (int)$p['estatus_id'],
            "codigo" => $p['estatus_codigo'],
            "nombre" => $p['estatus_nombre']
        ],
        "territorio" => [
            "seccion" => [
                "territorio_id" => isset($p['seccion_territorio_id']) ? (int)$p['seccion_territorio_id'] : null,
                "codigo" => $p['seccion_codigo'],
                "nombre" => $p['seccion_nombre'],
                "tipo" => $p['seccion_tipo']
            ],
            "zona" => [
                "territorio_id" => isset($p['zona_id']) ? (int)$p['zona_id'] : null,
                "codigo" => $p['zona_codigo'],
                "nombre" => $p['zona_nombre']
            ]
        ],
        "participaciones" => $participaciones,
        "usuario" => $usuario
    ];
}

/* ============================================================
   INSERT / UPDATE PERSONA
   ============================================================ */

function insertar_persona(mysqli $con, array $in, int $actor_id): array {
    $nombres = trim((string)($in['nombres'] ?? ''));

    if ($nombres === '') {
        json_response([
            "ok" => false,
            "error" => "Falta nombres"
        ], 400);
    }

    $estatus_id = isset($in['estatus_id'])
        ? (int)$in['estatus_id']
        : get_estatus_id($con, 'ACTIVO');

    $columns = [
        "uuid",
        "nombres",
        "estatus_id",
        "capturado_por",
        "created_by"
    ];

    $placeholders = ["?", "?", "?", "?", "?"];
    $params = [
        uuidv4(),
        $nombres,
        $estatus_id,
        $actor_id,
        $actor_id
    ];
    $types = "ssiii";

    $map = [
        "apellido_paterno" => "s",
        "apellido_materno" => "s",
        "fecha_nacimiento" => "s",
        "sexo" => "s",
        "seccion_id" => "i",
        "anio_registro" => "i",
        "emision" => "i",
        "vigencia_inicio" => "s",
        "vigencia_fin" => "s",
        "domicilio_texto" => "s",
        "calle" => "s",
        "numero_exterior" => "s",
        "numero_interior" => "s",
        "colonia" => "s",
        "localidad" => "s",
        "municipio" => "s",
        "estado" => "s",
        "codigo_postal" => "s",
        "telefono" => "s",
        "whatsapp" => "s",
        "email" => "s",
        "acepta_tratamiento_datos" => "i",
        "acepta_datos_sensibles" => "i",
        "acepta_contacto_whatsapp" => "i",
        "aviso_privacidad_version" => "s",
        "fecha_consentimiento" => "s",
        "observaciones" => "s"
    ];

    foreach ($map as $field => $type) {
        if (array_key_exists($field, $in)) {
            $columns[] = $field;
            $placeholders[] = "?";
            $params[] = value_or_null($in, $field);
            $types .= $type;
        }
    }

    $sql = "
        INSERT INTO persona (
            " . implode(", ", $columns) . "
        )
        VALUES (
            " . implode(", ", $placeholders) . "
        )
    ";

    $st = $con->prepare($sql);
    bind_params($st, $types, $params);
    $st->execute();
    $persona_id = (int)$con->insert_id;
    $st->close();

    log_bitacora($con, 'persona', $persona_id, 'INSERT', 'Alta de persona', $actor_id, null, $in);

    return get_persona_full($con, $persona_id);
}

function editar_persona(mysqli $con, array $in, int $actor_id): array {
    $persona_id = (int)($in['persona_id'] ?? 0);

    if ($persona_id <= 0) {
        json_response([
            "ok" => false,
            "error" => "Falta persona_id"
        ], 400);
    }

    $anterior = get_persona_full($con, $persona_id);

    if (!$anterior) {
        json_response([
            "ok" => false,
            "error" => "Persona no encontrada"
        ], 404);
    }

    $map = [
        "nombres" => "s",
        "apellido_paterno" => "s",
        "apellido_materno" => "s",
        "fecha_nacimiento" => "s",
        "sexo" => "s",
        "seccion_id" => "i",
        "anio_registro" => "i",
        "emision" => "i",
        "vigencia_inicio" => "s",
        "vigencia_fin" => "s",
        "domicilio_texto" => "s",
        "calle" => "s",
        "numero_exterior" => "s",
        "numero_interior" => "s",
        "colonia" => "s",
        "localidad" => "s",
        "municipio" => "s",
        "estado" => "s",
        "codigo_postal" => "s",
        "telefono" => "s",
        "whatsapp" => "s",
        "email" => "s",
        "acepta_tratamiento_datos" => "i",
        "acepta_datos_sensibles" => "i",
        "acepta_contacto_whatsapp" => "i",
        "aviso_privacidad_version" => "s",
        "fecha_consentimiento" => "s",
        "estatus_id" => "i",
        "observaciones" => "s"
    ];

    $sets = [];
    $params = [];
    $types = "";

    foreach ($map as $field => $type) {
        if (array_key_exists($field, $in)) {
            $sets[] = "$field = ?";
            $params[] = value_or_null($in, $field);
            $types .= $type;
        }
    }

    if (empty($sets)) {
        json_response([
            "ok" => false,
            "error" => "No hay campos para actualizar"
        ], 400);
    }

    $sets[] = "updated_by = ?";
    $params[] = $actor_id;
    $types .= "i";

    $params[] = $persona_id;
    $types .= "i";

    $sql = "
        UPDATE persona
        SET " . implode(", ", $sets) . "
        WHERE persona_id = ?
          AND deleted_at IS NULL
    ";

    $st = $con->prepare($sql);
    bind_params($st, $types, $params);
    $st->execute();
    $st->close();

    $nuevo = get_persona_full($con, $persona_id);

    log_bitacora($con, 'persona', $persona_id, 'UPDATE', 'Edición de persona', $actor_id, $anterior, $nuevo);

    return $nuevo;
}

/* ============================================================
   INSERT / UPDATE USUARIO
   ============================================================ */

function asignar_territorios_usuario(mysqli $con, int $usuario_id, array $territorios, int $actor_id): void {
    $del = $con->prepare("DELETE FROM usuario_territorio WHERE usuario_id = ?");
    $del->bind_param("i", $usuario_id);
    $del->execute();
    $del->close();

    if (empty($territorios)) {
        return;
    }

    $ins = $con->prepare("
        INSERT INTO usuario_territorio (
            usuario_id,
            territorio_id,
            fecha_inicio,
            activo,
            created_by
        )
        VALUES (?, ?, CURDATE(), 1, ?)
    ");

    foreach ($territorios as $territorio_id) {
        $tid = (int)$territorio_id;

        if ($tid <= 0) {
            continue;
        }

        $ins->bind_param("iii", $usuario_id, $tid, $actor_id);
        $ins->execute();
    }

    $ins->close();
}

function asignar_padre_usuario(mysqli $con, int $usuario_id, ?int $usuario_padre_id, int $actor_id): void {
    $del = $con->prepare("DELETE FROM usuario_jerarquia WHERE usuario_hijo_id = ?");
    $del->bind_param("i", $usuario_id);
    $del->execute();
    $del->close();

    if (!$usuario_padre_id || $usuario_padre_id <= 0) {
        return;
    }

    if ($usuario_padre_id === $usuario_id) {
        json_response([
            "ok" => false,
            "error" => "Un usuario no puede reportarse a sí mismo"
        ], 400);
    }

    $ins = $con->prepare("
        INSERT INTO usuario_jerarquia (
            usuario_padre_id,
            usuario_hijo_id,
            fecha_inicio,
            activo,
            created_by
        )
        VALUES (?, ?, CURDATE(), 1, ?)
    ");

    $ins->bind_param("iii", $usuario_padre_id, $usuario_id, $actor_id);
    $ins->execute();
    $ins->close();
}

function insertar_usuario(mysqli $con, array $in, int $actor_id): array {
    $username = trim((string)($in['username'] ?? ''));
    $nombre = trim((string)($in['nombre'] ?? ''));
    $email = trim((string)($in['email'] ?? ''));
    $password = (string)($in['password'] ?? '');

    if ($username === '' || $nombre === '' || $email === '' || $password === '') {
        json_response([
            "ok" => false,
            "error" => "Faltan campos requeridos: username, nombre, email, password"
        ], 400);
    }

    if (strlen($password) < 8) {
        json_response([
            "ok" => false,
            "error" => "La contraseña debe tener al menos 8 caracteres"
        ], 400);
    }

    $rol_id = get_rol_id(
        $con,
        isset($in['rol_id']) ? (int)$in['rol_id'] : null,
        $in['rol_codigo'] ?? null
    );

    $estatus_id = isset($in['estatus_id'])
        ? (int)$in['estatus_id']
        : get_estatus_id($con, 'ACTIVO');

    $persona_id = isset($in['persona_id']) ? (int)$in['persona_id'] : 0;

    if ($persona_id <= 0) {
        $personaPayload = [
            "nombres" => $nombre,
            "apellido_paterno" => $in['apellido_paterno'] ?? null,
            "apellido_materno" => $in['apellido_materno'] ?? null,
            "telefono" => $in['telefono'] ?? null,
            "email" => $email,
            "estatus_id" => $estatus_id,
            "observaciones" => "Persona creada automáticamente para usuario $username"
        ];

        $persona = insertar_persona($con, $personaPayload, $actor_id);
        $persona_id = (int)$persona['persona']['persona_id'];
    }

    $uuid = uuidv4();
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $requiere_cambio = (int)($in['requiere_cambio_password'] ?? 1);

    $sql = "
        INSERT INTO usuario (
            uuid,
            username,
            persona_id,
            rol_id,
            nombre,
            apellido_paterno,
            apellido_materno,
            email,
            telefono,
            password_hash,
            estatus_id,
            requiere_cambio_password,
            created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ";

    $params = [
        $uuid,
        $username,
        $persona_id,
        $rol_id,
        $nombre,
        value_or_null($in, 'apellido_paterno'),
        value_or_null($in, 'apellido_materno'),
        $email,
        value_or_null($in, 'telefono'),
        $hash,
        $estatus_id,
        $requiere_cambio,
        $actor_id
    ];

    $types = "ssiissssssiii";

    $st = $con->prepare($sql);
    bind_params($st, $types, $params);
    $st->execute();
    $usuario_id = (int)$con->insert_id;
    $st->close();

    if (isset($in['territorios']) && is_array($in['territorios'])) {
        asignar_territorios_usuario($con, $usuario_id, $in['territorios'], $actor_id);
    }

    if (array_key_exists('usuario_padre_id', $in)) {
        $padre = $in['usuario_padre_id'] ? (int)$in['usuario_padre_id'] : null;
        asignar_padre_usuario($con, $usuario_id, $padre, $actor_id);
    }

    $nuevo = get_usuario_full($con, $usuario_id, true);

    log_bitacora($con, 'usuario', $usuario_id, 'INSERT', 'Alta de usuario', $actor_id, null, $nuevo);

    return $nuevo;
}

function editar_usuario(mysqli $con, array $in, int $actor_id): array {
    $usuario_id = (int)($in['usuario_id'] ?? 0);

    if ($usuario_id <= 0) {
        json_response([
            "ok" => false,
            "error" => "Falta usuario_id"
        ], 400);
    }

    $anterior = get_usuario_full($con, $usuario_id, true);

    if (!$anterior) {
        json_response([
            "ok" => false,
            "error" => "Usuario no encontrado"
        ], 404);
    }

    if (isset($in['rol_codigo']) && !isset($in['rol_id'])) {
        $in['rol_id'] = get_rol_id($con, null, $in['rol_codigo']);
    }

    $map = [
        "username" => "s",
        "persona_id" => "i",
        "rol_id" => "i",
        "nombre" => "s",
        "apellido_paterno" => "s",
        "apellido_materno" => "s",
        "email" => "s",
        "telefono" => "s",
        "estatus_id" => "i",
        "requiere_cambio_password" => "i"
    ];

    $sets = [];
    $params = [];
    $types = "";

    foreach ($map as $field => $type) {
        if (array_key_exists($field, $in)) {
            $sets[] = "$field = ?";
            $params[] = value_or_null($in, $field);
            $types .= $type;
        }
    }

    if (isset($in['password']) && trim((string)$in['password']) !== '') {
        if (strlen((string)$in['password']) < 8) {
            json_response([
                "ok" => false,
                "error" => "La contraseña debe tener al menos 8 caracteres"
            ], 400);
        }

        $sets[] = "password_hash = ?";
        $params[] = password_hash((string)$in['password'], PASSWORD_DEFAULT);
        $types .= "s";

        $sets[] = "token_version = token_version + 1";
    }

    if (!empty($sets)) {
        $sets[] = "updated_by = ?";
        $params[] = $actor_id;
        $types .= "i";

        $params[] = $usuario_id;
        $types .= "i";

        $sql = "
            UPDATE usuario
            SET " . implode(", ", $sets) . "
            WHERE usuario_id = ?
              AND deleted_at IS NULL
        ";

        $st = $con->prepare($sql);
        bind_params($st, $types, $params);
        $st->execute();
        $st->close();
    }

    if (isset($in['territorios']) && is_array($in['territorios'])) {
        asignar_territorios_usuario($con, $usuario_id, $in['territorios'], $actor_id);
    }

    if (array_key_exists('usuario_padre_id', $in)) {
        $padre = $in['usuario_padre_id'] ? (int)$in['usuario_padre_id'] : null;
        asignar_padre_usuario($con, $usuario_id, $padre, $actor_id);
    }

    $nuevo = get_usuario_full($con, $usuario_id, true);

    log_bitacora($con, 'usuario', $usuario_id, 'UPDATE', 'Edición de usuario', $actor_id, $anterior, $nuevo);

    return $nuevo;
}

/* ============================================================
   CONSULTAR LISTAS
   ============================================================ */

function consultar_usuarios(mysqli $con, array $in): array {
    if (!empty($in['usuario_id'])) {
        $u = get_usuario_full($con, (int)$in['usuario_id'], true);

        if (!$u) {
            json_response([
                "ok" => false,
                "error" => "Usuario no encontrado"
            ], 404);
        }

        return $u;
    }

    if (!empty($in['username'])) {
        $username = trim((string)$in['username']);

        $sql = "
            SELECT usuario_id
            FROM usuario
            WHERE username COLLATE utf8mb4_unicode_ci = ? COLLATE utf8mb4_unicode_ci
              AND deleted_at IS NULL
            LIMIT 1
        ";

        $st = $con->prepare($sql);
        $st->bind_param("s", $username);
        $st->execute();
        $row = $st->get_result()->fetch_assoc();
        $st->close();

        if (!$row) {
            json_response([
                "ok" => false,
                "error" => "Usuario no encontrado"
            ], 404);
        }

        return get_usuario_full($con, (int)$row['usuario_id'], true);
    }

    $limit = min(max((int)($in['limit'] ?? 50), 1), 200);
    $page = max((int)($in['page'] ?? 1), 1);
    $offset = ($page - 1) * $limit;
    $search = trim((string)($in['search'] ?? ''));

    $where = ["u.deleted_at IS NULL"];
    $params = [];
    $types = "";

    if ($search !== '') {
        $where[] = "(
            u.username LIKE ?
            OR u.nombre LIKE ?
            OR u.email LIKE ?
            OR u.apellido_paterno LIKE ?
            OR u.apellido_materno LIKE ?
        )";

        $like = "%$search%";

        for ($i = 0; $i < 5; $i++) {
            $params[] = $like;
            $types .= "s";
        }
    }

    if (!empty($in['rol_codigo'])) {
        $where[] = "r.codigo = ?";
        $params[] = $in['rol_codigo'];
        $types .= "s";
    }

    if (!empty($in['estatus_codigo'])) {
        $where[] = "e.codigo = ?";
        $params[] = $in['estatus_codigo'];
        $types .= "s";
    }

    $params[] = $limit;
    $types .= "i";

    $params[] = $offset;
    $types .= "i";

    $sql = "
        SELECT u.usuario_id
        FROM usuario u
        INNER JOIN cat_rol r
            ON r.rol_id = u.rol_id
        INNER JOIN cat_estatus e
            ON e.estatus_id = u.estatus_id
        WHERE " . implode(" AND ", $where) . "
        ORDER BY r.nivel_jerarquico, u.username
        LIMIT ? OFFSET ?
    ";

    $st = $con->prepare($sql);
    bind_params($st, $types, $params);
    $st->execute();
    $rs = $st->get_result();

    $items = [];

    while ($row = $rs->fetch_assoc()) {
        $items[] = get_usuario_full($con, (int)$row['usuario_id'], false);
    }

    $st->close();

    return [
        "page" => $page,
        "limit" => $limit,
        "items" => $items
    ];
}

function consultar_personas(mysqli $con, array $in): array {
    if (!empty($in['persona_id'])) {
        $p = get_persona_full($con, (int)$in['persona_id']);

        if (!$p) {
            json_response([
                "ok" => false,
                "error" => "Persona no encontrada"
            ], 404);
        }

        return $p;
    }

    $limit = min(max((int)($in['limit'] ?? 50), 1), 200);
    $page = max((int)($in['page'] ?? 1), 1);
    $offset = ($page - 1) * $limit;
    $search = trim((string)($in['search'] ?? ''));

    $where = ["p.deleted_at IS NULL"];
    $params = [];
    $types = "";

    if ($search !== '') {
        $where[] = "(
            p.nombres LIKE ?
            OR p.apellido_paterno LIKE ?
            OR p.apellido_materno LIKE ?
            OR p.email LIKE ?
            OR p.telefono LIKE ?
            OR p.whatsapp LIKE ?
        )";

        $like = "%$search%";

        for ($i = 0; $i < 6; $i++) {
            $params[] = $like;
            $types .= "s";
        }
    }

    if (!empty($in['seccion_id'])) {
        $where[] = "p.seccion_id = ?";
        $params[] = (int)$in['seccion_id'];
        $types .= "i";
    }

    if (!empty($in['estatus_id'])) {
        $where[] = "p.estatus_id = ?";
        $params[] = (int)$in['estatus_id'];
        $types .= "i";
    }

    $params[] = $limit;
    $types .= "i";

    $params[] = $offset;
    $types .= "i";

    $sql = "
        SELECT p.persona_id
        FROM persona p
        WHERE " . implode(" AND ", $where) . "
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
    ";

    $st = $con->prepare($sql);
    bind_params($st, $types, $params);
    $st->execute();
    $rs = $st->get_result();

    $items = [];

    while ($row = $rs->fetch_assoc()) {
        $items[] = get_persona_full($con, (int)$row['persona_id']);
    }

    $st->close();

    return [
        "page" => $page,
        "limit" => $limit,
        "items" => $items
    ];
}

/* ============================================================
   MAIN
   ============================================================ */

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        json_response([
            "ok" => false,
            "error" => "Método no permitido. Usa POST."
        ], 405);
    }

    $con = db();
    $auth = require_auth($con, $JWT_SECRET, $JWT_ISSUER, $JWT_AUDIENCE);
    $actor_id = (int)$auth['usuario_id'];

    $in = read_json_body();

    $modulo = strtolower(trim((string)($in['modulo'] ?? '')));
    $accion = strtolower(trim((string)($in['accion'] ?? '')));

    if ($modulo === '' || $accion === '') {
        json_response([
            "ok" => false,
            "error" => "Faltan parámetros: modulo y accion"
        ], 400);
    }

    if ($modulo === 'catalogos') {
        if ($accion !== 'consultar') {
            json_response([
                "ok" => false,
                "error" => "Acción inválida para catalogos"
            ], 400);
        }

        $data = consultar_catalogos($con);
        $con->close();

        json_response([
            "ok" => true,
            "data" => $data
        ]);
    }

    $con->begin_transaction();

    switch ($modulo) {
        case 'persona':
        case 'personas':
            if ($accion === 'consultar') {
                $con->commit();
                $data = consultar_personas($con, $in);
            } elseif ($accion === 'insertar') {
                $data = insertar_persona($con, $in, $actor_id);
                $con->commit();
            } elseif ($accion === 'editar') {
                $data = editar_persona($con, $in, $actor_id);
                $con->commit();
            } else {
                $con->rollback();
                json_response([
                    "ok" => false,
                    "error" => "Acción inválida para persona"
                ], 400);
            }
            break;

        case 'usuario':
        case 'usuarios':
            if ($accion === 'consultar') {
                $con->commit();
                $data = consultar_usuarios($con, $in);
            } elseif ($accion === 'insertar') {
                $data = insertar_usuario($con, $in, $actor_id);
                $con->commit();
            } elseif ($accion === 'editar') {
                $data = editar_usuario($con, $in, $actor_id);
                $con->commit();
            } else {
                $con->rollback();
                json_response([
                    "ok" => false,
                    "error" => "Acción inválida para usuario"
                ], 400);
            }
            break;

        default:
            $con->rollback();
            json_response([
                "ok" => false,
                "error" => "Módulo inválido. Usa usuario, persona o catalogos."
            ], 400);
    }

    $con->close();

    json_response([
        "ok" => true,
        "data" => $data
    ]);

} catch (mysqli_sql_exception $e) {
    if (isset($con) && $con instanceof mysqli) {
        try {
            $con->rollback();
            $con->close();
        } catch (Throwable $ignored) {}
    }

    if ((int)$e->getCode() === 1062) {
        json_response([
            "ok" => false,
            "error" => "Registro duplicado. Revisa username, email, persona o clave única."
        ], 409);
    }

    internal_error("SQL error: " . $e->getMessage());

} catch (Throwable $e) {
    if (isset($con) && $con instanceof mysqli) {
        try {
            $con->rollback();
            $con->close();
        } catch (Throwable $ignored) {}
    }

    internal_error($e->getMessage());
}