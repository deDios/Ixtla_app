"use strict";

const CONFIG = {
    DEBUG: true,

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

    captures: {
        front: null,
        back: null,
    },

    extractionResult: null,
};

const SEL = {
    stage: ".scanner-stage",
    video: "#scanner-video",
    guideBox: ".scanner-guide-box",
    close: "#scanner-close",

    progressBar: "#scanner-progress-bar",
    statusText: "#scanner-status-text",
    stepTitle: "#scanner-step-title",
    stepHelp: "#scanner-step-help",

    capture: "#scanner-btn-capture",
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
    modalRegistrado: "#ine-modal-registrado",
    modalEditado: "#ine-modal-editado",
    modalFront: "#ine-modal-front",
    modalBack: "#ine-modal-back",
    modalJson: "#ine-modal-json",
};

/* -------------------------------------------------------------------------- */
/* UTILIDADES                                                                  */
/* -------------------------------------------------------------------------- */

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

function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
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

    if (
        !text ||
        text === "--------" ||
        text === "--" ||
        text.toLowerCase() === "null" ||
        text.toLowerCase() === "undefined" ||
        text.toLowerCase() === "no disponible" ||
        text.toLowerCase() === "n/a"
    ) {
        return fallback;
    }

    return text;
}

function cleanUpper(value) {
    return normalizeValue(value)
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase();
}

function onlyDigits(value) {
    return normalizeValue(value).replace(/\D+/g, "");
}

function normalizeYear(value) {
    const text = normalizeValue(value);
    const match = text.match(/\b(19|20)\d{2}\b/);

    return match ? match[0] : "";
}

function normalizeSex(value) {
    const text = cleanUpper(value);

    if (["H", "HOMBRE", "MASCULINO"].includes(text)) return "H";
    if (["M", "MUJER", "FEMENINO"].includes(text)) return "M";
    if (text === "X") return "X";

    return "";
}

function normalizeDateToInput(value) {
    const text = normalizeValue(value);

    if (!text) return "";

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
        return text;
    }

    const dmy = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);

    if (dmy) {
        const dd = dmy[1].padStart(2, "0");
        const mm = dmy[2].padStart(2, "0");
        const yyyy = dmy[3];

        return `${yyyy}-${mm}-${dd}`;
    }

    const compact = text.match(/\b(\d{2})(\d{2})(\d{2})\b/);

    if (compact) {
        const yy = Number(compact[1]);
        const mm = compact[2];
        const dd = compact[3];
        const yyyy = yy > 30 ? `19${compact[1]}` : `20${compact[1]}`;

        return `${yyyy}-${mm}-${dd}`;
    }

    return "";
}

function getTodayLongEs() {
    return new Intl.DateTimeFormat("es-MX", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    }).format(new Date());
}

function setFieldValue(selector, value, fallback = "") {
    const el = $(selector);
    if (!el) return;

    const cleanValue = normalizeValue(value, fallback);

    if (el.type === "checkbox") {
        el.checked = cleanValue === "1" || cleanValue === "true" || cleanValue === true;
        return;
    }

    if ("value" in el) {
        el.value = cleanValue;
        return;
    }

    el.textContent = cleanValue;
}

function getFieldValue(selector) {
    const el = $(selector);
    if (!el) return "";

    if (el.type === "checkbox") {
        return el.checked ? "1" : "0";
    }

    if ("value" in el) {
        return normalizeValue(el.value);
    }

    return normalizeValue(el.textContent);
}

/* -------------------------------------------------------------------------- */
/* ESTADOS UI DEL SCANNER                                                      */
/* -------------------------------------------------------------------------- */

function setStageState(state) {
    State.state = state;

    const stage = $(SEL.stage);
    if (!stage) return;

    stage.dataset.state = state;
    stage.classList.toggle("is-error", state === "error");
    stage.classList.toggle("is-processing", state === "processing");
}

