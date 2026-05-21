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

    EXTRACTION: {
        provider: "openai", // "openai" | "watsonx"
        compositeMaxWidth: 1400,
        compositeQuality: 0.86,
        rawText: "",
    },
};

const ENDPOINTS = {
    extractWatsonx: "/PRI/extract_identificacion.php",
    extractOpenAI: "/PRI/extract_identificacion_openai.php",
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

    extractionResult: null,
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
    debugFile: "#scanner-btn-debug-file",
    debugFileInput: "#scanner-debug-file-input",

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

    if (!ctx) {
        return buildFrameResult({
            hasCard: false,
            reason: "no_context",
        });
    }

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

        if (!compressed?.dataUrl) {
            throw new Error("La compresión no devolvió una imagen válida.");
        }

        if (!compressed.withinLimit) {
            throw new Error("La imagen sigue pesando demasiado después de comprimirla.");
        }

        console.group("[Captura INE] Imagen capturada");
        console.log("Step:", State.step);
        console.log("Mime:", compressed.mime);
        console.log("Size KB:", compressed.sizeKB);
        console.log("Width:", compressed.width);
        console.log("Height:", compressed.height);
        console.log("Quality:", compressed.quality);
        console.log("Within limit:", compressed.withinLimit);
        console.log("DataURL length:", compressed.dataUrl.length);
        console.groupEnd();

        acceptCapturedINE(compressed.dataUrl, State.step, {
            source: "camera",
            mime: compressed.mime,
            sizeKB: compressed.sizeKB,
            width: compressed.width,
            height: compressed.height,
            quality: compressed.quality,
        });
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

function acceptCapturedINE(imageData, side, meta = {}) {
    State.captures[side] = imageData;
    State.extractionResult = null;

    console.group("[Captura INE] Captura aceptada por validación visual JS");
    console.log("Side:", side);
    console.log("Image length:", imageData?.length || 0);
    console.log("Meta:", meta);
    console.groupEnd();

    toast(
        side === "front"
            ? "Frente capturado correctamente"
            : "Reverso capturado correctamente",
        "exito",
        3500
    );

    setStageState("captured");
    updateCapturedUI();
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
                ? "<strong>¡Excelente! Frente capturado correctamente</strong> Puedes continuar con el reverso"
                : "<strong>¡Excelente! Reverso capturado correctamente</strong> Puedes revisar las capturas";
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
    State.extractionResult = null;
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
        captures: {
            front: State.captures.front ? `${State.captures.front.length} chars` : null,
            back: State.captures.back ? `${State.captures.back.length} chars` : null,
        },
        extractionResult: State.extractionResult,
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

function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("No se pudo cargar una captura para componer."));

        img.src = dataUrl;
    });
}

function dataUrlSizeBytes(dataUrl) {
    const base64 = String(dataUrl || "").split(",")[1] || "";
    return Math.ceil((base64.length * 3) / 4);
}

function dataUrlSizeMB(dataUrl) {
    return dataUrlSizeBytes(dataUrl) / 1024 / 1024;
}

