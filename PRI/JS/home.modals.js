"use strict";

/* -------------------------------------------------------------------------- */
/* RED HOME · MODALES                                                         */
/* Flujo: abrir scanner -> frente -> reverso -> resumen -> OpenAI -> revisión */
/* -------------------------------------------------------------------------- */

const CONFIG = {
    DEBUG_LOGS: true,

    CAMERA: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        facingMode: { ideal: "environment" },
    },

    EXTRACTION: {
        compositeMaxWidth: 1400,
        compositeQuality: 0.86,
        rawText: "",
    },
};

const ENDPOINTS = {
    extractOpenAI: "/PRI/extract_identificacion_openai.php",
};

const TAG = "[RED Home Modals]";
const log = (...args) => CONFIG.DEBUG_LOGS && console.log(TAG, ...args);
const warn = (...args) => CONFIG.DEBUG_LOGS && console.warn(TAG, ...args);

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const State = {
    stream: null,
    step: "front",
    captureState: "idle",

    captures: {
        front: null,
        back: null,
    },
};

const SEL = {
    btnAdd: "#red-btn-add",

    modal: "#ine-capture-modal",
    close: "[data-ine-capture-close]",

    screen: ".ine-capture-screen",

    stage: ".ine-camera-stage",
    video: "#ine-camera-video",
    guideBox: ".ine-camera-guide-box",

    stepTitle: "#ine-camera-step-title",
    status: "#ine-camera-status",

    btnCapture: "#ine-btn-capture",
    btnRetry: "#ine-btn-retry",
    btnNext: "#ine-btn-next",
    btnSummaryRetry: "#ine-btn-summary-retry",
    btnReadData: "#ine-btn-read-data",

    previewFront: "#ine-preview-front",
    previewBack: "#ine-preview-back",

    reviewModal: "#ine-review-modal",
    reviewClose: "[data-ine-review-close]",
    reviewForm: "#ine-review-form",
    btnReprocess: "#ine-btn-reprocess",

    reviewFront: "#ine-review-front",
    reviewBack: "#ine-review-back",
};

/* -------------------------------------------------------------------------- */
/* HELPERS UI                                                                  */
/* -------------------------------------------------------------------------- */

function toast(message, type = "exito", duration = 4500) {
    const safeType = type === "advertencia" ? "warning" : type;

    if (typeof window.gcToast === "function") {
        window.gcToast(message, safeType, duration);
        return;
    }

    console.log(`[Toast fallback][${safeType}]`, message);
}

function setHidden(el, hidden) {
    if (!el) return;
    el.hidden = Boolean(hidden);
}

function setModalOpen(isOpen) {
    const modal = $(SEL.modal);
    if (!modal) return;

    modal.hidden = !isOpen;
    modal.setAttribute("aria-hidden", isOpen ? "false" : "true");

    syncBodyModalState();
}

function paintReviewImages(payload) {
    const front = $(SEL.reviewFront);
    const back = $(SEL.reviewBack);

    if (front && payload?.images?.front) {
        front.src = payload.images.front;
    }

    if (back && payload?.images?.back) {
        back.src = payload.images.back;
    }
}

function setReviewModalOpen(isOpen) {
    const modal = $(SEL.reviewModal);
    if (!modal) return;

    modal.hidden = !isOpen;
    modal.setAttribute("aria-hidden", isOpen ? "false" : "true");

    syncBodyModalState();
}

function syncBodyModalState() {
    const captureModal = $(SEL.modal);
    const reviewModal = $(SEL.reviewModal);

    const captureOpen = Boolean(captureModal && !captureModal.hidden);
    const reviewOpen = Boolean(reviewModal && !reviewModal.hidden);

    document.body.classList.toggle("ine-modal-open", captureOpen || reviewOpen);
}

function showScreen(name) {
    $$(SEL.screen).forEach((screen) => {
        screen.classList.toggle("is-active", screen.dataset.ineScreen === name);
    });
}

function setCaptureState(state) {
    State.captureState = state;

    const stage = $(SEL.stage);
    if (!stage) return;

    stage.dataset.state = state;
}