function setStep(step) {
    State.step = step;

    const stage = $(SEL.stage);
    if (stage) stage.dataset.step = step;

    const title = $(SEL.stepTitle);
    const help = $(SEL.stepHelp);
    const status = $(SEL.statusText);

    if (step === "front") {
        if (title) title.textContent = "Coloca el frente de la INE dentro del recuadro";
        if (help) help.innerHTML = "Acomoda la credencial y presiona <strong>Capturar</strong>";
        if (status) status.textContent = "Cuando la INE esté bien alineada, presiona Capturar";
    }

    if (step === "back") {
        if (title) title.textContent = "Coloca el reverso de la INE dentro del recuadro";
        if (help) help.innerHTML = "Acomoda el reverso completo y presiona <strong>Capturar</strong>";
        if (status) status.textContent = "Cuando el reverso esté bien alineado, presiona Capturar";
    }
}

function resetActionButtons() {
    const capture = $(SEL.capture);
    const retry = $(SEL.retry);
    const next = $(SEL.continue);
    const bar = $(SEL.progressBar);

    if (capture) {
        capture.hidden = false;
        capture.disabled = false;
        capture.textContent = "Capturar";
    }

    if (retry) retry.hidden = true;
    if (next) next.hidden = true;
    if (bar) bar.style.width = "0%";
}

/* -------------------------------------------------------------------------- */
/* CÁMARA                                                                      */
/* -------------------------------------------------------------------------- */

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

        sprepareCaptureStep("front");

        log("Cámara iniciada correctamente en modo captura manual.");
    } catch (error) {
        warn("No se pudo iniciar la cámara:", error);
        showError("No se pudo abrir la cámara. Revisa los permisos del navegador.");
    }
}

function stopCamera() {
    if (!State.stream) return;

    State.stream.getTracks().forEach((track) => track.stop());
    State.stream = null;

    const video = $(SEL.video);
    if (video) video.srcObject = null;

    log("Cámara detenida.");
}

/* -------------------------------------------------------------------------- */
/* CAPTURA MANUAL Y RECORTE                                                    */
/* -------------------------------------------------------------------------- */

function getVideoCropFromGuide(video, guideBox, paddingRatio = 0.08) {
    const videoRect = video.getBoundingClientRect();
    const guideRect = guideBox.getBoundingClientRect();

    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (!videoWidth || !videoHeight) {
        throw new Error("El video aún no tiene dimensiones válidas.");
    }

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

async function manualCapturePhoto() {
    if (State.state === "captured" || State.state === "processing") {
        return;
    }

    const captureBtn = $(SEL.capture);
    const status = $(SEL.statusText);

    try {
        if (captureBtn) {
            captureBtn.disabled = true;
            captureBtn.textContent = "Capturando...";
        }

        if (status) {
            status.textContent = "Preparando recorte...";
        }

        setStageState("processing");

        await capturePhoto();
    } catch (error) {
        console.error("[Captura INE] Error en captura manual:", error);

        toast(
            error?.message || "No se pudo capturar la imagen.",
            "error",
            7000
        );

        showError("No se pudo capturar la imagen. Intenta de nuevo.");
    } finally {
        if (captureBtn && State.state !== "captured") {
            captureBtn.disabled = false;
            captureBtn.textContent = "Capturar";
        }
    }
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

    console.group("[Captura INE] Captura aceptada");
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
    const capture = $(SEL.capture);
    const retry = $(SEL.retry);
    const next = $(SEL.continue);
    const text = $(SEL.statusText);
    const bar = $(SEL.progressBar);

    if (bar) bar.style.width = "100%";

    if (capture) {
        capture.hidden = true;
        capture.disabled = false;
        capture.textContent = "Capturar";
    }

    if (text) {
        text.innerHTML =
            State.step === "front"
                ? "<strong>¡Excelente! Frente capturado correctamente</strong> Puedes continuar con el reverso"
                : "<strong>¡Excelente! Reverso capturado correctamente</strong> Puedes revisar las capturas";
    }

    if (retry) retry.hidden = false;
    if (next) next.hidden = false;

    if (next) {
        next.textContent = State.step === "front" ? "Continuar al reverso" : "Ver resumen";
    }
}

function prepareCaptureStep(step) {
    State.step = step;
    State.state = "ready";

    const stage = $(SEL.stage);
    const capture = $(SEL.capture);
    const retry = $(SEL.retry);
    const next = $(SEL.continue);
    const bar = $(SEL.progressBar);

    if (stage) {
        stage.dataset.step = step;
        stage.dataset.state = "ready";
        stage.classList.remove("is-error", "is-processing");
    }

    if (bar) {
        bar.style.width = "0%";
    }

    if (capture) {
        capture.hidden = false;
        capture.disabled = false;
        capture.textContent = "Capturar";
    }

    if (retry) {
        retry.hidden = true;
    }

    if (next) {
        next.hidden = true;
    }

    setStep(step);

    console.log("[Captura INE] Preparando paso:", {
        step: State.step,
        hasFront: Boolean(State.captures.front),
        hasBack: Boolean(State.captures.back),
    });
}

function retryCapture() {
    State.captures[State.step] = null;
    State.extractionResult = null;

    prepareCaptureStep(State.step);
}

function continueFlow() {
    console.log("[Captura INE] continueFlow antes:", {
        step: State.step,
        hasFront: Boolean(State.captures.front),
        hasBack: Boolean(State.captures.back),
    });

    if (State.step === "front") {
        if (!State.captures.front) {
            toast("Primero captura el frente de la INE.", "error", 5000);
            prepareCaptureStep("front");
            return;
        }

        prepareCaptureStep("back");
        return;
    }

    if (State.step === "back") {
        if (!State.captures.back) {
            toast("Primero captura el reverso de la INE.", "error", 5000);
            prepareCaptureStep("back");
            return;
        }

        showSummary();
    }
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
        front: State.captures.front ? `${State.captures.front.length} chars` : null,
        back: State.captures.back ? `${State.captures.back.length} chars` : null,
    });
}

