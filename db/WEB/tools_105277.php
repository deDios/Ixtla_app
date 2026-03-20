<?php
// DB/WEB/tools_105277.php
// este es un archivo par afunciones que ayuden a los endpoints y events 
// a obtener valores mas facilmente o mensajeria de whatsapp bussiness

declare(strict_types=1);

/**
 * sanitiza el telefono, no deberia venir con cosas raras pero por si acaso
 */
function phone_digits(?string $tel): string
{
  if ($tel === null) return "";
  return preg_replace('/\D+/', '', $tel) ?? "";
}

/**
 * Obtiene el empleado "Primera Linea" (PL) de un departamento
 *   departamento.primera_linea = empleado.id
 *
 * @param mysqli $con conexion mysql
 * @param int    $departamentoId ID del departamento
 *
 * @return array|null  null si no existe PL configurado o no se encuentra.
 *   [
 *     'id' => int,
 *     'nombre' => string,
 *     'apellidos' => string,
 *     'telefono' => string,
 *     'email' => string|null,
 *     'puesto' => string|null,
 *     'departamento_id' => int|null,
 *     'status' => int|null,
 *   ]
 */
function getPLByDepartamento(mysqli $con, int $departamentoId): ?array
{
  if ($departamentoId <= 0) return null;

  // buscar el id del PL en el departamento
  $plId = null;

  $st = $con->prepare("SELECT primera_linea FROM departamento WHERE id = ? LIMIT 1");
  if (!$st) return null;

  $st->bind_param("i", $departamentoId);
  if (!$st->execute()) { $st->close(); return null; }

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) return null;

  $plId = isset($row["primera_linea"]) ? (int)$row["primera_linea"] : 0;
  if ($plId <= 0) return null;

  // traer datos del empleado PL de EMPLEADO
  $st2 = $con->prepare("
    SELECT id, nombre, apellidos, telefono, email, puesto, departamento_id, status
    FROM empleado
    WHERE id = ?
    LIMIT 1
  ");
  if (!$st2) return null;

  $st2->bind_param("i", $plId);
  if (!$st2->execute()) { $st2->close(); return null; }

  $emp = $st2->get_result()->fetch_assoc();
  $st2->close();

  if (!$emp) return null;

  return [
    "id" => (int)$emp["id"],
    "nombre" => (string)($emp["nombre"] ?? ""),
    "apellidos" => (string)($emp["apellidos"] ?? ""),
    "telefono" => phone_digits($emp["telefono"] ?? null),
    "email" => isset($emp["email"]) ? (string)$emp["email"] : null,
    "puesto" => isset($emp["puesto"]) ? (string)$emp["puesto"] : null,
    "departamento_id" => isset($emp["departamento_id"]) ? (int)$emp["departamento_id"] : null,
    "status" => isset($emp["status"]) ? (int)$emp["status"] : null,
  ];
}







/**
 * Normaliza roles de un empleado a un arreglo simple de códigos:
 *   ["ADMIN", "DIRECTOR", ...]
 *
 * @param array|null $empleadoFull Estructura como la devuelve ixtla01_c_empleado.php
 * @return array
 */
function rbac_role_codes_from_empleado(?array $empleadoFull): array
{
  if (!$empleadoFull) return [];

  $roles = $empleadoFull['cuenta']['roles'] ?? [];
  if (!is_array($roles)) return [];

  $codes = [];
  foreach ($roles as $r) {
    $code = strtoupper(trim((string)($r['codigo'] ?? '')));
    if ($code !== '') $codes[] = $code;
  }

  $codes = array_values(array_unique($codes));
  sort($codes);

  return $codes;
}

/**
 * Consulta un empleado por id con cuenta + roles
 * (equivalente backend del detalle de ixtla01_c_empleado.php)
 *
 * @param mysqli $con
 * @param int    $empleadoId
 * @return array|null
 */
