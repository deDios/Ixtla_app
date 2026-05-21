<?php
// extract_identificacion.php

declare(strict_types=1);

ini_set("display_errors", "0");
ini_set("log_errors", "1");
error_reporting(E_ALL);

ob_start();

function jsonResponse(array $data, int $statusCode = 200): void
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    http_response_code($statusCode);
    header("Content-Type: application/json; charset=utf-8");

    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

if (!function_exists("curl_init")) {
    jsonResponse([
        "ok" => false,
        "error" => "La extensión cURL no está habilitada en PHP."
    ], 500);
}

function loadEnv(): array
{
    $envPath = __DIR__ . "/.env";

    if (!file_exists($envPath)) {
        jsonResponse([
            "ok" => false,
            "error" => "No se encontró el archivo .env"
        ], 500);
    }

    $env = parse_ini_file($envPath);

    if (!is_array($env)) {
        jsonResponse([
            "ok" => false,
            "error" => "No se pudo leer correctamente el archivo .env"
        ], 500);
    }

    $required = [
        "WATSONX_API_KEY",
        "WATSONX_PROJECT_ID",
        "WATSONX_URL",
        "WATSONX_MODEL_ID"
    ];

    foreach ($required as $key) {
        if (empty($env[$key])) {
            jsonResponse([
                "ok" => false,
                "error" => "Falta la variable {$key} en el archivo .env"
            ], 500);
        }
    }

    if (empty($env["WATSONX_API_VERSION"])) {
        $env["WATSONX_API_VERSION"] = "2024-10-08";
    }

    return $env;
}

function curlRequest(string $url, string $method, array $headers = [], $body = null): array
{
    $ch = curl_init();

    if ($ch === false) {
        return [
            "ok" => false,
            "http_code" => 0,
            "error" => "No se pudo inicializar cURL.",
            "raw" => null,
            "json" => null
        ];
    }

    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 90,
        CURLOPT_HEADER => false,
    ]);

    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }

    $rawResponse = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    /*
     * No usar curl_close($ch) para evitar warnings Deprecated en PHP 8.5.
     */

    if ($rawResponse === false) {
        return [
            "ok" => false,
            "http_code" => 0,
            "error" => $curlError,
            "raw" => null,
            "json" => null
        ];
    }

    $json = json_decode($rawResponse, true);

    return [
        "ok" => $httpCode >= 200 && $httpCode < 300,
        "http_code" => $httpCode,
        "error" => null,
        "raw" => $rawResponse,
        "json" => $json
    ];
}

function getIamToken(string $apiKey): string
{
    $url = "https://iam.cloud.ibm.com/identity/token";

    $headers = [
        "Content-Type: application/x-www-form-urlencoded",
        "Accept: application/json"
    ];

    $body = http_build_query([
        "grant_type" => "urn:ibm:params:oauth:grant-type:apikey",
        "apikey" => $apiKey
    ]);

    $response = curlRequest($url, "POST", $headers, $body);

    if (!$response["ok"]) {
        jsonResponse([
            "ok" => false,
            "error" => "Error al generar token IAM",
            "http_code" => $response["http_code"],
            "detalle" => $response["json"] ?? $response["raw"]
        ], 500);
    }

    if (empty($response["json"]["access_token"])) {
        jsonResponse([
            "ok" => false,
            "error" => "La respuesta de IAM no contiene access_token",
            "detalle" => $response["json"]
        ], 500);
    }

    return $response["json"]["access_token"];
}

function extractWatsonxText(array $data): string
{
    $content = $data["choices"][0]["message"]["content"] ?? null;

    if (is_string($content)) {
        return trim($content);
    }

    if (is_array($content)) {
        $parts = [];

        foreach ($content as $item) {
            if (is_array($item) && isset($item["text"])) {
                $parts[] = $item["text"];
            } elseif (is_string($item)) {
                $parts[] = $item;
            }
        }

        return trim(implode("\n", $parts));
    }

    return "";
}

function cleanJsonFromModel(string $text): string
{
    $clean = trim($text);

    $clean = preg_replace('/^```json\s*/i', '', $clean);
    $clean = preg_replace('/^```\s*/', '', $clean);
    $clean = preg_replace('/\s*```$/', '', $clean);

    $firstBrace = strpos($clean, "{");
    $lastBrace = strrpos($clean, "}");

    if ($firstBrace !== false && $lastBrace !== false && $lastBrace > $firstBrace) {
        $clean = substr($clean, $firstBrace, $lastBrace - $firstBrace + 1);
    }

    return trim($clean);
}