function setStep(step) {
    State.step = step;

    const stage = $(SEL.stage);
    const title = $(SEL.stepTitle);
    const status = $(SEL.status);

    if (stage) {
        stage.dataset.step = step;
    }

    if (step === "front") {
        if (title) title.textContent = "Coloca el frente de la INE dentro del recuadro";
        if (status) status.textContent = "Cuando la INE esté bien alineada, presiona Capturar";
    }

    if (step === "back") {
        if (title) title.textContent = "Coloca el reverso de la INE dentro del recuadro";
        if (status) status.textContent = "Cuando el reverso esté bien alineado, presiona Capturar";
    }
}

function resetButtonsForCapture() {
    const btnCapture = $(SEL.btnCapture);
    const btnRetry = $(SEL.btnRetry);
    const btnNext = $(SEL.btnNext);

    if (btnCapture) {
        btnCapture.hidden = false;
        btnCapture.disabled = false;
        btnCapture.textContent = "Capturar";
    }

    setHidden(btnRetry, true);
    setHidden(btnNext, true);
}

function prepareCaptureStep(step) {
    setStep(step);
    setCaptureState("ready");
    resetButtonsForCapture();
    showScreen("camera");

    log("Paso preparado:", {
        step: State.step,
        hasFront: Boolean(State.captures.front),
        hasBack: Boolean(State.captures.back),
    });
}

function resetCaptureFlow() {
    State.step = "front";
    State.captureState = "idle";
    State.captures.front = null;
    State.captures.back = null;

    const front = $(SEL.previewFront);
    const back = $(SEL.previewBack);

    if (front) front.removeAttribute("src");
    if (back) back.removeAttribute("src");

    prepareCaptureStep("front");
}

function lockCaptureButton(isLocked, text = "Capturar") {
    const btnCapture = $(SEL.btnCapture);
    if (!btnCapture) return;

    btnCapture.disabled = Boolean(isLocked);
    btnCapture.textContent = text;
}

/* -------------------------------------------------------------------------- */
/* CÁMARA                                                                      */
/* -------------------------------------------------------------------------- */

async function startCamera() {
    const video = $(SEL.video);

    if (!video) {
        warn("No se encontró el video del modal.");
        return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        showCameraError("Tu navegador no permite usar la cámara.");
        return;
    }

    stopCamera();

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: CONFIG.CAMERA,
            audio: false,
        });

        State.stream = stream;
        video.srcObject = stream;

        await new Promise((resolve) => {
            if (video.readyState >= 2) {
                resolve();
                return;
            }

            video.onloadedmetadata = () => resolve();
        });

        try {
            await video.play();
        } catch (error) {
            warn("video.play() falló, pero el stream ya fue asignado:", error);
        }

        prepareCaptureStep(State.step || "front");

        log("Cámara iniciada correctamente.");
    } catch (error) {
        warn("No se pudo abrir la cámara:", error);

        State.stream = null;
        video.srcObject = null;

        showCameraError("No se pudo abrir la cámara. Revisa los permisos del navegador.");
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

function showCameraError(message) {
    setCaptureState("error");

    const status = $(SEL.status);
    const btnCapture = $(SEL.btnCapture);
    const btnRetry = $(SEL.btnRetry);
    const btnNext = $(SEL.btnNext);

    if (status) status.textContent = message;

    if (btnCapture) {
        btnCapture.hidden = false;
        btnCapture.disabled = false;
        btnCapture.textContent = "Capturar";
    }

    setHidden(btnRetry, false);
    setHidden(btnNext, true);

    toast(message, "error", 6000);
}

/* -------------------------------------------------------------------------- */
/* CAPTURA                                                                     */
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

    sx = Math.max(0, Math.min(sx, videoWidth - 1));
    sy = Math.max(0, Math.min(sy, videoHeight - 1));
    sw = Math.max(1, Math.min(sw, videoWidth - sx));
    sh = Math.max(1, Math.min(sh, videoHeight - sy));

    return {
        sx: Math.round(sx),
        sy: Math.round(sy),
        sw: Math.round(sw),
        sh: Math.round(sh),
    };
}

