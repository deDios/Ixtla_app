<?php
header('Content-Type: application/json');
$raw = file_get_contents('php://input');
echo json_encode([
  "ok" => true,
  "file" => __FILE__,
  "method" => $_SERVER['REQUEST_METHOD'] ?? null,
  "content_type" => $_SERVER['CONTENT_TYPE'] ?? null,
  "len" => strlen($raw),
  "raw" => $raw
]);