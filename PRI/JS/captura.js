"use strict";

const CONFIG = {
    DEBUG: true,

    // Tiempo que la INE debe mantenerse estable antes de autocapturar.
    REQUIRED_STABLE_MS: 900,

    // Cada cuántos ms analizamos el frame.
    FRAME_ANALYSIS_INTERVAL: 120,

    // Si algo falla, la barra baja lentamente para no frustrar al usuario.
    PROGRESS_DECAY: 5,

    // Calidad de imagen enviada al backend.
    CAPTURE_QUALITY: 0.9,

    // Validaciones visuales permisivas.
    MIN_FOCUS_SCORE: 10,
    MIN_LIGHTING: 35,
    MAX_LIGHTING: 235,
    MIN_EDGE_SCORE: 2.8,

    // en modo facil no pide que la foto sea perfecta, solo legible, es mas facil para el usuario.
    EASY_MODE: true,

    MEDIA: {
        maxBytes: 1024 * 1024,
        maxWidth: 1280,
        maxHeight: 900,
        minWidth: 720,
        startQuality: 0.86,
        minQuality: 0.58,
        qualityStep: 0.06,
        preferWebp: false,
        debug: true,
    },
};

const ENDPOINTS = {
    validateIne: "/PRI/DB/WEB/validar_ine_ocr.php",
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

let PreviousFrameSignature = null;

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

function toast(message, type = "exito", duration = 5000) {
    let text = "";

    if (typeof message === "string") {
        text = message;
    } else {
        try {
            text = JSON.stringify(message, null, 2);
        } catch {
            text = String(message);
        }
    }

    if (text.length > 900) {
        text = text.slice(0, 900) + "...";
    }

    if (typeof window.gcToast === "function") {
        window.gcToast(text, type, duration);
        return;
    }

    console.log(`[Toast fallback][${type}]`, text);
}

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

        const canAnalyze =
            !State.autoCaptured &&
            State.state !== "captured" &&
            State.state !== "error" &&
            State.state !== "processing";

        if (shouldAnalyze && canAnalyze) {
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

    const goodSize =
        hasCard &&
        metrics.guideCoverage >= 0.12 &&
        metrics.guideCoverage <= 0.98;

    const goodAngle = CONFIG.EASY_MODE
        ? true
        : hasCard && metrics.horizontalBalance >= 0.58;

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
        metrics.motionScore <= 0.42;

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

        return 0.299 * r + 0.587 * g + 0.114 * b;
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
    if (CONFIG.EASY_MODE) {
        return (
            result.hasCard &&
            result.goodFocus &&
            result.goodLighting &&
            result.isStable
        );
    }

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

    if (CONFIG.DEBUG) {
        console.log(`${TAG} frame:`, {
            valid,
            checks: {
                hasCard: result.hasCard,
                goodSize: result.goodSize,
                goodAngle: result.goodAngle,
                goodFocus: result.goodFocus,
                goodLighting: result.goodLighting,
                isStable: result.isStable,
            },
            metrics: result.metrics,
            progress: Math.round(State.scanProgress),
        });
    }

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
    } else if (!result.goodFocus) {
        text.textContent = "Mantén la cámara enfocada";
    } else if (!result.goodLighting) {
        text.textContent = "Mejora un poco la iluminación";
    } else if (!result.isStable) {
        text.textContent = "Mantén la INE estable";
    } else if (!result.goodSize) {
        text.textContent = "Ajusta ligeramente la distancia";
    } else if (!result.goodAngle) {
        text.textContent = "Endereza un poco la INE";
    } else {
        text.textContent = "Correcto, tomando foto...";
    }
}