async function buildCompositeIneImageDataUrl() {
    if (!State.captures.front || !State.captures.back) {
        throw new Error("Faltan capturas de frente y reverso.");
    }

    const frontImg = await loadImageFromDataUrl(State.captures.front);
    const backImg = await loadImageFromDataUrl(State.captures.back);

    const maxWidth = CONFIG.EXTRACTION.compositeMaxWidth;
    const padding = 32;
    const gap = 34;
    const labelHeight = 42;

    const frontRatio = Math.min(1, (maxWidth - padding * 2) / frontImg.width);
    const backRatio = Math.min(1, (maxWidth - padding * 2) / backImg.width);

    const frontWidth = Math.round(frontImg.width * frontRatio);
    const frontHeight = Math.round(frontImg.height * frontRatio);

    const backWidth = Math.round(backImg.width * backRatio);
    const backHeight = Math.round(backImg.height * backRatio);

    const canvasWidth = Math.max(frontWidth, backWidth) + padding * 2;
    const canvasHeight =
        padding +
        labelHeight +
        frontHeight +
        gap +
        labelHeight +
        backHeight +
        padding;

    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext("2d", { alpha: false });

    if (!ctx) {
        throw new Error("No se pudo crear la imagen compuesta.");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = "#111827";
    ctx.font = "700 24px Arial";
    ctx.textBaseline = "top";

    let y = padding;

    ctx.fillText("FRENTE INE", padding, y);
    y += labelHeight;

    ctx.drawImage(
        frontImg,
        Math.round((canvasWidth - frontWidth) / 2),
        y,
        frontWidth,
        frontHeight
    );

    y += frontHeight + gap;

    ctx.fillText("REVERSO INE", padding, y);
    y += labelHeight;

    ctx.drawImage(
        backImg,
        Math.round((canvasWidth - backWidth) / 2),
        y,
        backWidth,
        backHeight
    );

    return canvas.toDataURL("image/jpeg", CONFIG.EXTRACTION.compositeQuality);
}

async function extractIdentificationData({
    provider = CONFIG.EXTRACTION.provider,
    imageDataUrl,
    rawText = CONFIG.EXTRACTION.rawText,
    imagesCount = 2,
}) {
    if (!imageDataUrl) {
        throw new Error("No hay imagen para enviar a extracción.");
    }

    const endpoint =
        provider === "watsonx"
            ? ENDPOINTS.extractWatsonx
            : ENDPOINTS.extractOpenAI;

    const imageSizeMb = dataUrlSizeMB(imageDataUrl);

    const payload =
        provider === "watsonx"
            ? {
                image_data_url: imageDataUrl,
                raw_text: String(rawText || "").trim().substring(0, 12000),
                prefer_image: imageDataUrl !== "",
                image_size_mb: Number(imageSizeMb.toFixed(3)),
                images_count: imagesCount,
            }
            : {
                image_data_url: imageDataUrl,
                raw_text: String(rawText || "").trim().substring(0, 6000),
                image_size_mb: Number(imageSizeMb.toFixed(3)),
                images_count: imagesCount,
            };

    console.group("[Captura INE] Enviando extracción");
    console.log("Provider:", provider);
    console.log("Endpoint:", endpoint);
    console.log("Image size MB:", payload.image_size_mb);
    console.log("Images count:", payload.images_count);
    console.log("Payload preview:", {
        ...payload,
        image_data_url: String(payload.image_data_url || "").slice(0, 90) + "...",
    });
    console.groupEnd();

    toast(
        `Enviando identificación a ${provider}...\nImagen: ${payload.image_size_mb} MB`,
        "advertencia",
        4000
    );

    let response;
    let rawResponse = "";

    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(payload),
        });

        rawResponse = await response.text();
    } catch (error) {
        console.error("[Captura INE] Error fetch extracción:", error);
        throw new Error("Error de conexión con el endpoint de extracción: " + error.message);
    }

    console.group("[Captura INE] Respuesta cruda extracción");
    console.log("HTTP status:", response.status);
    console.log("OK:", response.ok);
    console.log("Content-Type:", response.headers.get("content-type"));
    console.log("Raw:", rawResponse);
    console.groupEnd();

    let data = null;

    try {
        data = JSON.parse(rawResponse);
    } catch (error) {
        console.error("[Captura INE] La extracción no respondió JSON:", error);
        console.error("[Captura INE] Raw:", rawResponse);

        throw new Error("El endpoint de extracción respondió algo que no es JSON.");
    }

    if (!response.ok || !data.ok) {
        console.error("[Captura INE] Error backend extracción:", data);

        throw new Error(
            data.error ||
            data.message ||
            data.detalle ||
            `Error HTTP ${response.status}`
        );
    }

    return {
        provider,
        mode: data.mode || "image_direct",
        result: data.result || data.data || data,
        raw: data,
    };
}

