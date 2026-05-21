"use strict";

const CONFIG = {
  DEBUG: true,

  // Tiempo que la INE debe mantenerse bien colocada antes de autocapturar.
  REQUIRED_STABLE_MS: 1400,

  // Cada cuántos ms analizamos el frame.
  FRAME_ANALYSIS_INTERVAL: 140,

  // Decaimiento visual de la barra si algo falla.
  PROGRESS_DECAY: 12,

  // Calidad de imagen enviada al backend.
  CAPTURE_QUALITY: 0.9,

  // Validaciones visuales en navegador.
  MIN_FOCUS_SCORE: 18,
  MIN_LIGHTING: 55,
  MAX_LIGHTING: 215,
  MIN_EDGE_SCORE: 7,
};

const ENDPOINTS = {
  validateIne: "/PRI/db/WEB/validar_ine_ocr.php",
};

const TAG = "[Captura INE]";
const log = (...args) => CONFIG.DEBUG && console.log(TAG, ...args);
const warn = (...args) => CONFIG.DEBUG && console.warn(TAG, ...args);

const $ = (selector, root = document) => root.querySelector(selector);

const State = {
  step: "front",
  state: "idle",
  stream: null,

  scanProgress: 0,
  lastValidTime: null,
  autoCaptured: false,

  lastFrameAnalysisAt: 0,
  scannerLoopId: null,

  captures: {
    front: null,
    back: null,
  },

  validationResults: {
    front: null,
    back: null,
  },
};

const SEL = {
  stage: ".scanner-stage",
  video: "#scanner-video",
  canvas: "#scanner-canvas",
  close: "#scanner-close",

  progressBar: "#scanner-progress-bar",
  statusText: "#scanner-status-text",
  stepTitle: "#scanner-step-title",
  stepHelp: "#scanner-step-help",

  retry: "#scanner-btn-retry",
  continue: "#scanner-btn-continue",
  process: "#scanner-btn-process",

  summary: ".scanner-summary",
  previewFront: "#preview-front",
  previewBack: "#preview-back",
};

function setStageState(state) {
  State.state = state;

  const stage = $(SEL.stage);
  if (!stage) return;

  stage.dataset.state = state;
  stage.classList.toggle("is-valid", state === "validating");
  stage.classList.toggle("is-error", state === "error");
  stage.classList.toggle("is-processing", state === "processing");
}

function setStep(step) {
  State.step = step;

  const stage = $(SEL.stage);
  if (stage) stage.dataset.step = step;

  const title = $(SEL.stepTitle);
  const help = $(SEL.stepHelp);

  if (step === "front") {
    if (title) title.textContent = "Escanea la parte de enfrente de la INE";
    if (help) help.innerHTML = "Hasta que el recuadro esté en <strong>verde</strong>";
  }

  if (step === "back") {
    if (title) title.textContent = "Escanea la parte trasera de la INE";
    if (help) help.innerHTML = "Mantén visible el reverso completo";
  }
}

