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

    OCR: {
        enabled: true,
        lang: "spa+eng",
        logger: true,
        maxTextLengthWatsonx: 12000,
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
    guideBox: ".scanner-guide-box",
    close: "#scanner-close",

    progressBar: "#scanner-progress-bar",
    statusText: "#scanner-status-text",
    stepTitle: "#scanner-step-title",
    stepHelp: "#scanner-step-help",

    retry: "#scanner-btn-retry",
    continue: "#scanner-btn-continue",
    processWatsonx: "#scanner-btn-process-watsonx",
    processOpenAI: "#scanner-btn-process-openai",
    debugFile: "#scanner-btn-debug-file",
    debugFileInput: "#scanner-debug-file-input",

    summary: ".scanner-summary",
    previewFront: "#preview-front",
    previewBack: "#preview-back",

    modal: "#ine-data-modal",
    modalFecha: "#ine-modal-fecha",
    modalNombre: "#ine-modal-nombre",
    modalDomicilio: "#ine-modal-domicilio",
    modalSeccion: "#ine-modal-seccion",
    modalClave: "#ine-modal-clave",
    modalCurp: "#ine-modal-curp",
    modalVigencia: "#ine-modal-vigencia",
    modalTelefono: "#ine-modal-telefono",
    modalRegistrado: "#ine-modal-registrado",
    modalEditado: "#ine-modal-editado",
    modalFront: "#ine-modal-front",
    modalBack: "#ine-modal-back",
    modalJson: "#ine-modal-json",
    modalAffiliate: "#ine-modal-affiliate",
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

function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getVideoCropFromGuide(video, guideBox, paddingRatio = 0.08) {
    const videoRect = video.getBoundingClientRect();
    const guideRect = guideBox.getBoundingClientRect();

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (!videoWidth || !videoHeight) {
        throw new Error("El video aún no tiene dimensiones válidas.");
    }

    /*
     * El video usa object-fit: cover.
     * Por eso necesitamos convertir coordenadas visibles del DOM
     * a coordenadas reales del frame de cámara.
     */
    const scale = Math.max(
        videoRect.width / videoWidth,
        videoRect.height / videoHeight
    );

    const renderedWidth = videoWidth * scale;
    const renderedHeight = videoHeight * scale;

    const offsetX = (videoRect.width - renderedWidth) / 2;
    const offsetY = (videoRect.height - renderedHeight) / 2;

    const guideX = guideRect.left - videoRect.left;
    const guideY = guideRect.top - videoRect.top;

    let sx = (guideX - offsetX) / scale;
    let sy = (guideY - offsetY) / scale;
    let sw = guideRect.width / scale;
    let sh = guideRect.height / scale;

    /*
     * Le damos un pequeño margen al recorte para no cortar bordes de la INE.
     */
    const padX = sw * paddingRatio;
    const padY = sh * paddingRatio;

    sx -= padX;
    sy -= padY;
    sw += padX * 2;
    sh += padY * 2;

    sx = clampNumber(sx, 0, videoWidth - 1);
    sy = clampNumber(sy, 0, videoHeight - 1);
    sw = clampNumber(sw, 1, videoWidth - sx);
    sh = clampNumber(sh, 1, videoHeight - sy);

    return {
        sx: Math.round(sx),
        sy: Math.round(sy),
        sw: Math.round(sw),
        sh: Math.round(sh),
    };
}

function captureGuideCropToCanvas() {
    const video = $(SEL.video);
    const guideBox = $(SEL.guideBox);

    if (!video) {
        throw new Error("No se encontró el video del scanner.");
    }

    if (!guideBox) {
        throw new Error("No se encontró el recuadro guía del scanner.");
    }

    const crop = getVideoCropFromGuide(video, guideBox, 0.08);

    const canvas = document.createElement("canvas");
    canvas.width = crop.sw;
    canvas.height = crop.sh;

    const ctx = canvas.getContext("2d", { alpha: false });

    if (!ctx) {
        throw new Error("No se pudo crear canvas de recorte.");
    }

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.drawImage(
        video,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        0,
        0,
        crop.sw,
        crop.sh
    );

    console.group("[Captura INE] Recorte desde guía");
    console.log("Video:", {
        width: video.videoWidth,
        height: video.videoHeight,
    });
    console.log("Crop:", crop);
    console.log("Canvas:", {
        width: canvas.width,
        height: canvas.height,
    });
    console.groupEnd();

    return canvas;
}

async function capturePhoto() {
    if (!window.PRIMedia?.compressCanvasToDataUrl) {
        showError("No se encontró el módulo de compresión de imagen.");
        toast("No se encontró PRIMedia.compressCanvasToDataUrl en /PRI/JS/media.js.", "error", 7000);
        return;
    }

    try {
        const cropCanvas = captureGuideCropToCanvas();

        const compressed = await window.PRIMedia.compressCanvasToDataUrl(
            cropCanvas,
            CONFIG.MEDIA
        );

        if (!compressed?.dataUrl) {
            throw new Error("La compresión no devolvió una imagen válida.");
        }

        if (!compressed.withinLimit) {
            throw new Error("La imagen sigue pesando demasiado después de comprimirla.");
        }

        console.group("[Captura INE] Imagen recortada capturada");
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
            source: "camera_crop",
            mime: compressed.mime,
            sizeKB: compressed.sizeKB,
            width: compressed.width,
            height: compressed.height,
            quality: compressed.quality,
        });
    } catch (error) {
        warn("Error preparando captura recortada:", error);

        toast(
            error?.message || "No se pudo recortar la imagen.",
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

function ensureTesseractReady() {
    if (!window.Tesseract?.recognize) {
        throw new Error("Tesseract.js no está cargado. Revisa el script CDN antes de captura.js.");
    }
}

function normalizeOcrText(text) {
    return String(text || "")
        .replace(/\r/g, "\n")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

async function runOcrOnDataUrl(dataUrl, label = "Imagen") {
    ensureTesseractReady();

    if (!dataUrl) {
        throw new Error(`No hay imagen para OCR: ${label}`);
    }

    console.group(`[Captura INE][OCR] Iniciando OCR ${label}`);
    console.log("Lang:", CONFIG.OCR.lang);
    console.log("DataURL length:", dataUrl.length);
    console.groupEnd();

    const result = await window.Tesseract.recognize(
        dataUrl,
        CONFIG.OCR.lang,
        {
            logger: (message) => {
                if (!CONFIG.DEBUG || !CONFIG.OCR.logger) return;

                if (message?.status) {
                    console.log("[Captura INE][OCR]", label, message.status, message.progress ?? "");
                }
            },
        }
    );

    const text = normalizeOcrText(result?.data?.text || "");
    const confidence = Number(result?.data?.confidence || 0);

    console.group(`[Captura INE][OCR] Resultado ${label}`);
    console.log("Confidence:", confidence);
    console.log("Text:", text);
    console.groupEnd();

    return {
        label,
        text,
        confidence,
        raw: result,
    };
}

async function buildWatsonxRawTextFallback() {
    if (!State.captures.front || !State.captures.back) {
        throw new Error("Faltan capturas para generar OCR de respaldo.");
    }

    toast("Watsonx: generando OCR local de respaldo...", "advertencia", 4500);

    const frontResult = await runOcrOnDataUrl(State.captures.front, "FRENTE INE");
    const backResult = await runOcrOnDataUrl(State.captures.back, "REVERSO INE");

    const rawText = normalizeOcrText(`
=== FRENTE INE ===
${frontResult.text}

=== REVERSO INE ===
${backResult.text}
`);

    console.group("[Captura INE][OCR] Texto fallback Watsonx");
    console.log("Length:", rawText.length);
    console.log("Front confidence:", frontResult.confidence);
    console.log("Back confidence:", backResult.confidence);
    console.log(rawText);
    console.groupEnd();

    if (!rawText) {
        throw new Error("No se pudo generar texto OCR para Watsonx.");
    }

    return rawText.substring(0, CONFIG.OCR.maxTextLengthWatsonx);
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
                raw_text: String(rawText || "").trim().substring(0, CONFIG.OCR.maxTextLengthWatsonx),
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

async function processOCR(provider = "openai") {
    if (!State.captures.front || !State.captures.back) {
        toast("Primero captura frente y reverso de la INE.", "error", 7000);
        return;
    }

    const btn =
        provider === "watsonx"
            ? $(SEL.processWatsonx)
            : $(SEL.processOpenAI);

    const originalText = btn?.textContent || "";

    if (btn) {
        btn.disabled = true;
        btn.textContent = provider === "watsonx"
            ? "Preparando OCR..."
            : "Procesando OpenAI...";
    }

    toast(
        provider === "watsonx"
            ? "Preparando extracción con Watsonx..."
            : "Extrayendo datos con OpenAI...",
        "advertencia",
        3500
    );

    try {
        let rawText = CONFIG.EXTRACTION.rawText;

        if (provider === "watsonx") {
            if (btn) btn.textContent = "Generando OCR local...";

            rawText = await buildWatsonxRawTextFallback();

            toast(
                `OCR local listo para Watsonx (${rawText.length} caracteres).`,
                "exito",
                4000
            );

            if (btn) btn.textContent = "Procesando Watsonx...";
        }

        const compositeImage = await buildCompositeIneImageDataUrl();
        const imageSizeMb = dataUrlSizeMB(compositeImage);

        console.group("[Captura INE] Imagen compuesta para extracción");
        console.log("Provider:", provider);
        console.log("Size MB:", Number(imageSizeMb.toFixed(3)));
        console.log("DataURL length:", compositeImage.length);
        console.log("Raw text length:", rawText.length);
        console.log("Endpoint:", provider === "watsonx" ? ENDPOINTS.extractWatsonx : ENDPOINTS.extractOpenAI);
        console.groupEnd();

        const result = await extractIdentificationData({
            provider,
            imageDataUrl: compositeImage,
            rawText,
            imagesCount: 2,
        });

        State.extractionResult = result;

        console.group("[Captura INE] Resultado extracción");
        console.log(result);
        console.table(getFieldsFromExtraction(result));
        console.groupEnd();

        toast(
            provider === "watsonx"
                ? "Extracción Watsonx completada."
                : "Extracción OpenAI completada.",
            "exito",
            6000
        );

        renderIneDataModal(result, provider);
        openIneDataModal();
    } catch (error) {
        console.error("[Captura INE] Error en processOCR:", error);

        toast(
            error?.message || "No se pudo procesar la identificación.",
            "error",
            10000
        );
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText || (
                provider === "watsonx"
                    ? "Extraer con Watsonx"
                    : "Extraer con OpenAI"
            );
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

function getTodayLongEs() {
    return new Intl.DateTimeFormat("es-MX", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    }).format(new Date());
}

function normalizeFieldName(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function normalizeValue(value, fallback = "") {
    if (value === null || value === undefined) return fallback;

    const text = String(value).trim();

    if (!text || text === "--------" || text.toLowerCase() === "null") {
        return fallback;
    }

    return text;
}

function getFieldsFromExtraction(extraction) {
    const result =
        extraction?.result ||
        extraction?.raw?.result ||
        extraction?.raw?.data ||
        extraction?.raw ||
        {};

    if (Array.isArray(result.fields)) {
        return result.fields;
    }

    if (Array.isArray(result?.result?.fields)) {
        return result.result.fields;
    }

    if (Array.isArray(result?.data?.fields)) {
        return result.data.fields;
    }

    if (result.persona && typeof result.persona === "object") {
        return Object.entries(result.persona).map(([key, value]) => ({
            field_name: key,
            label_detected: key,
            value,
        }));
    }

    if (result.data?.persona && typeof result.data.persona === "object") {
        return Object.entries(result.data.persona).map(([key, value]) => ({
            field_name: key,
            label_detected: key,
            value,
        }));
    }

    return [];
}

function findExtractedValue(fields, aliases, fallback = "") {
    const normalizedAliases = aliases.map(normalizeFieldName);

    const field = fields.find((item) => {
        const name = normalizeFieldName(item?.field_name);
        const label = normalizeFieldName(item?.label_detected);

        return normalizedAliases.includes(name) || normalizedAliases.includes(label);
    });

    return normalizeValue(field?.value, fallback);
}

function setFieldValue(selector, value, fallback = "") {
    const el = $(selector);
    if (!el) return;

    const cleanValue = normalizeValue(value, fallback);

    if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
    ) {
        if (el.type === "checkbox") {
            el.checked = cleanValue === "1" || cleanValue === "true" || cleanValue === true;
            return;
        }

        el.value = cleanValue;
        return;
    }

    el.textContent = cleanValue || "--------";
}

function getFieldValue(selector) {
    const el = $(selector);
    if (!el) return "";

    if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
    ) {
        if (el.type === "checkbox") {
            return el.checked ? "1" : "0";
        }

        return String(el.value || "").trim();
    }

    return String(el.textContent || "").trim();
}

function buildFullNameFromFields(fields) {
    const nombres = findExtractedValue(fields, ["nombres", "nombre_s"]);
    const apellidoPaterno = findExtractedValue(fields, ["apellido_paterno", "paterno"]);
    const apellidoMaterno = findExtractedValue(fields, ["apellido_materno", "materno"]);
    const nombreCompleto = findExtractedValue(fields, ["nombre_completo", "nombre"]);

    const parts = [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean);

    if (parts.length > 0) {
        return parts.join(" ");
    }

    return nombreCompleto;
}

function buildVigenciaFromFields(fields) {
    const inicio = findExtractedValue(fields, ["vigencia_inicio"]);
    const fin = findExtractedValue(fields, ["vigencia_fin", "vigencia"]);

    if (inicio && fin) {
        return `${inicio} - ${fin}`;
    }

    if (fin) return fin;

    return "";
}

function normalizeDateForInput(value) {
    const text = normalizeValue(value);

    if (!text) return "";

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text;
    }

    const matchDMY = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);

    if (matchDMY) {
        const day = matchDMY[1].padStart(2, "0");
        const month = matchDMY[2].padStart(2, "0");
        const year = matchDMY[3];

        return `${year}-${month}-${day}`;
    }

    return "";
}

function normalizeSexo(value) {
    const text = normalizeValue(value).toUpperCase();

    if (text === "H" || text.includes("HOMBRE") || text.includes("MASCULINO")) {
        return "H";
    }

    if (text === "M" || text.includes("MUJER") || text.includes("FEMENINO")) {
        return "M";
    }

    if (text === "X") {
        return "X";
    }

    return "";
}

function splitNameFromFullName(fullName = "") {
    const parts = normalizeValue(fullName)
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length <= 1) {
        return {
            nombres: fullName,
            apellido_paterno: "",
            apellido_materno: "",
        };
    }

    if (parts.length === 2) {
        return {
            nombres: parts[0],
            apellido_paterno: parts[1],
            apellido_materno: "",
        };
    }

    return {
        nombres: parts.slice(0, -2).join(" "),
        apellido_paterno: parts[parts.length - 2],
        apellido_materno: parts[parts.length - 1],
    };
}

function buildPersonaFromFields(fields) {
    const nombreCompleto = buildFullNameFromFields(fields);
    const splitName = splitNameFromFullName(nombreCompleto);

    const nombres =
        findExtractedValue(fields, ["nombres", "nombre_s", "nombre"]) ||
        splitName.nombres;

    const apellidoPaterno =
        findExtractedValue(fields, [
            "apellido_paterno",
            "paterno",
            "primer_apellido"
        ]) ||
        splitName.apellido_paterno;

    const apellidoMaterno =
        findExtractedValue(fields, [
            "apellido_materno",
            "materno",
            "segundo_apellido"
        ]) ||
        splitName.apellido_materno;

    return {
        nombres,
        apellido_paterno: apellidoPaterno,
        apellido_materno: apellidoMaterno,
        nombre_completo: [nombres, apellidoPaterno, apellidoMaterno]
            .filter(Boolean)
            .join(" "),

        fecha_nacimiento: normalizeDateForInput(
            findExtractedValue(fields, [
                "fecha_nacimiento",
                "nacimiento",
                "fecha_de_nacimiento"
            ])
        ),

        sexo: normalizeSexo(
            findExtractedValue(fields, [
                "sexo",
                "genero"
            ])
        ),

        curp: findExtractedValue(fields, [
            "curp"
        ]),

        clave_elector: findExtractedValue(fields, [
            "clave_elector",
            "clave_de_elector",
            "claveelector"
        ]),

        seccion: findExtractedValue(fields, [
            "seccion",
            "sección",
            "seccion_electoral"
        ]),

        estado_num: findExtractedValue(fields, [
            "estado_num",
            "estado_ine",
            "entidad_num",
            "entidad_federativa_num",
            "clave_estado",
            "codigo_estado"
        ]),

        municipio_num: findExtractedValue(fields, [
            "municipio_num",
            "municipio_ine",
            "municipio_clave",
            "municipio_codigo",
            "clave_municipio",
            "codigo_municipio"
        ]),

        localidad_num: findExtractedValue(fields, [
            "localidad_num",
            "localidad_ine",
            "localidad_clave",
            "localidad_codigo",
            "clave_localidad",
            "codigo_localidad"
        ]),

        anio_registro: findExtractedValue(fields, [
            "anio_registro",
            "ano_registro",
            "año_registro",
            "registro",
            "anio_de_registro",
            "ano_de_registro"
        ]),

        emision: findExtractedValue(fields, [
            "emision",
            "emisión",
            "anio_emision",
            "ano_emision",
            "año_emision",
            "anio_de_emision",
            "ano_de_emision"
        ]),

        vigencia_inicio: findExtractedValue(fields, [
            "vigencia_inicio",
            "inicio_vigencia",
            "vigencia_desde"
        ]),

        vigencia_fin: findExtractedValue(fields, [
            "vigencia_fin",
            "vigencia",
            "fin_vigencia",
            "vigencia_hasta"
        ]),

        ocr: findExtractedValue(fields, [
            "ocr",
            "numero_ocr",
            "ocr_num"
        ]),

        cic: findExtractedValue(fields, [
            "cic",
            "numero_cic",
            "cic_num"
        ]),

        idmex: findExtractedValue(fields, [
            "idmex",
            "id_mex",
            "id_mexico",
            "identificador_mex",
            "identificador_mexico"
        ]),

        domicilio_texto: findExtractedValue(fields, [
            "domicilio_texto",
            "domicilio",
            "domicilio_completo",
            "direccion",
            "dirección"
        ]),

        calle: findExtractedValue(fields, [
            "calle",
            "vialidad"
        ]),

        numero_exterior: findExtractedValue(fields, [
            "numero_exterior",
            "num_ext",
            "no_ext",
            "numero_ext",
            "exterior"
        ]),

        numero_interior: findExtractedValue(fields, [
            "numero_interior",
            "num_int",
            "no_int",
            "numero_int",
            "interior"
        ]),

        colonia: findExtractedValue(fields, [
            "colonia",
            "col",
            "asentamiento"
        ]),

        localidad: findExtractedValue(fields, [
            "localidad",
            "localidad_texto",
            "localidad_nombre",
            "ciudad",
            "poblacion",
            "población"
        ]),

        municipio: findExtractedValue(fields, [
            "municipio",
            "municipio_texto",
            "municipio_nombre",
            "delegacion",
            "delegación"
        ]),

        estado: findExtractedValue(fields, [
            "estado_texto",
            "estado_nombre",
            "entidad",
            "entidad_federativa",
            "estado"
        ]),

        codigo_postal: findExtractedValue(fields, [
            "codigo_postal",
            "código_postal",
            "cp",
            "c_p"
        ]),

        telefono: findExtractedValue(fields, [
            "telefono",
            "teléfono",
            "phone"
        ]),

        whatsapp: findExtractedValue(fields, [
            "whatsapp",
            "whats"
        ]),

        email: findExtractedValue(fields, [
            "email",
            "correo",
            "correo_electronico",
            "correo_electrónico"
        ]),
    };
}

function fillPersonaForm(persona) {
    setFieldValue("#ine-modal-nombres", persona.nombres);
    setFieldValue("#ine-modal-apellido-paterno", persona.apellido_paterno);
    setFieldValue("#ine-modal-apellido-materno", persona.apellido_materno);
    setFieldValue("#ine-modal-fecha-nacimiento", persona.fecha_nacimiento);
    setFieldValue("#ine-modal-sexo", persona.sexo);

    setFieldValue("#ine-modal-nombre", persona.nombre_completo);

    setFieldValue("#ine-modal-curp", persona.curp);
    setFieldValue("#ine-modal-clave", persona.clave_elector);
    setFieldValue("#ine-modal-seccion", persona.seccion);

    setFieldValue("#ine-modal-estado-num", persona.estado_num);
    setFieldValue("#ine-modal-municipio-num", persona.municipio_num);
    setFieldValue("#ine-modal-localidad-num", persona.localidad_num);

    setFieldValue("#ine-modal-anio-registro", persona.anio_registro);
    setFieldValue("#ine-modal-emision", persona.emision);
    setFieldValue("#ine-modal-vigencia-inicio", persona.vigencia_inicio);
    setFieldValue("#ine-modal-vigencia-fin", persona.vigencia_fin);
    setFieldValue("#ine-modal-vigencia", buildVigenciaFromPersona(persona));

    setFieldValue("#ine-modal-ocr", persona.ocr);
    setFieldValue("#ine-modal-cic", persona.cic);
    setFieldValue("#ine-modal-idmex", persona.idmex);

    setFieldValue("#ine-modal-domicilio", persona.domicilio_texto);
    setFieldValue("#ine-modal-calle", persona.calle);
    setFieldValue("#ine-modal-numero-exterior", persona.numero_exterior);
    setFieldValue("#ine-modal-numero-interior", persona.numero_interior);
    setFieldValue("#ine-modal-colonia", persona.colonia);
    setFieldValue("#ine-modal-localidad", persona.localidad);
    setFieldValue("#ine-modal-municipio", persona.municipio);
    setFieldValue("#ine-modal-estado", persona.estado);
    setFieldValue("#ine-modal-codigo-postal", persona.codigo_postal);

    setFieldValue("#ine-modal-telefono", persona.telefono);
    setFieldValue("#ine-modal-whatsapp", persona.whatsapp);
    setFieldValue("#ine-modal-email", persona.email);
}

function buildVigenciaFromPersona(persona) {
    if (persona.vigencia_inicio && persona.vigencia_fin) {
        return `${persona.vigencia_inicio} - ${persona.vigencia_fin}`;
    }

    return persona.vigencia_fin || "";
}

function renderIneDataModal(extraction, provider) {
    const fields = getFieldsFromExtraction(extraction);
    const persona = buildPersonaFromFields(fields);

    setFieldValue(SEL.modalFecha, getTodayLongEs());
    setFieldValue(SEL.modalRegistrado, provider === "watsonx" ? "Watsonx" : "OpenAI");
    setFieldValue(SEL.modalEditado, "");

    fillPersonaForm(persona);

    const front = $(SEL.modalFront);
    const back = $(SEL.modalBack);
    const json = $(SEL.modalJson);

    if (front && State.captures.front) front.src = State.captures.front;
    if (back && State.captures.back) back.src = State.captures.back;

    if (json) {
        json.textContent = JSON.stringify(
            {
                provider,
                persona,
                extraction,
            },
            null,
            2
        );
    }
}

function getPersonaFormPayload() {
    return {
        nombres: getFieldValue("#ine-modal-nombres"),
        apellido_paterno: getFieldValue("#ine-modal-apellido-paterno"),
        apellido_materno: getFieldValue("#ine-modal-apellido-materno"),
        fecha_nacimiento: getFieldValue("#ine-modal-fecha-nacimiento"),
        sexo: getFieldValue("#ine-modal-sexo"),

        curp: getFieldValue("#ine-modal-curp"),
        clave_elector: getFieldValue("#ine-modal-clave"),

        seccion: getFieldValue("#ine-modal-seccion"),
        estado_num: getFieldValue("#ine-modal-estado-num"),
        municipio_num: getFieldValue("#ine-modal-municipio-num"),
        localidad_num: getFieldValue("#ine-modal-localidad-num"),

        anio_registro: getFieldValue("#ine-modal-anio-registro"),
        emision: getFieldValue("#ine-modal-emision"),
        vigencia_inicio: getFieldValue("#ine-modal-vigencia-inicio"),
        vigencia_fin: getFieldValue("#ine-modal-vigencia-fin"),

        ocr: getFieldValue("#ine-modal-ocr"),
        cic: getFieldValue("#ine-modal-cic"),
        idmex: getFieldValue("#ine-modal-idmex"),

        domicilio_texto: getFieldValue("#ine-modal-domicilio"),
        calle: getFieldValue("#ine-modal-calle"),
        numero_exterior: getFieldValue("#ine-modal-numero-exterior"),
        numero_interior: getFieldValue("#ine-modal-numero-interior"),
        colonia: getFieldValue("#ine-modal-colonia"),
        localidad: getFieldValue("#ine-modal-localidad"),
        municipio: getFieldValue("#ine-modal-municipio"),
        estado: getFieldValue("#ine-modal-estado"),
        codigo_postal: getFieldValue("#ine-modal-codigo-postal"),

        telefono: getFieldValue("#ine-modal-telefono"),
        whatsapp: getFieldValue("#ine-modal-whatsapp"),
        email: getFieldValue("#ine-modal-email"),

        acepta_tratamiento_datos: getFieldValue("#ine-modal-acepta-tratamiento"),
        acepta_datos_sensibles: getFieldValue("#ine-modal-acepta-sensibles"),
        acepta_contacto_whatsapp: getFieldValue("#ine-modal-acepta-whatsapp"),
        aviso_privacidad_version: getFieldValue("#ine-modal-aviso-version"),

        observaciones: getFieldValue("#ine-modal-observaciones"),

        provider: getFieldValue(SEL.modalRegistrado),
        fecha_extraccion_texto: getFieldValue(SEL.modalFecha),

        capturas: {
            front: State.captures.front,
            back: State.captures.back,
        },

        extraction_result: State.extractionResult,
    };
}

function validatePersonaPayload(payload) {
    const errors = [];

    if (!payload.nombres) {
        errors.push("El nombre es obligatorio.");
    }

    if (!payload.curp) {
        errors.push("La CURP es obligatoria.");
    }

    if (!payload.clave_elector) {
        errors.push("La clave de elector es obligatoria.");
    }

    if (!payload.seccion) {
        errors.push("La sección es obligatoria.");
    }

    if (payload.curp && payload.curp.length !== 18) {
        errors.push("La CURP debe tener 18 caracteres.");
    }

    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        errors.push("El correo no tiene un formato válido.");
    }

    if (payload.acepta_tratamiento_datos !== "1") {
        errors.push("Debe aceptar el tratamiento de datos personales.");
    }

    if (payload.acepta_datos_sensibles !== "1") {
        errors.push("Debe aceptar el tratamiento de datos sensibles.");
    }

    return errors;
}