function showError(message) {
    setStageState("error");

    const capture = $(SEL.capture);
    const text = $(SEL.statusText);
    const retry = $(SEL.retry);
    const next = $(SEL.continue);
    const bar = $(SEL.progressBar);

    if (bar) bar.style.width = "0%";
    if (text) text.textContent = message;

    if (capture) {
        capture.hidden = false;
        capture.disabled = false;
        capture.textContent = "Capturar";
    }

    if (retry) retry.hidden = false;
    if (next) next.hidden = true;
}

/* -------------------------------------------------------------------------- */
/* IMAGEN COMPUESTA PARA EXTRACCIÓN                                            */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* OCR LOCAL PARA WATSONX                                                      */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* EXTRACCIÓN OPENAI / WATSONX                                                 */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* DEBUG IMAGEN PC                                                             */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* MAPEO DE EXTRACCIÓN A PERSONA                                               */
/* -------------------------------------------------------------------------- */

function getFieldsFromExtraction(extraction) {
    const result =
        extraction?.result ||
        extraction?.raw?.result ||
        extraction?.raw?.data ||
        extraction?.raw ||
        {};

    if (Array.isArray(result.fields)) return result.fields;
    if (Array.isArray(result?.result?.fields)) return result.result.fields;
    if (Array.isArray(result?.data?.fields)) return result.data.fields;

    if (result.persona && typeof result.persona === "object") return objectToFields(result.persona);
    if (result.data?.persona && typeof result.data.persona === "object") return objectToFields(result.data.persona);
    if (result.extracted_data && typeof result.extracted_data === "object") return objectToFields(result.extracted_data);
    if (result.data && typeof result.data === "object" && !Array.isArray(result.data)) return objectToFields(result.data);
    if (typeof result === "object" && !Array.isArray(result)) return objectToFields(result);

    return [];
}

function objectToFields(object) {
    return Object.entries(object || {}).map(([key, value]) => ({
        field_name: key,
        label_detected: key,
        value,
    }));
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

function splitFullName(fullName) {
    const clean = cleanUpper(fullName);

    if (!clean) {
        return {
            nombres: "",
            apellido_paterno: "",
            apellido_materno: "",
            nombre_completo: "",
        };
    }

    const parts = clean.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
        return {
            nombres: parts[0],
            apellido_paterno: "",
            apellido_materno: "",
            nombre_completo: clean,
        };
    }

    if (parts.length === 2) {
        return {
            nombres: parts[1],
            apellido_paterno: parts[0],
            apellido_materno: "",
            nombre_completo: clean,
        };
    }

    return {
        apellido_paterno: parts[0] || "",
        apellido_materno: parts[1] || "",
        nombres: parts.slice(2).join(" "),
        nombre_completo: clean,
    };
}