async function startCamera() {
  const video = $(SEL.video);

  if (!video) {
    warn("No se encontró el elemento video.");
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    showError("Tu navegador no permite usar la cámara.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });

    State.stream = stream;
    video.srcObject = stream;

    await video.play();

    setStageState("detecting");
    startScannerLoop();

    log("Cámara iniciada correctamente.");
  } catch (error) {
    warn("No se pudo iniciar la cámara:", error);
    showError("No se pudo abrir la cámara. Revisa los permisos del navegador.");
  }
}

function stopCamera() {
  if (State.scannerLoopId) {
    cancelAnimationFrame(State.scannerLoopId);
    State.scannerLoopId = null;
  }

  if (!State.stream) return;

  State.stream.getTracks().forEach((track) => track.stop());
  State.stream = null;

  const video = $(SEL.video);
  if (video) video.srcObject = null;

  log("Cámara detenida.");
}

function startScannerLoop() {
  const loop = (timestamp) => {
    if (!State.stream) return;

    const shouldAnalyze =
      timestamp - State.lastFrameAnalysisAt >= CONFIG.FRAME_ANALYSIS_INTERVAL;

    if (
      shouldAnalyze &&
      !State.autoCaptured &&
      State.state !== "captured" &&
      State.state !== "error" &&
      State.state !== "processing"
    ) {
      State.lastFrameAnalysisAt = timestamp;

      const result = analyzeCurrentFrame();
      updateScannerValidation(result);
    }

    State.scannerLoopId = requestAnimationFrame(loop);
  };

  State.scannerLoopId = requestAnimationFrame(loop);
}

function analyzeCurrentFrame() {
  const video = $(SEL.video);
  const canvas = $(SEL.canvas);

  if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
    return buildFrameResult({
      hasCard: false,
      reason: "no_video",
    });
  }

  const analysisWidth = 360;
  const ratio = video.videoHeight / video.videoWidth;
  const analysisHeight = Math.round(analysisWidth * ratio);

  canvas.width = analysisWidth;
  canvas.height = analysisHeight;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, analysisWidth, analysisHeight);

  const imageData = ctx.getImageData(0, 0, analysisWidth, analysisHeight);
  const data = imageData.data;

  const metrics = calculateFrameMetrics(data, analysisWidth, analysisHeight);

  const hasCard = metrics.edgeScore >= CONFIG.MIN_EDGE_SCORE;
  const goodSize = hasCard && metrics.guideCoverage >= 0.28 && metrics.guideCoverage <= 0.92;
  const goodAngle = hasCard && metrics.horizontalBalance >= 0.68;
  const goodFocus = metrics.focusScore >= CONFIG.MIN_FOCUS_SCORE;
  const goodLighting =
    metrics.lighting >= CONFIG.MIN_LIGHTING &&
    metrics.lighting <= CONFIG.MAX_LIGHTING;

  const isStable =
    hasCard &&
    goodSize &&
    goodAngle &&
    goodFocus &&
    goodLighting &&
    metrics.motionScore <= 0.18;

  return buildFrameResult({
    hasCard,
    goodSize,
    goodAngle,
    goodFocus,
    goodLighting,
    isStable,
    metrics,
  });
}

function buildFrameResult({
  hasCard = false,
  goodSize = false,
  goodAngle = false,
  goodFocus = false,
  goodLighting = false,
  isStable = false,
  metrics = {},
  reason = "",
}) {
  return {
    hasCard,
    goodSize,
    goodAngle,
    goodFocus,
    goodLighting,
    isStable,
    reason,
    metrics,
  };
}

let PreviousFrameSignature = null;

function calculateFrameMetrics(data, width, height) {
  let totalGray = 0;
  let focusTotal = 0;
  let edgeCount = 0;
  let guidePixels = 0;
  let brightGuidePixels = 0;

  let horizontalEdges = 0;
  let verticalEdges = 0;

  const guide = {
    x1: Math.round(width * 0.11),
    x2: Math.round(width * 0.89),
    y1: Math.round(height * 0.25),
    y2: Math.round(height * 0.58),
  };

  const grayAt = (x, y) => {
    const index = (y * width + x) * 4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];

    return (0.299 * r) + (0.587 * g) + (0.114 * b);
  };

  for (let y = 1; y < height - 1; y += 2) {
    for (let x = 1; x < width - 1; x += 2) {
      const gray = grayAt(x, y);
      totalGray += gray;

      const gx = Math.abs(grayAt(x + 1, y) - grayAt(x - 1, y));
      const gy = Math.abs(grayAt(x, y + 1) - grayAt(x, y - 1));
      const edge = gx + gy;

      focusTotal += edge;

      const inGuide =
        x >= guide.x1 &&
        x <= guide.x2 &&
        y >= guide.y1 &&
        y <= guide.y2;

      if (inGuide) {
        guidePixels += 1;

        if (gray > 70 && gray < 245) {
          brightGuidePixels += 1;
        }

        if (edge > 42) {
          edgeCount += 1;

          if (gx > gy) verticalEdges += 1;
          if (gy > gx) horizontalEdges += 1;
        }
      }
    }
  }

  const sampledPixels = Math.floor((width * height) / 4);
  const lighting = totalGray / Math.max(sampledPixels, 1);
  const focusScore = focusTotal / Math.max(sampledPixels, 1);
  const edgeScore = (edgeCount / Math.max(guidePixels, 1)) * 100;
  const guideCoverage = brightGuidePixels / Math.max(guidePixels, 1);

  const totalDirectionalEdges = horizontalEdges + verticalEdges;
  const horizontalBalance =
    totalDirectionalEdges > 0
      ? Math.max(horizontalEdges, verticalEdges) / totalDirectionalEdges
      : 0;

  const frameSignature = {
    lighting,
    edgeScore,
    guideCoverage,
    focusScore,
  };

  const motionScore = PreviousFrameSignature
    ? Math.min(
        1,
        (
          Math.abs(frameSignature.lighting - PreviousFrameSignature.lighting) / 80 +
          Math.abs(frameSignature.edgeScore - PreviousFrameSignature.edgeScore) / 35 +
          Math.abs(frameSignature.guideCoverage - PreviousFrameSignature.guideCoverage) / 0.8 +
          Math.abs(frameSignature.focusScore - PreviousFrameSignature.focusScore) / 40
        ) / 4
      )
    : 1;

  PreviousFrameSignature = frameSignature;

  return {
    lighting: Number(lighting.toFixed(2)),
    focusScore: Number(focusScore.toFixed(2)),
    edgeScore: Number(edgeScore.toFixed(2)),
    guideCoverage: Number(guideCoverage.toFixed(3)),
    horizontalBalance: Number(horizontalBalance.toFixed(3)),
    motionScore: Number(motionScore.toFixed(3)),
  };
}