function captureGuideImage() {
    const video = $(SEL.video);
    const guideBox = $(SEL.guideBox);

    if (!video) {
        throw new Error("No se encontró el video.");
    }

    if (!guideBox) {
        throw new Error("No se encontró el recuadro guía.");
    }

    if (!video.videoWidth || !video.videoHeight) {
        throw new Error("La cámara aún no está lista para capturar.");
    }

    const crop = getVideoCropFromGuide(video, guideBox, 0.08);

    const canvas = document.createElement("canvas");
    canvas.width = crop.sw;
    canvas.height = crop.sh;

    const ctx = canvas.getContext("2d", { alpha: false });

    if (!ctx) {
        throw new Error("No se pudo preparar el canvas de captura.");
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

    const dataUrl = canvas.toDataURL("image/jpeg", 0.86);

    log("Captura generada:", {
        step: State.step,
        crop,
        width: canvas.width,
        height: canvas.height,
        dataUrlLength: dataUrl.length,
    });

    return dataUrl;
}

async function captureCurrentStep() {
    if (State.captureState === "captured" || State.captureState === "processing") {
        return;
    }

    try {
        lockCaptureButton(true, "Capturando...");
        setCaptureState("processing");

        await new Promise((resolve) => setTimeout(resolve, 280));

        const imageData = captureGuideImage();
        acceptCapture(imageData, State.step);
    } catch (error) {
        warn("Error capturando imagen:", error);
        showCameraError(error?.message || "No se pudo capturar la imagen.");
    } finally {
        if (State.captureState !== "captured") {
            lockCaptureButton(false, "Capturar");
        }
    }
}

function acceptCapture(imageData, side) {
    State.captures[side] = imageData;

    setCaptureState("captured");

    const status = $(SEL.status);
    const btnCapture = $(SEL.btnCapture);
    const btnRetry = $(SEL.btnRetry);
    const btnNext = $(SEL.btnNext);

    if (status) {
        status.innerHTML =
            side === "front"
                ? "<strong>¡Excelente! Frente capturado correctamente.</strong><br>Continúa con el reverso."
                : "<strong>¡Excelente! Reverso capturado correctamente.</strong><br>Ya puedes revisar las capturas.";
    }

    if (btnCapture) {
        btnCapture.hidden = true;
        btnCapture.disabled = false;
        btnCapture.textContent = "Capturar";
    }

    setHidden(btnRetry, false);
    setHidden(btnNext, false);

    if (btnNext) {
        btnNext.textContent = side === "front" ? "Continuar al reverso" : "Ver resumen";
    }

    toast(
        side === "front"
            ? "Frente capturado correctamente"
            : "Reverso capturado correctamente",
        "exito",
        3000
    );

    log("Captura aceptada:", {
        side,
        hasFront: Boolean(State.captures.front),
        hasBack: Boolean(State.captures.back),
    });
}

function retryCurrentStep() {
    State.captures[State.step] = null;
    prepareCaptureStep(State.step);
}

function continueFlow() {
    log("Continuar flujo:", {
        step: State.step,
        hasFront: Boolean(State.captures.front),
        hasBack: Boolean(State.captures.back),
    });

    if (State.step === "front") {
        if (!State.captures.front) {
            toast("Primero captura el frente de la INE.", "error", 4500);
            prepareCaptureStep("front");
            return;
        }

        prepareCaptureStep("back");
        return;
    }

    if (State.step === "back") {
        if (!State.captures.back) {
            toast("Primero captura el reverso de la INE.", "error", 4500);
            prepareCaptureStep("back");
            return;
        }

        showSummary();
    }
}

/* -------------------------------------------------------------------------- */
/* RESUMEN                                                                     */
/* -------------------------------------------------------------------------- */

function showSummary() {
    const front = $(SEL.previewFront);
    const back = $(SEL.previewBack);

    if (front && State.captures.front) front.src = State.captures.front;
    if (back && State.captures.back) back.src = State.captures.back;

    stopCamera();
    showScreen("summary");

    log("Resumen mostrado.");
}

/* -------------------------------------------------------------------------- */
/* OPENAI                                                                      */
/* -------------------------------------------------------------------------- */

function dataUrlSizeBytes(dataUrl) {
    const base64 = String(dataUrl || "").split(",")[1] || "";
    return Math.ceil((base64.length * 3) / 4);
}

function dataUrlSizeMB(dataUrl) {
    return dataUrlSizeBytes(dataUrl) / 1024 / 1024;
}

function loadImageFromDataUrl(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("No se pudo cargar una captura para procesarla."));

        img.src = dataUrl;
    });
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
    imageDataUrl,
    rawText = "",
    imagesCount = 2,
}) {
    if (!imageDataUrl) {
        throw new Error("No hay imagen para enviar a OpenAI.");
    }

    const imageSizeMb = dataUrlSizeMB(imageDataUrl);

    const payload = {
        image_data_url: imageDataUrl,
        raw_text: String(rawText || "").trim().substring(0, 6000),
        image_size_mb: Number(imageSizeMb.toFixed(3)),
        images_count: imagesCount,
    };

    console.group("[RED Home Modals] Enviando extracción OpenAI");
    console.log("Endpoint:", ENDPOINTS.extractOpenAI);
    console.log("Image size MB:", payload.image_size_mb);
    console.log("Images count:", payload.images_count);
    console.log("Payload preview:", {
        ...payload,
        image_data_url: String(payload.image_data_url || "").slice(0, 90) + "...",
    });
    console.groupEnd();

    let response;
    let rawResponse = "";

    try {
        response = await fetch(ENDPOINTS.extractOpenAI, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(payload),
        });

        rawResponse = await response.text();
    } catch (error) {
        throw new Error("Error de conexión con el endpoint de OpenAI: " + error.message);
    }

    console.group("[RED Home Modals] Respuesta OpenAI");
    console.log("HTTP status:", response.status);
    console.log("OK:", response.ok);
    console.log("Content-Type:", response.headers.get("content-type"));
    console.log("Raw:", rawResponse);
    console.groupEnd();

    let data = null;

    try {
        data = JSON.parse(rawResponse);
    } catch {
        console.error("[RED Home Modals] Respuesta no JSON:", rawResponse);
        throw new Error("El endpoint de OpenAI respondió algo que no es JSON.");
    }

    if (!response.ok || !data.ok) {
        throw new Error(
            data.error ||
            data.message ||
            data.detalle ||
            `Error HTTP ${response.status}`
        );
    }

    return {
        provider: "openai",
        result: data.result || data.data || data,
        raw: data,
    };
}

