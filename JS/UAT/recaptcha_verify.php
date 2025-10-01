<?php
// JS/recaptcha_verify.php
function verify_recaptcha_enterprise($token, $expectedAction) {
  $PROJECT_ID = 'TU_PROJECT_ID';
  $API_KEY    = 'TU_API_KEY';
  $SITE_KEY   = 'TU_SITE_KEY';

  if (!$token) return ['ok'=>false, 'reason'=>'missing'];

  $payload = json_encode([
    'event' => [
      'token'           => $token,
      'siteKey'         => $SITE_KEY,
      'expectedAction'  => $expectedAction,
      'userIpAddress'   => $_SERVER['REMOTE_ADDR'] ?? null,
      'userAgent'       => $_SERVER['HTTP_USER_AGENT'] ?? null,
    ]
  ]);

  $ch = curl_init("https://recaptchaenterprise.googleapis.com/v1/projects/$PROJECT_ID/assessments?key=$API_KEY");
  curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 8,
  ]);
  $resp = curl_exec($ch);
  if ($resp === false) return ['ok'=>false, 'reason'=>'google_unreachable'];
  $data = json_decode($resp, true) ?: [];
  $valid = $data['tokenProperties']['valid'] ?? false;
  $action= $data['tokenProperties']['action'] ?? '';
  $score = (float)($data['riskAnalysis']['score'] ?? 0.0);
  $reasons = $data['riskAnalysis']['reasons'] ?? [];

  return [
    'ok'      => $valid && $action === $expectedAction,
    'score'   => $score,
    'reasons' => $reasons,
    'action'  => $action,
  ];
}

// (Opcional) verificación del fallback reCAPTCHA v2 "checkbox"
function verify_recaptcha_v2($responseToken) {
  $SECRET = 'TU_RECAPTCHA_V2_SECRET'; // clave secreta v2
  if (!$responseToken) return ['ok'=>false, 'reason'=>'missing'];

  $ch = curl_init("https://www.google.com/recaptcha/api/siteverify");
  curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => http_build_query(['secret'=>$SECRET, 'response'=>$responseToken]),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 8,
  ]);
  $resp = curl_exec($ch);
  if ($resp === false) return ['ok'=>false, 'reason'=>'google_unreachable'];
  $data = json_decode($resp, true) ?: [];
  $ok = !empty($data['success']);
  return ['ok'=>$ok, 'data'=>$data];
}

/**
 * Política:
 * - score >= 0.70  => allow
 * - 0.40 <= score < 0.70 => challenge (pedir captcha visible)
 * - score  < 0.40 => block
 */
function decide_policy_from_score($ok, $score) {
  if (!$ok) return 'block';
  if ($score >= 0.70) return 'allow';
  if ($score >= 0.40) return 'challenge';
  return 'block';
}