function rbac_get_empleado_full_by_id(mysqli $con, int $empleadoId): ?array
{
  if ($empleadoId <= 0) return null;

  $sql = "
    SELECT e.*, c.id AS cuenta_id, c.username, c.reporta_a, c.debe_cambiar_pw,
           c.intentos_fallidos, c.status AS status_cuenta, c.ultima_sesion
    FROM empleado e
    LEFT JOIN empleado_cuenta c ON c.empleado_id = e.id
    WHERE e.id = ?
    LIMIT 1
  ";
  $st = $con->prepare($sql);
  if (!$st) return null;

  $st->bind_param("i", $empleadoId);
  if (!$st->execute()) {
    $st->close();
    return null;
  }

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) return null;

  $roles = [];
  if (!empty($row['cuenta_id'])) {
    $st = $con->prepare("
      SELECT r.id, r.codigo, r.nombre
      FROM empleado_rol er
      JOIN rol r ON r.id = er.rol_id
      WHERE er.empleado_cuenta_id = ?
      ORDER BY r.codigo
    ");
    if ($st) {
      $cuentaId = (int)$row['cuenta_id'];
      $st->bind_param("i", $cuentaId);
      if ($st->execute()) {
        $rs = $st->get_result();
        while ($r = $rs->fetch_assoc()) {
          $roles[] = [
            "id" => (int)$r['id'],
            "codigo" => (string)$r['codigo'],
            "nombre" => (string)$r['nombre'],
          ];
        }
      }
      $st->close();
    }
  }

  return [
    "id" => (int)$row['id'],
    "nombre" => (string)($row['nombre'] ?? ''),
    "apellidos" => (string)($row['apellidos'] ?? ''),
    "email" => (string)($row['email'] ?? ''),
    "telefono" => (string)($row['telefono'] ?? ''),
    "puesto" => (string)($row['puesto'] ?? ''),
    "departamento_id" => isset($row['departamento_id']) ? (int)$row['departamento_id'] : null,
    "status" => isset($row['status']) ? (int)$row['status'] : null,
    "created_at" => $row['created_at'] ?? null,
    "updated_at" => $row['updated_at'] ?? null,
    "created_by" => isset($row['created_by']) ? (int)$row['created_by'] : null,
    "updated_by" => isset($row['updated_by']) ? (int)$row['updated_by'] : null,
    "cuenta" => !empty($row['cuenta_id']) ? [
      "id" => (int)$row['cuenta_id'],
      "username" => (string)($row['username'] ?? ''),
      "reporta_a" => isset($row['reporta_a']) ? (int)$row['reporta_a'] : null,
      "debe_cambiar_pw" => isset($row['debe_cambiar_pw']) ? (int)$row['debe_cambiar_pw'] : 0,
      "intentos_fallidos" => isset($row['intentos_fallidos']) ? (int)$row['intentos_fallidos'] : 0,
      "status" => isset($row['status_cuenta']) ? (int)$row['status_cuenta'] : null,
      "ultima_sesion" => $row['ultima_sesion'] ?? null,
      "roles" => $roles
    ] : null
  ];
}

/**
 * Obtiene un departamento por id
 *
 * @param mysqli $con
 * @param int    $departamentoId
 * @return array|null
 */
function rbac_get_departamento_by_id(mysqli $con, int $departamentoId): ?array
{
  if ($departamentoId <= 0) return null;

  $sql = "
    SELECT d.*,
           e1.nombre AS director_nombre, e1.apellidos AS director_apellidos,
           e2.nombre AS primera_nombre,  e2.apellidos AS primera_apellidos
    FROM departamento d
    LEFT JOIN empleado e1 ON d.director = e1.id
    LEFT JOIN empleado e2 ON d.primera_linea = e2.id
    WHERE d.id = ?
    LIMIT 1
  ";

  $st = $con->prepare($sql);
  if (!$st) return null;

  $st->bind_param("i", $departamentoId);
  if (!$st->execute()) {
    $st->close();
    return null;
  }

  $row = $st->get_result()->fetch_assoc();
  $st->close();

  if (!$row) return null;

  return [
    "id" => (int)$row['id'],
    "nombre" => (string)($row['nombre'] ?? ''),
    "descripcion" => (string)($row['descripcion'] ?? ''),
    "director" => isset($row['director']) ? (int)$row['director'] : null,
    "primera_linea" => isset($row['primera_linea']) ? (int)$row['primera_linea'] : null,
    "status" => isset($row['status']) ? (int)$row['status'] : null,
    "director_nombre" => trim((string)(($row['director_nombre'] ?? '') . ' ' . ($row['director_apellidos'] ?? ''))),
    "primera_nombre" => trim((string)(($row['primera_nombre'] ?? '') . ' ' . ($row['primera_apellidos'] ?? ''))),
  ];
}