async function processOpenAIData() {
    if (!State.captures.front || !State.captures.back) {
        toast("Necesitas capturar frente y reverso antes de leer datos.", "error", 5000);
        return;
    }

    const btnRead = $(SEL.btnReadData);
    const originalText = btnRead?.textContent || "Leer datos";

    if (btnRead) {
        btnRead.disabled = true;
        btnRead.textContent = "Procesando...";
    }

    showScreen("loading");

    try {
        toast("Extrayendo datos con OpenAI...", "warning", 3500);

        const compositeImage = await buildCompositeIneImageDataUrl();

        const result = await extractIdentificationData({
            imageDataUrl: compositeImage,
            rawText: CONFIG.EXTRACTION.rawText,
            imagesCount: 2,
        });

        const fields = getFieldsFromExtraction(result);
        const persona = buildPersonaFromFields(fields);

        const payload = {
            provider: "openai",
            extraction: result,
            fields,
            persona,
            images: {
                front: State.captures.front,
                back: State.captures.back,
                composite: compositeImage,
            },
        };

        log("Extracción OpenAI completada:", payload);

        toast("Datos extraídos correctamente.", "exito", 4500);

        closeCaptureModal();
        openReviewModal(payload);
    } catch (error) {
        console.error("[RED Home Modals] Error OpenAI:", error);

        toast(
            error?.message || "No se pudo procesar la identificación.",
            "error",
            9000
        );

        showScreen("summary");
    } finally {
        if (btnRead) {
            btnRead.disabled = false;
            btnRead.textContent = originalText;
        }
    }
}

/* -------------------------------------------------------------------------- */
/* NORMALIZACIÓN / MAPEO                                                       */
/* -------------------------------------------------------------------------- */

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