function parseMrzName(mrzLine) {
    const clean = normalizeValue(mrzLine)
        .replace(/\s+/g, "")
        .toUpperCase();

    if (!clean || !clean.includes("<")) {
        return null;
    }

    const [lastNamesRaw = "", namesRaw = ""] = clean.split("<<");
    const lastNames = lastNamesRaw.split("<").filter(Boolean);
    const names = namesRaw.split("<").filter(Boolean);

    return {
        apellido_paterno: lastNames[0] || "",
        apellido_materno: lastNames[1] || "",
        nombres: names.join(" "),
        nombre_completo: [
            lastNames[0] || "",
            lastNames[1] || "",
            names.join(" "),
        ].filter(Boolean).join(" "),
    };
}

function parseVigencia(value) {
    const text = normalizeValue(value);
    const years = text.match(/\b(19|20)\d{2}\b/g) || [];

    return {
        vigencia_inicio: years.length >= 2 ? years[0] : "",
        vigencia_fin: years.length >= 2 ? years[1] : (years[0] || ""),
    };
}

function parseDomicilioParts(domicilio) {
    const text = cleanUpper(domicilio);

    const result = {
        calle: "",
        numero_exterior: "",
        numero_interior: "",
        colonia: "",
        localidad: "",
        municipio: "",
        estado: "",
        codigo_postal: "",
    };

    if (!text) return result;

    const cpMatch = text.match(/\b\d{5}\b/);
    if (cpMatch) result.codigo_postal = cpMatch[0];

    const lines = text
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean);

    const firstLine = lines[0] || text;
    const numberMatch = firstLine.match(/\b(NO\.?|NÚM\.?|NUM\.?)?\s*(\d+[A-Z0-9\-\/]*)\b/);

    if (numberMatch) {
        result.numero_exterior = numberMatch[2] || "";
        result.calle = firstLine.slice(0, numberMatch.index).trim();
    } else {
        result.calle = firstLine;
    }

    const colLine = lines.find((line) => /\b(COL|COLONIA)\b/.test(line));
    if (colLine) {
        result.colonia = colLine
            .replace(/\b(COL\.?|COLONIA)\b/g, "")
            .replace(/\b\d{5}\b/g, "")
            .trim();
    }

    const locLine = lines.find((line) => /\b(LOC|LOCALIDAD)\b/.test(line));
    if (locLine) {
        result.localidad = locLine
            .replace(/\b(LOC\.?|LOCALIDAD)\b/g, "")
            .replace(/\b\d{5}\b/g, "")
            .trim();
    }

    const lastLine = lines[lines.length - 1] || "";
    const estadoMatch = lastLine.match(/\b(AGS|BC|BCS|CAMP|CHIS|CHIH|CDMX|COAH|COL|DGO|GTO|GRO|HGO|JAL|MEX|MICH|MOR|NAY|NL|OAX|PUE|QRO|QROO|SLP|SIN|SON|TAB|TAMPS|TLAX|VER|YUC|ZAC)\.?\b/);

    if (estadoMatch) {
        result.estado = estadoMatch[0].replace(".", "");
        result.municipio = lastLine.replace(estadoMatch[0], "").replace(/\b\d{5}\b/g, "").trim();
    }

    return result;
}