function isValidationReady(result) {
  return (
    result.hasCard &&
    result.goodSize &&
    result.goodAngle &&
    result.goodFocus &&
    result.goodLighting &&
    result.isStable
  );
}

function updateScannerValidation(result) {
  const valid = isValidationReady(result);
  const now = performance.now();

  if (valid) {
    if (!State.lastValidTime) State.lastValidTime = now;

    const elapsed = now - State.lastValidTime;
    State.scanProgress = Math.min((elapsed / CONFIG.REQUIRED_STABLE_MS) * 100, 100);

    setStageState("validating");
  } else {
    State.lastValidTime = null;
    State.scanProgress = Math.max(State.scanProgress - CONFIG.PROGRESS_DECAY, 0);

    setStageState("detecting");
  }

  updateProgressUI(State.scanProgress, result);

  if (State.scanProgress >= 100 && !State.autoCaptured) {
    State.autoCaptured = true;
    capturePhoto();
  }
}

function updateProgressUI(progress, result) {
  const bar = $(SEL.progressBar);
  const text = $(SEL.statusText);

  if (bar) bar.style.width = `${progress}%`;

  if (!text) return;

  if (!result.hasCard) {
    text.textContent = "Coloca la INE dentro del recuadro";
  } else if (!result.goodSize) {
    text.textContent = "Ajusta la distancia de la INE";
  } else if (!result.goodAngle) {
    text.textContent = "Endereza la INE";
  } else if (!result.goodFocus) {
    text.textContent = "Mantén la cámara enfocada";
  } else if (!result.goodLighting) {
    text.textContent = "Mejora la iluminación";
  } else if (!result.isStable) {
    text.textContent = "Mantén la INE estable";
  } else {
    text.textContent = "Correcto, tomando foto...";
  }
}

async function capturePhoto() {
  const video = $(SEL.video);
  const canvas = $(SEL.canvas);

  if (!video || !canvas) {
    showError("No se pudo capturar la imagen.");
    return;
  }

  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;

  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, width, height);

  const imageData = canvas.toDataURL("image/jpeg", CONFIG.CAPTURE_QUALITY);

  State.captures[State.step] = imageData;

  await validateCapturedINE(imageData, State.step);
}

async function validateCapturedINE(imageData, side) {
  setStageState("processing");

  const text = $(SEL.statusText);
  const retry = $(SEL.retry);
  const next = $(SEL.continue);
  const bar = $(SEL.progressBar);

  if (retry) retry.hidden = true;
  if (next) next.hidden = true;
  if (bar) bar.style.width = "100%";

  if (text) {
    text.textContent =
      side === "front"
        ? "Validando frente de INE..."
        : "Validando reverso de INE...";
  }

  try {
    const result = await validateIneWithBackend(imageData, side);

    State.validationResults[side] = result;

    log("Validación backend:", result);

    if (!result.valid) {
      State.captures[side] = null;

      showError(result.message || "La foto no es válida. Intenta de nuevo.");
      return;
    }

    setStageState("captured");
    updateCapturedUI();
  } catch (error) {
    warn("Error validando captura:", error);

    State.captures[side] = null;

    showError("No se pudo validar la captura. Intenta de nuevo.");
  }
}