function normalizeBasicText(string $value): string
{
    $value = trim(mb_strtolower($value, "UTF-8"));

    $map = [
        "á" => "a",
        "é" => "e",
        "í" => "i",
        "ó" => "o",
        "ú" => "u",
        "ü" => "u",
        "ñ" => "n"
    ];

    $value = strtr($value, $map);
    $value = preg_replace('/[^a-z0-9]+/u', '_', $value);
    $value = trim((string)$value, "_");

    return $value;
}

function isIneDocument(array $structured): bool
{
    $documentType = normalizeBasicText((string)($structured["document_type"] ?? ""));
    $country = normalizeBasicText((string)($structured["country"] ?? ""));

    if (str_contains($documentType, "ine")) {
        return true;
    }

    if (str_contains($documentType, "credencial")) {
        return true;
    }

    if (str_contains($country, "mexico") && str_contains($documentType, "identificacion")) {
        return true;
    }

    return false;
}

function normalizeWatsonxStructuredResult(array $structured): array
{
    if (empty($structured["fields"]) || !is_array($structured["fields"])) {
        $structured["fields"] = [];
    }

    if (empty($structured["notes"]) || !is_array($structured["notes"])) {
        $structured["notes"] = [];
    }

    $isIne = isIneDocument($structured);
    $normalizedFields = [];

    foreach ($structured["fields"] as $field) {
        if (!is_array($field)) {
            continue;
        }

        $fieldName = (string)($field["field_name"] ?? "");
        $labelDetected = (string)($field["label_detected"] ?? "");
        $value = $field["value"] ?? null;

        $normalizedFieldName = normalizeBasicText($fieldName);
        $normalizedLabel = normalizeBasicText($labelDetected);

        /*
         * Seguridad extra para INE:
         * Si el modelo manda field_name=nombre/nombres/nombre_completo pero la etiqueta trae línea,
         * reubicamos el campo según la regla del bloque NOMBRE.
         */
        if ($isIne && in_array($normalizedFieldName, ["nombre", "nombres", "nombre_completo"], true)) {
            if (
                str_contains($normalizedLabel, "linea_1") ||
                str_contains($normalizedLabel, "línea_1") ||
                str_contains($normalizedLabel, "line_1")
            ) {
                $field["field_name"] = "apellido_paterno";
            } elseif (
                str_contains($normalizedLabel, "linea_2") ||
                str_contains($normalizedLabel, "línea_2") ||
                str_contains($normalizedLabel, "line_2")
            ) {
                $field["field_name"] = "apellido_materno";
            } elseif (
                str_contains($normalizedLabel, "linea_3") ||
                str_contains($normalizedLabel, "línea_3") ||
                str_contains($normalizedLabel, "line_3")
            ) {
                $field["field_name"] = "nombres";
            } elseif (
                $normalizedLabel === "nombre" ||
                $normalizedLabel === "nombre_del_documento" ||
                $normalizedLabel === "bloque_nombre"
            ) {
                /*
                 * Si watsonx no especifica línea y solo dice NOMBRE,
                 * no lo mandamos a nombres porque en INE puede ser apellido paterno.
                 */
                $field["field_name"] = "nombre_bloque_no_separado";
                $structured["notes"][] = "watsonx devolvió un valor bajo el título NOMBRE sin indicar línea. No se mapeó a nombres para evitar error en INE.";
            }
        }

        /*
         * Para documentos no INE, si watsonx usa field_name=nombre,
         * lo tratamos como nombres solamente si el documento no parece usar el patrón INE.
         */
        if (!$isIne && $normalizedFieldName === "nombre") {
            $field["field_name"] = "nombres";
        }

        /*
         * Alias comunes para alinear contra tabla persona.
         */
        if ($normalizedFieldName === "seccion") {
            $field["field_name"] = "seccion_id";
        }

        if ($normalizedFieldName === "domicilio" || $normalizedFieldName === "domicilio_completo") {
            $field["field_name"] = "domicilio_texto";
        }

        if ($normalizedFieldName === "vigencia") {
            /*
             * Si watsonx devuelve una vigencia compuesta, la dejamos como vigencia
             * solo si no pudo separar. La vista puede mapear vigencia a vigencia_fin,
             * pero lo ideal es que el prompt devuelva vigencia_inicio y vigencia_fin.
             */
            $field["field_name"] = "vigencia_fin";
        }

        /*
         * Normalización básica de confidence.
         */
        if (!isset($field["confidence"]) || !is_numeric($field["confidence"])) {
            $field["confidence"] = 0.5;
        } else {
            $confidence = (float)$field["confidence"];

            if ($confidence > 1) {
                $confidence = $confidence / 100;
            }

            $field["confidence"] = max(0, min(1, $confidence));
        }

        $field["provider"] = "watsonx";

        /*
         * No dejamos pasar valores vacíos para evitar contaminar la tabla.
         */
        if ($value === null || trim((string)$value) === "") {
            continue;
        }

        $normalizedFields[] = $field;
    }

    $structured["fields"] = $normalizedFields;
    $structured["provider"] = "watsonx";

    return $structured;
}