async function processOCR() {
    if (!State.captures.front || !State.captures.back) {
        toast("Primero captura frente y reverso de la INE.", "error", 7000);
        return;
    }

    const processBtn = $(SEL.process);

    if (processBtn) {
        processBtn.disabled = true;
        processBtn.textContent = "Procesando OCR...";
    }

    toast("Preparando frente y reverso para extracción...", "advertencia", 3500);

    try {
        const compositeImage = await buildCompositeIneImageDataUrl();
        const imageSizeMb = dataUrlSizeMB(compositeImage);

        console.group("[Captura INE] Imagen compuesta para extracción");
        console.log("Size MB:", Number(imageSizeMb.toFixed(3)));
        console.log("DataURL length:", compositeImage.length);
        console.log("Endpoint OpenAI:", ENDPOINTS.extractOpenAI);
        console.log("Endpoint Watsonx:", ENDPOINTS.extractWatsonx);
        console.groupEnd();

        const result = await extractIdentificationData({
            provider: CONFIG.EXTRACTION.provider,
            imageDataUrl: compositeImage,
            rawText: CONFIG.EXTRACTION.rawText,
            imagesCount: 2,
        });

        State.extractionResult = result;

        console.group("[Captura INE] Resultado extracción");
        console.log(result);
        console.groupEnd();

        toast("Extracción completada. Revisa consola.", "exito", 7000);
        toast(result, "advertencia", 12000);
    } catch (error) {
        console.error("[Captura INE] Error en processOCR:", error);

        toast(
            error?.message || "No se pudo procesar la identificación.",
            "error",
            10000
        );
    } finally {
        if (processBtn) {
            processBtn.disabled = false;
            processBtn.textContent = "Procesar OCR";
        }
    }
}

async function debugValidateImageFromPC(file) {
    if (!(file instanceof File)) {
        toast("Archivo inválido para debug.", "error", 7000);
        return;
    }

    const side = State.step === "back" ? "back" : "front";

    console.group("[Captura INE][DEBUG PC] Archivo seleccionado");
    console.log("File:", file);
    console.log("Nombre:", file.name);
    console.log("Tipo:", file.type || "(sin mime)");
    console.log("Peso KB:", Math.round(file.size / 1024));
    console.log("Side actual:", side);
    console.groupEnd();

    toast(
        `Debug PC: preparando imagen ${side === "front" ? "frente" : "reverso"}...`,
        "advertencia",
        3000
    );

    try {
        if (!window.PRIMedia?.compressFileToDataUrl) {
            throw new Error("No se encontró PRIMedia.compressFileToDataUrl.");
        }

        const prepared = await window.PRIMedia.compressFileToDataUrl(file, {
            ...CONFIG.MEDIA,
            debug: true,
        });

        if (!prepared?.dataUrl) {
            throw new Error("No se pudo preparar la imagen seleccionada.");
        }

        if (!prepared.withinLimit) {
            throw new Error("La imagen sigue pesando demasiado después de prepararla.");
        }

        console.group("[Captura INE][DEBUG PC] Imagen preparada");
        console.log("Nombre original:", file.name);
        console.log("Mime salida:", prepared.mime);
        console.log("Size KB:", prepared.sizeKB);
        console.log("Width:", prepared.width);
        console.log("Height:", prepared.height);
        console.log("Quality:", prepared.quality);
        console.log("Compressed:", prepared.compressed);
        console.log("Original:", prepared.original);
        console.log("Within limit:", prepared.withinLimit);
        console.log("DataURL length:", prepared.dataUrl?.length || 0);
        console.groupEnd();

        acceptCapturedINE(prepared.dataUrl, side, {
            source: "debug_pc",
            name: file.name,
            type: file.type,
            sizeKB: Math.round(file.size / 1024),
            preparedSizeKB: prepared.sizeKB,
            preparedMime: prepared.mime,
        });
    } catch (error) {
        console.error("[Captura INE][DEBUG PC] Error preparando imagen:", error);

        toast(
            error?.message || "No se pudo preparar la imagen desde PC.",
            "error",
            9000
        );

        showError(error?.message || "No se pudo preparar la imagen desde PC.");
    }
}

function bindDebugImageFromPC() {
    const btn = $(SEL.debugFile);
    const input = $(SEL.debugFileInput);

    if (!btn || !input) {
        warn("No se encontró botón/input de debug PC.");
        return;
    }

    btn.addEventListener("click", () => {
        input.click();
    });

    input.addEventListener("change", async (event) => {
        const file = event.target.files?.[0];

        if (!file) {
            warn("[DEBUG PC] No se seleccionó archivo.");
            return;
        }

        await debugValidateImageFromPC(file);

        input.value = "";
    });
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

    bindDebugImageFromPC();

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