/**
 * Calcula el RBAC de un empleado
 *
 * Reglas actuales:
 * - ADMIN -> global
 * - departamento_id = 6 (Presidencia) -> global
 * - DIRECTOR o primera_linea -> department
 * - JEFE o ANALISTA -> team
 * - resto -> self
 *
 * Scope acumulativo:
 * - global => department, team, self también true
 * - department => team, self también true
 * - team => self también true
 *
 * @param mysqli $con
 * @param int    $empleadoId
 * @param array  $opts
 * @return array|null
 */
function rbac_compute_by_empleado_id(mysqli $con, int $empleadoId, array $opts = []): ?array
{
  if ($empleadoId <= 0) return null;

  $presidenciaDeptIds = $opts['presidencia_dept_ids'] ?? [6];
  if (!is_array($presidenciaDeptIds)) $presidenciaDeptIds = [6];

  $emp = rbac_get_empleado_full_by_id($con, $empleadoId);
  if (!$emp) return null;

  $roles = rbac_role_codes_from_empleado($emp);
  $deptId = isset($emp['departamento_id']) ? (int)$emp['departamento_id'] : 0;
  $cuentaId = isset($emp['cuenta']['id']) ? (int)$emp['cuenta']['id'] : null;
  $reportaA = isset($emp['cuenta']['reporta_a']) ? (int)$emp['cuenta']['reporta_a'] : null;

  $dept = $deptId > 0 ? rbac_get_departamento_by_id($con, $deptId) : null;

  $isAdmin = in_array('ADMIN', $roles, true);
  $isPresidencia = in_array($deptId, array_map('intval', $presidenciaDeptIds), true);
  $isDirector = in_array('DIRECTOR', $roles, true);
  $isPrimeraLinea = !!($dept && isset($dept['primera_linea']) && (int)$dept['primera_linea'] === $empleadoId);
  $isJefe = in_array('JEFE', $roles, true);
  $isAnalista = in_array('ANALISTA', $roles, true);

  $scope = [
    "global" => false,
    "department" => false,
    "team" => false,
    "self" => true,
  ];

  if ($isAdmin || $isPresidencia) {
    $scope["global"] = true;
    $scope["department"] = true;
    $scope["team"] = true;
    $scope["self"] = true;
  } elseif ($isDirector || $isPrimeraLinea) {
    $scope["global"] = false;
    $scope["department"] = true;
    $scope["team"] = true;
    $scope["self"] = true;
  } elseif ($isJefe || $isAnalista) {
    $scope["global"] = false;
    $scope["department"] = false;
    $scope["team"] = true;
    $scope["self"] = true;
  }

  return [
    "empleado" => [
      "id" => $empleadoId,
      "cuenta_id" => $cuentaId,
      "reporta_a" => $reportaA,
      "departamento_id" => $deptId > 0 ? $deptId : null,
      "roles" => $roles,
      "nombre" => trim((string)(($emp['nombre'] ?? '') . ' ' . ($emp['apellidos'] ?? ''))),
      "puesto" => (string)($emp['puesto'] ?? ''),
      "status_empleado" => isset($emp['status']) ? (int)$emp['status'] : null,
      "status_cuenta" => isset($emp['cuenta']['status']) ? (int)$emp['cuenta']['status'] : null,
    ],
    "flags" => [
      "is_admin" => $isAdmin,
      "is_presidencia" => $isPresidencia,
      "is_director" => $isDirector,
      "is_primera_linea" => $isPrimeraLinea,
      "is_jefe" => $isJefe,
      "is_analista" => $isAnalista,
    ],
    "scope" => $scope,
    "hierarchy" => [
      "director_id" => $dept && isset($dept['director']) ? (int)$dept['director'] : null,
      "primera_linea_id" => $dept && isset($dept['primera_linea']) ? (int)$dept['primera_linea'] : null,
      "director_nombre" => $dept ? (string)($dept['director_nombre'] ?? '') : '',
      "primera_linea_nombre" => $dept ? (string)($dept['primera_nombre'] ?? '') : '',
    ],
    "departamento" => $dept ? [
      "id" => (int)$dept['id'],
      "nombre" => (string)($dept['nombre'] ?? ''),
      "status" => isset($dept['status']) ? (int)$dept['status'] : null,
    ] : null,
  ];
}