function analyzeIdentificationText(string $rawText, array $env): array
{
    $token = getIamToken($env["WATSONX_API_KEY"]);

    $watsonxUrl = rtrim($env["WATSONX_URL"], "/");
    $apiVersion = $env["WATSONX_API_VERSION"];

    $url = "{$watsonxUrl}/ml/v1/text/chat?version={$apiVersion}";

    $systemPrompt = <<<TXT
Eres un extractor de datos para documentos de identificación.
Tu tarea es convertir texto OCR en JSON estructurado para un CRM.

Reglas estrictas:
1. Extrae únicamente datos que tengan un título, etiqueta o encabezado cercano antes del valor.
2. No inventes datos.
3. No corrijas datos si no estás seguro.
4. Si un valor está incompleto o ilegible, inclúyelo tal como aparece y baja la confianza.
5. Responde únicamente JSON válido. No uses markdown.
6. No incluyas explicaciones fuera del JSON.

Regla obligatoria para INE mexicana o credencial para votar:
7. Si detectas una identificación mexicana tipo INE o credencial para votar, aplica esta regla obligatoria para el bloque NOMBRE.

El bloque NOMBRE se interpreta por líneas, no como un solo nombre.

Estructura esperada:
NOMBRE
LINEA_1
LINEA_2
LINEA_3

Asignación obligatoria:
- LINEA_1 después de NOMBRE = apellido_paterno
- LINEA_2 después de NOMBRE = apellido_materno
- LINEA_3 después de NOMBRE = nombres

Ejemplo:
NOMBRE
DE DIOS
GARCIA
PABLO AGUSTIN

Respuesta correcta:
{
  "field_name": "apellido_paterno",
  "label_detected": "NOMBRE - linea 1",
  "value": "DE DIOS",
  "confidence": 0.95
},
{
  "field_name": "apellido_materno",
  "label_detected": "NOMBRE - linea 2",
  "value": "GARCIA",
  "confidence": 0.95
},
{
  "field_name": "nombres",
  "label_detected": "NOMBRE - linea 3",
  "value": "PABLO AGUSTIN",
  "confidence": 0.95
}

Reglas adicionales para el bloque NOMBRE:
8. En INE, nunca pongas LINEA_1 del bloque NOMBRE como nombres.
9. En INE, no uses field_name = "nombre" para el bloque NOMBRE. Usa solamente apellido_paterno, apellido_materno y nombres.
10. Conserva partículas de apellido como DE, DEL, DE LA, DE LOS, LOS, LAS, SAN, SANTA.
11. Si el bloque NOMBRE no tiene tres líneas claras:
    - Si solo hay una línea, usa field_name = "nombre_completo" y baja la confianza.
    - Si hay dos líneas, usa field_name = "nombre_completo" y agrega una nota de baja confianza.
    - Si hay más de tres líneas, intenta separar usando el patrón de INE y agrega una nota.
12. Si el documento no es INE y el nombre viene en otro formato, usa el título visible del documento y normaliza al campo más cercano.

Reglas para otros campos:
13. Para DOMICILIO, primero extrae domicilio_texto. Solo separa calle, numero_exterior, numero_interior, colonia, localidad, municipio, estado y codigo_postal si se distinguen claramente.
14. No inventes fecha_emision si no existe un título claro de FECHA DE EMISIÓN.
15. Para VIGENCIA tipo "2020 - 2030", separa:
    - vigencia_inicio = 2020
    - vigencia_fin = 2030
16. Para AÑO DE REGISTRO tipo "2010 03", separa:
    - anio_registro = 2010
    - emision = 03
17. Si detectas CLAVE DE ELECTOR, captura el valor completo, no solo una parte.
18. Si detectas CURP, debe tener 18 caracteres alfanuméricos si se distingue completo.
19. Si detectas OCR, CIC o IDMEX, devuélvelos en sus campos correspondientes.
20. Si no detectas un campo, no lo regreses.
21. Teléfono, WhatsApp y email solo deben devolverse si aparecen explícitamente en la identificación o documento.
22. Los consentimientos de privacidad no deben extraerse del documento.

Formato obligatorio:
{
  "document_type": "INE | Pasaporte | Licencia | Identificación | Desconocido",
  "country": "México | Otro | Desconocido",
  "provider": "watsonx",
  "fields": [
    {
      "field_name": "nombre_normalizado",
      "label_detected": "título exacto detectado o título con línea",
      "value": "valor detectado",
      "confidence": 0.0
    }
  ],
  "raw_text_quality": "alta | media | baja",
  "notes": []
}

Nombres permitidos para field_name, alineados a la tabla persona:
nombres,
apellido_paterno,
apellido_materno,
nombre_completo,
fecha_nacimiento,
sexo,
curp,
clave_elector,
seccion_id,
anio_registro,
emision,
vigencia_inicio,
vigencia_fin,
ocr,
cic,
idmex,
domicilio_texto,
calle,
numero_exterior,
numero_interior,
colonia,
localidad,
municipio,
estado,
codigo_postal,
telefono,
whatsapp,
email,
numero_documento.

Si detectas un título que no conoces, usa un field_name descriptivo en snake_case, pero no inventes campos.
TXT;

    $userPrompt = <<<TXT
Texto OCR recibido:

{$rawText}

Extrae los datos que tengan título o etiqueta antes del valor.

Recuerda especialmente:
- Si el documento es INE o credencial para votar, el bloque NOMBRE se separa por líneas:
  línea 1 = apellido_paterno
  línea 2 = apellido_materno
  línea 3 = nombres
- No uses field_name = nombre para INE.
TXT;

    $payload = [
        "model_id" => $env["WATSONX_MODEL_ID"],
        "project_id" => $env["WATSONX_PROJECT_ID"],
        "messages" => [
            [
                "role" => "system",
                "content" => $systemPrompt
            ],
            [
                "role" => "user",
                "content" => $userPrompt
            ]
        ],
        "max_tokens" => 1600,
        "temperature" => 0,
        "time_limit" => 15000
    ];

    $encodedPayload = json_encode($payload, JSON_UNESCAPED_UNICODE);

    if ($encodedPayload === false) {
        jsonResponse([
            "ok" => false,
            "error" => "No se pudo convertir el payload a JSON.",
            "detalle" => json_last_error_msg()
        ], 500);
    }

    $headers = [
        "Authorization: Bearer {$token}",
        "Content-Type: application/json",
        "Accept: application/json"
    ];

    $response = curlRequest($url, "POST", $headers, $encodedPayload);

    if (!$response["ok"]) {
        jsonResponse([
            "ok" => false,
            "error" => "Error al consumir watsonx.ai",
            "http_code" => $response["http_code"],
            "detalle" => $response["json"] ?? $response["raw"]
        ], 500);
    }

    if (!is_array($response["json"])) {
        jsonResponse([
            "ok" => false,
            "error" => "watsonx.ai respondió algo que no es JSON válido.",
            "raw" => $response["raw"]
        ], 500);
    }

    $answerText = extractWatsonxText($response["json"]);
    $jsonText = cleanJsonFromModel($answerText);

    $structured = json_decode($jsonText, true);

    if (!is_array($structured)) {
        jsonResponse([
            "ok" => false,
            "error" => "watsonx respondió, pero no se pudo convertir la respuesta a JSON estructurado.",
            "model_answer" => $answerText,
            "json_error" => json_last_error_msg()
        ], 500);
    }

    if (empty($structured["fields"]) || !is_array($structured["fields"])) {
        $structured["fields"] = [];
    }

    $structured = normalizeWatsonxStructuredResult($structured);

    return $structured;
}