async function capturePhoto() {
    const video = $(SEL.video);

    if (!video) {
        showError("No se pudo capturar la imagen.");
        return;
    }

    if (!window.PRIMedia?.compressVideoFrameToDataUrl) {
        showError("No se encontró el módulo de compresión de imagen.");
        toast("No se encontró /PRI/JS/media.js o no cargó correctamente.", "error", 7000);
        return;
    }

    try {
        const compressed = await window.PRIMedia.compressVideoFrameToDataUrl(
            video,
            CONFIG.MEDIA
        );

        State.captures[State.step] = compressed.dataUrl;

        toast(
            `Imagen optimizada: ${compressed.sizeKB} KB`,
            compressed.withinLimit ? "advertencia" : "error",
            3500
        );

        console.group("[Captura INE] Imagen lista para validar");
        console.log("Step:", State.step);
        console.log("Mime:", compressed.mime);
        console.log("Size KB:", compressed.sizeKB);
        console.log("Width:", compressed.width);
        console.log("Height:", compressed.height);
        console.log("Quality:", compressed.quality);
        console.log("Within limit:", compressed.withinLimit);
        console.log("DataURL length:", compressed.dataUrl.length);
        console.groupEnd();

        await validateCapturedINE(compressed.dataUrl, State.step);
    } catch (error) {
        warn("Error preparando captura:", error);

        toast(
            error?.message || "No se pudo comprimir la imagen.",
            "error",
            7000
        );

        showError("No se pudo preparar la imagen. Intenta de nuevo.");
    }
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

    toast(
        side === "front"
            ? "Validando frente de INE..."
            : "Validando reverso de INE...",
        "advertencia",
        2500
    );

    try {
        const result = await validateIneWithBackend(imageData, side);

        State.validationResults[side] = result;

        console.group("[Captura INE] Resultado validación backend");
        console.log("Side:", side);
        console.log("Valid:", result.valid);
        console.log("Message:", result.message);
        console.log("Score:", result.score);
        console.log("Checks:", result.checks);
        console.log("Metrics:", result.metrics);
        console.log("Raw:", result.raw);
        console.groupEnd();

        if (!result.valid) {
            State.captures[side] = null;

            toast(
                result.message || "La foto no es válida. Intenta de nuevo.",
                "error",
                7000
            );

            showError(result.message || "La foto no es válida. Intenta de nuevo.");
            return;
        }

        toast(
            side === "front"
                ? "Frente validado correctamente"
                : "Reverso validado correctamente",
            "exito",
            4500
        );

        setStageState("captured");
        updateCapturedUI();
    } catch (error) {
        warn("Error validando captura:", error);

        State.captures[side] = null;

        toast(
            error?.message || "No se pudo validar la captura.",
            "error",
            8000
        );

        showError("No se pudo validar la captura. Intenta de nuevo.");
    }
}

async function validateIneWithBackend(imageData, side) {
    const payload = {
        side,
        image: imageData,
    };

    console.group("[Captura INE] Enviando validación");
    console.log("Endpoint:", ENDPOINTS.validateIne);
    console.log("Side:", side);
    console.log("Image length:", imageData?.length || 0);
    console.log("Payload preview:", {
        side: payload.side,
        image: String(payload.image || "").slice(0, 80) + "...",
    });
    console.groupEnd();

    toast(
        `Enviando imagen al endpoint...\n${ENDPOINTS.validateIne}`,
        "advertencia",
        3000
    );

    let response;
    let raw = "";

    try {
        response = await fetch(ENDPOINTS.validateIne, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(payload),
        });

        raw = await response.text();
    } catch (error) {
        console.error("[Captura INE] Error de red/fetch:", error);

        toast(
            `Error de red/fetch:\n${error?.message || error}`,
            "error",
            10000
        );

        throw error;
    }

    console.group("[Captura INE] Respuesta cruda endpoint");
    console.log("HTTP status:", response.status);
    console.log("OK:", response.ok);
    console.log("Content-Type:", response.headers.get("content-type"));
    console.log("Raw response:", raw);
    console.groupEnd();

    toast(
        `HTTP ${response.status}\nOK: ${response.ok}\nRespuesta:\n${raw || "(vacía)"}`,
        response.ok ? "advertencia" : "error",
        12000
    );

    let json = null;

    try {
        json = JSON.parse(raw);
    } catch (error) {
        console.error("[Captura INE] JSON parse error:", error);
        console.error("[Captura INE] Raw no JSON:", raw);

        toast(
            `NO ES JSON\nHTTP ${response.status}\nRespuesta cruda:\n${raw || "(vacía)"}`,
            "error",
            15000
        );

        throw new Error("El endpoint no respondió JSON válido. Revisa consola.");
    }

    console.group("[Captura INE] JSON endpoint");
    console.log(json);
    console.groupEnd();

    toast(
        {
            status: response.status,
            ok: response.ok,
            json,
        },
        json.ok ? "exito" : "error",
        12000
    );

    if (!response.ok || !json.ok) {
        const backendError =
            json.error ||
            json.message ||
            json.detail ||
            `Error HTTP ${response.status}`;

        throw new Error(backendError);
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