function normalizeFieldName(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
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

function objectToFields(object) {
    return Object.entries(object || {}).map(([key, value]) => ({
        field_name: key,
        label_detected: key,
        value,
    }));
}

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

function findExtractedValue(fields, aliases, fallback = "") {
    const normalizedAliases = aliases.map(normalizeFieldName);

    const field = fields.find((item) => {
        const name = normalizeFieldName(item?.field_name);
        const label = normalizeFieldName(item?.label_detected);

        return normalizedAliases.includes(name) || normalizedAliases.includes(label);
    });

    return normalizeValue(field?.value, fallback);
}

function parseVigencia(value) {
    const text = normalizeValue(value);
    const years = text.match(/\b(19|20)\d{2}\b/g) || [];

    return {
        vigencia_inicio: years.length >= 2 ? years[0] : "",
        vigencia_fin: years.length >= 2 ? years[1] : (years[0] || ""),
    };
}

function buildPersonaFromFields(fields) {
    const vigenciaTexto = findExtractedValue(fields, [
        "vigencia",
        "vigencia_texto",
        "valid_until",
        "expiration",
    ]);

    const vigenciaParts = parseVigencia(vigenciaTexto);

    return {
        nombres: cleanUpper(findExtractedValue(fields, [
            "nombres",
            "nombre_s",
            "given_names",
            "given_name",
        ])),

        apellido_paterno: cleanUpper(findExtractedValue(fields, [
            "apellido_paterno",
            "primer_apellido",
            "paterno",
            "surname_1",
        ])),

        apellido_materno: cleanUpper(findExtractedValue(fields, [
            "apellido_materno",
            "segundo_apellido",
            "materno",
            "surname_2",
        ])),

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

        seccion_id: onlyDigits(findExtractedValue(fields, [
            "seccion_id",
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
            "valid_until",
            "expiration",
        ]) || vigenciaParts.vigencia_fin),

        domicilio_texto: cleanUpper(findExtractedValue(fields, [
            "domicilio_texto",
            "domicilio",
            "direccion",
            "dirección",
            "address",
        ])),

        calle: cleanUpper(findExtractedValue(fields, [
            "calle",
            "street",
        ])),

        numero_exterior: cleanUpper(findExtractedValue(fields, [
            "numero_exterior",
            "número_exterior",
            "num_ext",
            "no_ext",
            "exterior",
        ])),

        numero_interior: cleanUpper(findExtractedValue(fields, [
            "numero_interior",
            "número_interior",
            "num_int",
            "no_int",
            "interior",
        ])),

        colonia: cleanUpper(findExtractedValue(fields, [
            "colonia",
            "col",
            "neighborhood",
        ])),

        localidad: cleanUpper(findExtractedValue(fields, [
            "localidad",
            "localidad_texto",
            "loc",
        ])),

        municipio: cleanUpper(findExtractedValue(fields, [
            "municipio",
            "municipio_texto",
            "ciudad",
            "city",
        ])),

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

        observaciones: "",
    };
}

function fillReviewForm(persona) {
    setFieldValue("#ine-review-fecha-extraccion", getTodayLongEs());

    setFieldValue("#ine-review-nombres", persona.nombres);
    setFieldValue("#ine-review-apellido-paterno", persona.apellido_paterno);
    setFieldValue("#ine-review-apellido-materno", persona.apellido_materno);
    setFieldValue("#ine-review-fecha-nacimiento", persona.fecha_nacimiento);
    setFieldValue("#ine-review-sexo", persona.sexo);

    setFieldValue("#ine-review-curp", persona.curp);
    setFieldValue("#ine-review-clave-elector", persona.clave_elector);
    setFieldValue("#ine-review-seccion", persona.seccion_id);

    setFieldValue("#ine-review-anio-registro", persona.anio_registro);
    setFieldValue("#ine-review-emision", persona.emision);
    setFieldValue("#ine-review-vigencia-inicio", persona.vigencia_inicio);
    setFieldValue("#ine-review-vigencia-fin", persona.vigencia_fin);

    setFieldValue("#ine-review-domicilio", persona.domicilio_texto);

    setFieldValue("#ine-review-telefono", persona.telefono);
    setFieldValue("#ine-review-whatsapp", persona.whatsapp);
    setFieldValue("#ine-review-email", persona.email);

    setFieldValue("#ine-review-acepta-tratamiento", "0");
    setFieldValue("#ine-review-acepta-whatsapp", "0");
    setFieldValue("#ine-review-observaciones", persona.observaciones);
}

/* -------------------------------------------------------------------------- */
/* MODAL REVISIÓN                                                              */
/* -------------------------------------------------------------------------- */

function openReviewModal(payload) {
    const modal = $(SEL.reviewModal);

    if (!modal) {
        warn("No existe #ine-review-modal en esta vista.");
        console.log("Payload listo para review:", payload);
        return;
    }

    fillReviewForm(payload.persona || {});
    modal.__inePayload = payload;
    paintReviewImages(payload);

    setReviewModalOpen(true);

    log("Modal de revisión abierto:", payload);
}

function closeReviewModal() {
    setReviewModalOpen(false);
}

function collectReviewPayload() {
    return {
        nombres: getFieldValue("#ine-review-nombres"),
        apellido_paterno: getFieldValue("#ine-review-apellido-paterno"),
        apellido_materno: getFieldValue("#ine-review-apellido-materno"),
        fecha_nacimiento: getFieldValue("#ine-review-fecha-nacimiento"),
        sexo: getFieldValue("#ine-review-sexo"),

        curp: getFieldValue("#ine-review-curp"),
        clave_elector: getFieldValue("#ine-review-clave-elector"),
        seccion_id: getFieldValue("#ine-review-seccion"),

        anio_registro: getFieldValue("#ine-review-anio-registro"),
        emision: getFieldValue("#ine-review-emision"),
        vigencia_inicio: getFieldValue("#ine-review-vigencia-inicio"),
        vigencia_fin: getFieldValue("#ine-review-vigencia-fin"),

        domicilio_texto: getFieldValue("#ine-review-domicilio"),

        telefono: getFieldValue("#ine-review-telefono"),
        whatsapp: getFieldValue("#ine-review-whatsapp"),
        email: getFieldValue("#ine-review-email"),

        acepta_tratamiento_datos: getFieldValue("#ine-review-acepta-tratamiento"),
        acepta_contacto_whatsapp: getFieldValue("#ine-review-acepta-whatsapp"),

        observaciones: getFieldValue("#ine-review-observaciones"),
    };
}

function handleReviewSubmit(event) {
    event.preventDefault();

    const payload = collectReviewPayload();

    if (!payload.nombres) {
        toast("El campo Nombre(s) es obligatorio.", "error", 5000);
        return;
    }

    log("Payload listo para guardar persona:", payload);

    toast("Datos listos para guardar. Falta conectar el endpoint de alta.", "warning", 5000);
}

function bindReviewModalEvents() {
    $$(SEL.reviewClose).forEach((btn) => {
        btn.addEventListener("click", closeReviewModal);
    });

    $(SEL.btnReprocess)?.addEventListener("click", () => {
        closeReviewModal();
        setModalOpen(true);
        showSummary();
    });

    $(SEL.reviewForm)?.addEventListener("submit", handleReviewSubmit);
}

/* -------------------------------------------------------------------------- */
/* APERTURA / CIERRE                                                           */
/* -------------------------------------------------------------------------- */

async function openCaptureModal() {
    log("Abriendo modal captura INE.");

    resetCaptureFlow();
    setModalOpen(true);

    await startCamera();
}

function closeCaptureModal() {
    log("Cerrando modal captura INE.");

    stopCamera();
    setModalOpen(false);
    resetCaptureFlow();
}

function handleEscape(event) {
    if (event.key !== "Escape") return;

    const reviewModal = $(SEL.reviewModal);
    if (reviewModal && !reviewModal.hidden) {
        closeReviewModal();
        return;
    }

    const captureModal = $(SEL.modal);
    if (captureModal && !captureModal.hidden) {
        closeCaptureModal();
    }
}

/* -------------------------------------------------------------------------- */
/* BIND                                                                        */
/* -------------------------------------------------------------------------- */

function bindCaptureModalEvents() {
    $(SEL.btnAdd)?.addEventListener("click", openCaptureModal);

    $$(SEL.close).forEach((btn) => {
        btn.addEventListener("click", closeCaptureModal);
    });

    $(SEL.btnCapture)?.addEventListener("click", captureCurrentStep);
    $(SEL.btnRetry)?.addEventListener("click", retryCurrentStep);
    $(SEL.btnNext)?.addEventListener("click", continueFlow);

    $(SEL.btnSummaryRetry)?.addEventListener("click", async () => {
        stopCamera();
        resetCaptureFlow();
        setModalOpen(true);
        await startCamera();
    });

    $(SEL.btnReadData)?.addEventListener("click", processOpenAIData);

    document.addEventListener("keydown", handleEscape);

    bindReviewModalEvents();
}

function init() {
    const modal = $(SEL.modal);

    if (!modal) {
        warn("No existe #ine-capture-modal en esta vista.");
        return;
    }

    bindCaptureModalEvents();

    log("home.modals.js inicializado.");
}

document.addEventListener("DOMContentLoaded", init);