function buildPersonaFromFields(fields) {
    const nombreCompleto = findExtractedValue(fields, [
        "nombre",
        "nombre_completo",
        "full_name",
        "name",
    ]);

    const mrzLinea1 = findExtractedValue(fields, [
        "mrz_linea_1",
        "mrz1",
        "linea_mrz_1",
    ]);

    const mrzLinea2 = findExtractedValue(fields, [
        "mrz_linea_2",
        "mrz2",
        "linea_mrz_2",
    ]);

    const mrzLinea3 = findExtractedValue(fields, [
        "mrz_linea_3",
        "mrz3",
        "linea_mrz_3",
        "mrz_nombre",
    ]);

    const nombreDesdeCompleto = splitFullName(nombreCompleto);
    const nombreDesdeMrz = parseMrzName(mrzLinea3) || {};

    const domicilioTexto = findExtractedValue(fields, [
        "domicilio",
        "domicilio_texto",
        "direccion",
        "dirección",
        "address",
    ]);

    const domicilioParts = parseDomicilioParts(domicilioTexto);

    const vigenciaTexto = findExtractedValue(fields, [
        "vigencia",
        "vigencia_texto",
        "valid_until",
        "expiration",
    ]);

    const vigenciaParts = parseVigencia(vigenciaTexto);

    const persona = {
        nombres: cleanUpper(findExtractedValue(fields, [
            "nombres",
            "nombre_s",
            "given_names",
            "given_name",
        ]) || nombreDesdeMrz.nombres || nombreDesdeCompleto.nombres),

        apellido_paterno: cleanUpper(findExtractedValue(fields, [
            "apellido_paterno",
            "primer_apellido",
            "paterno",
            "surname_1",
        ]) || nombreDesdeMrz.apellido_paterno || nombreDesdeCompleto.apellido_paterno),

        apellido_materno: cleanUpper(findExtractedValue(fields, [
            "apellido_materno",
            "segundo_apellido",
            "materno",
            "surname_2",
        ]) || nombreDesdeMrz.apellido_materno || nombreDesdeCompleto.apellido_materno),

        nombre_completo: cleanUpper(nombreCompleto || nombreDesdeMrz.nombre_completo || nombreDesdeCompleto.nombre_completo),

        fecha_nacimiento: normalizeDateToInput(findExtractedValue(fields, [
            "fecha_nacimiento",
            "fecha_de_nacimiento",
            "nacimiento",
            "date_of_birth",
            "dob",
        ])),

        sexo: normalizeSex(findExtractedValue(fields, [
            "sexo",
            "genero",
            "género",
            "sex",
            "gender",
        ])),

        curp: cleanUpper(findExtractedValue(fields, [
            "curp",
            "clave_unica",
            "clave_unica_registro_poblacion",
        ])).replace(/[^A-Z0-9]/g, ""),

        clave_elector: cleanUpper(findExtractedValue(fields, [
            "clave_elector",
            "clave_de_elector",
            "elector",
            "clave",
            "voter_key",
        ])).replace(/[^A-Z0-9]/g, ""),

        seccion: onlyDigits(findExtractedValue(fields, [
            "seccion",
            "sección",
            "seccion_electoral",
            "sección_electoral",
        ])),

        anio_registro: normalizeYear(findExtractedValue(fields, [
            "anio_registro",
            "año_registro",
            "ano_registro",
            "año_de_registro",
            "anio_de_registro",
        ])),

        emision: normalizeYear(findExtractedValue(fields, [
            "emision",
            "emisión",
            "anio_emision",
            "año_emision",
            "ano_emision",
        ])),

        vigencia_inicio: normalizeYear(findExtractedValue(fields, [
            "vigencia_inicio",
            "inicio_vigencia",
            "valid_from",
        ]) || vigenciaParts.vigencia_inicio),

        vigencia_fin: normalizeYear(findExtractedValue(fields, [
            "vigencia_fin",
            "fin_vigencia",
            "vigencia",
            "valid_until",
            "expiration",
        ]) || vigenciaParts.vigencia_fin),

        ocr: cleanUpper(findExtractedValue(fields, [
            "ocr",
            "numero_ocr",
            "ocr_number",
        ])).replace(/[^A-Z0-9]/g, ""),

        cic: cleanUpper(findExtractedValue(fields, [
            "cic",
            "codigo_identificacion_credencial",
            "codigo_de_identificacion_de_credencial",
        ])).replace(/[^A-Z0-9]/g, ""),

        idmex: cleanUpper(findExtractedValue(fields, [
            "idmex",
            "id_mex",
            "id_mexico",
            "idméx",
        ])).replace(/[^A-Z0-9]/g, ""),

        mrz_linea_1: mrzLinea1,
        mrz_linea_2: mrzLinea2,
        mrz_linea_3: mrzLinea3,

        domicilio_texto: domicilioTexto,

        calle: cleanUpper(findExtractedValue(fields, [
            "calle",
            "street",
        ]) || domicilioParts.calle),

        numero_exterior: cleanUpper(findExtractedValue(fields, [
            "numero_exterior",
            "número_exterior",
            "num_ext",
            "no_ext",
            "exterior",
        ]) || domicilioParts.numero_exterior),

        numero_interior: cleanUpper(findExtractedValue(fields, [
            "numero_interior",
            "número_interior",
            "num_int",
            "no_int",
            "interior",
        ]) || domicilioParts.numero_interior),

        colonia: cleanUpper(findExtractedValue(fields, [
            "colonia",
            "col",
            "neighborhood",
        ]) || domicilioParts.colonia),

        localidad: cleanUpper(findExtractedValue(fields, [
            "localidad",
            "localidad_texto",
            "loc",
        ]) || domicilioParts.localidad),

        municipio: cleanUpper(findExtractedValue(fields, [
            "municipio",
            "municipio_texto",
            "ciudad",
            "city",
        ]) || domicilioParts.municipio),

        estado: cleanUpper(findExtractedValue(fields, [
            "estado_texto",
            "estado_nombre",
            "entidad",
            "entidad_federativa",
            "estado",
        ]) || domicilioParts.estado),

        codigo_postal: onlyDigits(findExtractedValue(fields, [
            "codigo_postal",
            "código_postal",
            "cp",
            "c_p",
            "postal_code",
        ]) || domicilioParts.codigo_postal),

        telefono: normalizeValue(findExtractedValue(fields, [
            "telefono",
            "teléfono",
            "phone",
        ])),

        whatsapp: normalizeValue(findExtractedValue(fields, [
            "whatsapp",
            "whats",
        ])),

        email: normalizeValue(findExtractedValue(fields, [
            "email",
            "correo",
            "correo_electronico",
            "correo_electrónico",
        ])),
    };

    if (!persona.nombre_completo) {
        persona.nombre_completo = [
            persona.apellido_paterno,
            persona.apellido_materno,
            persona.nombres,
        ].filter(Boolean).join(" ");
    }

    return persona;
}