async function validateIneWithBackend(imageData, side) {
  const response = await fetch(ENDPOINTS.validateIne, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      side,
      image: imageData,
    }),
  });

  const raw = await response.text();

  let json = null;

  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("El endpoint no respondió JSON válido.");
  }

  if (!response.ok || !json.ok) {
    throw new Error(json.error || `Error HTTP ${response.status}`);
  }

  const result = json.data || json.result || json;

  return {
    valid: Boolean(result.valid),
    message: result.message || "",
    score: Number(result.score || result.confidence || 0),
    checks: result.checks || {},
    metrics: result.metrics || result.quality || {},
    raw: result,
  };
}

function updateCapturedUI() {
  const retry = $(SEL.retry);
  const next = $(SEL.continue);
  const text = $(SEL.statusText);
  const bar = $(SEL.progressBar);

  if (bar) bar.style.width = "100%";

  if (text) {
    text.innerHTML =
      State.step === "front"
        ? "<strong>¡Excelente! Frente validado correctamente</strong> Puedes continuar con el reverso"
        : "<strong>¡Excelente! Reverso validado correctamente</strong> Puedes revisar las capturas";
  }

  if (retry) retry.hidden = false;
  if (next) next.hidden = false;

  if (next) {
    next.textContent = State.step === "front" ? "Capturar reverso" : "Ver resumen";
  }
}

function retryCapture() {
  State.scanProgress = 0;
  State.lastValidTime = null;
  State.autoCaptured = false;
  State.captures[State.step] = null;
  State.validationResults[State.step] = null;
  PreviousFrameSignature = null;

  const retry = $(SEL.retry);
  const next = $(SEL.continue);
  const bar = $(SEL.progressBar);
  const text = $(SEL.statusText);

  if (retry) retry.hidden = true;
  if (next) next.hidden = true;
  if (bar) bar.style.width = "0%";
  if (text) text.textContent = "Coloca la INE dentro del recuadro";

  setStageState("detecting");
}

function continueFlow() {
  if (State.step === "front") {
    setStep("back");
    retryCapture();
    return;
  }

  showSummary();
}

function showSummary() {
  const stage = $(SEL.stage);
  const summary = $(SEL.summary);
  const front = $(SEL.previewFront);
  const back = $(SEL.previewBack);

  if (stage) stage.hidden = true;
  if (summary) summary.hidden = false;

  if (front && State.captures.front) front.src = State.captures.front;
  if (back && State.captures.back) back.src = State.captures.back;

  stopCamera();

  log("Capturas listas:", {
    captures: State.captures,
    validationResults: State.validationResults,
  });
}

function showError(message) {
  setStageState("error");

  State.scanProgress = 0;
  State.lastValidTime = null;
  State.autoCaptured = false;

  const text = $(SEL.statusText);
  const retry = $(SEL.retry);
  const next = $(SEL.continue);
  const bar = $(SEL.progressBar);

  if (bar) bar.style.width = "0%";
  if (text) text.textContent = message;
  if (retry) retry.hidden = false;
  if (next) next.hidden = true;
}

function processOCR() {
  log("Enviar capturas al scanner/OCR:", {
    front: State.captures.front,
    back: State.captures.back,
    validations: State.validationResults,
  });

  alert("Aquí enviaremos frente y reverso al scanner/OCR final.");
}

function closeScanner() {
  stopCamera();
  window.location.href = "/PRI/Views/home.php";
}

function bindEvents() {
  $(SEL.close)?.addEventListener("click", closeScanner);
  $(SEL.retry)?.addEventListener("click", retryCapture);
  $(SEL.continue)?.addEventListener("click", continueFlow);
  $(SEL.process)?.addEventListener("click", processOCR);

  window.addEventListener("beforeunload", stopCamera);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      log("Documento oculto, cámara sigue activa hasta cerrar o salir.");
    }
  });
}

function init() {
  bindEvents();
  setStep("front");
  setStageState("idle");
  startCamera();
}

document.addEventListener("DOMContentLoaded", init);