async function submitPersonaForm(event) {
    event.preventDefault();

    const payload = getPersonaFormPayload();
    const errors = validatePersonaPayload(payload);

    if (errors.length > 0) {
        toast(errors.join("\n"), "error", 9000);
        console.warn("[Captura INE] Formulario persona inválido:", errors, payload);
        return;
    }

    console.group("[Captura INE] Payload listo para guardar persona");
    console.log(payload);
    console.groupEnd();

    /*
     * Aquí después conectamos el endpoint real de inserción.
     * Importante: el backend debe generar uuid, hashes, cifrados,
     * seccion_id, capturado_por, created_by y fecha_consentimiento.
     */
    toast("Datos listos. Falta conectar endpoint para guardar persona.", "advertencia", 7000);
}

function openIneDataModal() {
    const modal = $(SEL.modal);
    if (!modal) return;

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");

    document.body.style.overflow = "hidden";
}

function closeIneDataModal() {
    const modal = $(SEL.modal);
    if (!modal) return;

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");

    document.body.style.overflow = "";
}

function bindIneDataModal() {
    document.addEventListener("click", (event) => {
        const closeTarget = event.target.closest("[data-ine-modal-close]");

        if (closeTarget) {
            closeIneDataModal();
            return;
        }

        if (event.target.closest("#ine-modal-reprocess")) {
            closeIneDataModal();
            toast("Puedes volver a procesar la INE con Watsonx u OpenAI.", "advertencia", 4500);
            return;
        }
    });

    const form = $("#ine-persona-form");

    if (form) {
        form.addEventListener("submit", submitPersonaForm);
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeIneDataModal();
        }
    });
}

function closeScanner() {
    stopCamera();

    const modal = $(SEL.modal);
    if (modal && !modal.hidden) {
        closeIneDataModal();
    }

    window.location.href = "/PRI/Views/home.php";
}

function bindEvents() {
    $(SEL.close)?.addEventListener("click", closeScanner);
    $(SEL.retry)?.addEventListener("click", retryCapture);
    $(SEL.continue)?.addEventListener("click", continueFlow);

    $(SEL.processWatsonx)?.addEventListener("click", () => processOCR("watsonx"));
    $(SEL.processOpenAI)?.addEventListener("click", () => processOCR("openai"));

    bindDebugImageFromPC();
    bindIneDataModal();

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