function buildVigenciaFromPersona(persona) {
    if (persona.vigencia_inicio && persona.vigencia_fin) {
        return `${persona.vigencia_inicio} - ${persona.vigencia_fin}`;
    }

    return persona.vigencia_fin || "";
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

    setFieldValue("#ine-modal-acepta-terminos", "0");
    setFieldValue("#ine-modal-acepta-tratamiento", "0");
    setFieldValue("#ine-modal-acepta-sensibles", "0");
    setFieldValue("#ine-modal-acepta-whatsapp", "0");

    setFieldValue("#ine-modal-observaciones", "");
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
                fields,
                extraction,
            },
            null,
            2
        );
    }

    console.group("[Captura INE] Persona pintada en modal");
    console.log("Provider:", provider);
    console.log("Persona:", persona);
    console.table(fields);
    console.groupEnd();
}

/* -------------------------------------------------------------------------- */
/* PAYLOAD Y VALIDACIÓN                                                        */
/* -------------------------------------------------------------------------- */

function syncConsentFields() {
    const aceptaTerminos = getFieldValue("#ine-modal-acepta-terminos") === "1" ? "1" : "0";

    setFieldValue("#ine-modal-acepta-tratamiento", aceptaTerminos);
    setFieldValue("#ine-modal-acepta-sensibles", aceptaTerminos);
    setFieldValue("#ine-modal-acepta-whatsapp", "0");

    return aceptaTerminos;
}

