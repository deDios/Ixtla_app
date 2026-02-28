<?php
// DB/WEB/tools.php
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