function safeStringLength(string $value): int
{
    if (function_exists("mb_strlen")) {
        return mb_strlen($value, "UTF-8");
    }

    return strlen($value);
}

try {
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        jsonResponse([
            "ok" => false,
            "error" => "Método no permitido. Usa POST."
        ], 405);
    }

    $rawInput = file_get_contents("php://input");

    if ($rawInput === false || trim($rawInput) === "") {
        jsonResponse([
            "ok" => false,
            "error" => "No se recibió cuerpo JSON."
        ], 400);
    }

    $input = json_decode($rawInput, true);

    if (!is_array($input)) {
        jsonResponse([
            "ok" => false,
            "error" => "JSON inválido.",
            "detalle" => json_last_error_msg()
        ], 400);
    }

    $rawText = trim((string)($input["raw_text"] ?? ""));

    if ($rawText === "") {
        jsonResponse([
            "ok" => false,
            "error" => "El texto OCR es obligatorio."
        ], 400);
    }

    if (safeStringLength($rawText) > 12000) {
        jsonResponse([
            "ok" => false,
            "error" => "El texto OCR es demasiado largo."
        ], 400);
    }

    $env = loadEnv();
    $result = analyzeIdentificationText($rawText, $env);

    jsonResponse([
        "ok" => true,
        "result" => $result
    ]);

} catch (Throwable $e) {
    jsonResponse([
        "ok" => false,
        "error" => "Error interno en extract_identificacion.php",
        "detalle" => $e->getMessage()
    ], 500);
}