function getPersonaFormPayload() {
    const aceptaTerminos = syncConsentFields();

    const payload = {
        nombres: cleanUpper(getFieldValue("#ine-modal-nombres")),
        apellido_paterno: cleanUpper(getFieldValue("#ine-modal-apellido-paterno")),
        apellido_materno: cleanUpper(getFieldValue("#ine-modal-apellido-materno")),
        fecha_nacimiento: getFieldValue("#ine-modal-fecha-nacimiento"),
        sexo: normalizeSex(getFieldValue("#ine-modal-sexo")),

        curp: cleanUpper(getFieldValue("#ine-modal-curp")).replace(/[^A-Z0-9]/g, ""),
        clave_elector: cleanUpper(getFieldValue("#ine-modal-clave")).replace(/[^A-Z0-9]/g, ""),

        seccion: onlyDigits(getFieldValue("#ine-modal-seccion")),

        anio_registro: normalizeYear(getFieldValue("#ine-modal-anio-registro")),
        emision: normalizeYear(getFieldValue("#ine-modal-emision")),
        vigencia_inicio: normalizeYear(getFieldValue("#ine-modal-vigencia-inicio")),
        vigencia_fin: normalizeYear(getFieldValue("#ine-modal-vigencia-fin")),

        ocr: cleanUpper(getFieldValue("#ine-modal-ocr")).replace(/[^A-Z0-9]/g, ""),
        cic: cleanUpper(getFieldValue("#ine-modal-cic")).replace(/[^A-Z0-9]/g, ""),
        idmex: cleanUpper(getFieldValue("#ine-modal-idmex")).replace(/[^A-Z0-9]/g, ""),

        domicilio_texto: getFieldValue("#ine-modal-domicilio"),
        calle: cleanUpper(getFieldValue("#ine-modal-calle")),
        numero_exterior: cleanUpper(getFieldValue("#ine-modal-numero-exterior")),
        numero_interior: cleanUpper(getFieldValue("#ine-modal-numero-interior")),
        colonia: cleanUpper(getFieldValue("#ine-modal-colonia")),
        localidad: cleanUpper(getFieldValue("#ine-modal-localidad")),
        municipio: cleanUpper(getFieldValue("#ine-modal-municipio")),
        estado: cleanUpper(getFieldValue("#ine-modal-estado")),
        codigo_postal: onlyDigits(getFieldValue("#ine-modal-codigo-postal")),

        telefono: getFieldValue("#ine-modal-telefono"),
        whatsapp: getFieldValue("#ine-modal-whatsapp"),
        email: getFieldValue("#ine-modal-email").toLowerCase(),

        acepta_terminos: aceptaTerminos,
        acepta_tratamiento_datos: aceptaTerminos,
        acepta_datos_sensibles: aceptaTerminos,
        acepta_contacto_whatsapp: "0",
        aviso_privacidad_version: getFieldValue("#ine-modal-aviso-version") || "v1",

        observaciones: getFieldValue("#ine-modal-observaciones"),

        provider: getFieldValue(SEL.modalRegistrado),
        fecha_extraccion_texto: getFieldValue(SEL.modalFecha),

        capturas: {
            front: State.captures.front,
            back: State.captures.back,
        },

        extraction_result: State.extractionResult,
    };

    payload.nombre_completo = [
        payload.apellido_paterno,
        payload.apellido_materno,
        payload.nombres,
    ].filter(Boolean).join(" ");

    return payload;
}

function validatePersonaPayload(payload) {
    const errors = [];

    if (!payload.nombres) {
        errors.push("El nombre es obligatorio.");
    }

    if (!payload.curp) {
        errors.push("La CURP es obligatoria.");
    }

    if (payload.curp && payload.curp.length !== 18) {
        errors.push("La CURP debe tener 18 caracteres.");
    }

    if (!payload.clave_elector) {
        errors.push("La clave de elector es obligatoria.");
    }

    if (!payload.seccion) {
        errors.push("La sección es obligatoria.");
    }

    if (payload.fecha_nacimiento && !/^\d{4}-\d{2}-\d{2}$/.test(payload.fecha_nacimiento)) {
        errors.push("La fecha de nacimiento no tiene un formato válido.");
    }

    if (payload.sexo && !["H", "M", "X"].includes(payload.sexo)) {
        errors.push("El sexo debe ser H, M o X.");
    }

    if (payload.codigo_postal && payload.codigo_postal.length !== 5) {
        errors.push("El código postal debe tener 5 dígitos.");
    }

    if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        errors.push("El correo no tiene un formato válido.");
    }

    if (payload.acepta_terminos !== "1") {
        errors.push("Debe aceptar el aviso de privacidad y el tratamiento de datos.");
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

    toast("Datos listos para guardar persona. Revisa el payload en consola.", "exito", 7000);
}

/* -------------------------------------------------------------------------- */
/* MODAL                                                                       */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* CIERRE / EVENTOS / INIT                                                     */
/* -------------------------------------------------------------------------- */

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
    $(SEL.capture)?.addEventListener("click", manualCapturePhoto);
    $(SEL.retry)?.addEventListener("click", retryCapture);
    $(SEL.continue)?.addEventListener("click", continueFlow);

    $(SEL.processWatsonx)?.addEventListener("click", () => processOCR("watsonx"));
    $(SEL.processOpenAI)?.addEventListener("click", () => processOCR("openai"));

    bindDebugImageFromPC();
    bindIneDataModal();
}

function init() {
    bindEvents();
    State.step = "front";
    State.state = "idle";
    startCamera(); s
}

document.addEventListener("DOMContentLoaded", init);