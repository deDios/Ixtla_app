"use strict";

import { Session } from "/PRI/JS/auth/session.js";

/* -------------------------------------------------------------------------- */
/* RED HOME · MODALES                                                         */
/* Flujo: abrir scanner -> frente -> reverso -> resumen -> OpenAI -> revisión */
/*       -> guardar persona -> registrar INE frente/reverso                   */
/* -------------------------------------------------------------------------- */

const CONFIG = {
    DEBUG_LOGS: true,

    CAMERA: {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        facingMode: { ideal: "environment" },
    },

    MEDIA: {
        maxBytes: 900 * 1024,
        maxWidth: 1280,
        maxHeight: 900,
        preferWebp: false,
        debug: true,
    },

    EXTRACTION: {
        compositeMaxWidth: 1400,
        compositeQuality: 0.86,
        compositeMaxBytes: 1600 * 1024,
        rawText: "",
    },

    SAVE: {
        estatusIdDefault: 1,
        avisoPrivacidadVersion: "RED-INE-2026-01",
        reloadPageAfterSave: true,
        reloadDelayMs: 900,
    },
};

const ENDPOINTS = {
    extractOpenAI: "/PRI/extract_identificacion_openai.php",
    insertPersona: "/PRI/db/WEB/ixtla_i_persona.php",
    insertArchivo: "/PRI/db/WEB/ixtla_i_archivo.php",
    territorios: "/PRI/db/WEB/ixtla_c_territorio.php",
};

const TAG = "[RED Home Modals]";
const log = (...args) => CONFIG.DEBUG_LOGS && console.log(TAG, ...args);
const warn = (...args) => CONFIG.DEBUG_LOGS && console.warn(TAG, ...args);
const error = (...args) => CONFIG.DEBUG_LOGS && console.error(TAG, ...args);

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const State = {
    stream: null,
    step: "front",
    captureState: "idle",

    session: null,
    sessionData: null,
    usuario: null,
    rol: null,
    token: "",

    territorios: [],
    secciones: [],
    pendingReviewSubmit: null,

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

    residenceModal: "#red-residence-modal",
    residenceClose: "[data-red-residence-close]",
    residenceForm: "#red-residence-form",
    residenceYes: "#red-residence-yes",
    residenceNo: "#red-residence-no",
    residenceSeccionToggle: "#red-residence-seccion-toggle",
    residenceSeccionText: "#red-residence-seccion-text",
    residenceSeccionList: "#red-residence-seccion-list",
    residenceSeccion: "#red-residence-seccion",
    residenceDomicilio: "#red-residence-domicilio",
    residenceTelefono: "#red-residence-telefono",
    residenceSubmit: "#red-residence-submit",
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
    const residenceModal = $(SEL.residenceModal);

    const captureOpen = Boolean(captureModal && !captureModal.hidden);
    const reviewOpen = Boolean(reviewModal && !reviewModal.hidden);
    const residenceOpen = Boolean(residenceModal && !residenceModal.hidden);

    document.body.classList.toggle(
        "ine-modal-open",
        captureOpen || reviewOpen || residenceOpen
    );
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
/* SESIÓN / HTTP                                                               */
/* -------------------------------------------------------------------------- */

function readCookiePayload() {
    try {
        const name = "ix_emp=";
        const pair = document.cookie.split("; ").find((c) => c.startsWith(name));
        if (!pair) return null;

        const raw = decodeURIComponent(pair.slice(name.length));
        return JSON.parse(decodeURIComponent(escape(atob(raw))));
    } catch {
        return null;
    }
}

function normalizeSession(rawSession) {
    const raw = rawSession || {};
    const data = raw.data && typeof raw.data === "object" ? raw.data : raw;

    return {
        raw,
        data,
        token: data.token || raw.token || "",
        usuario: data.usuario || raw.usuario || {},
        rol: data.rol || raw.rol || {},
        persona: data.persona || raw.persona || {},
        territorios: Array.isArray(data.territorios) ? data.territorios : [],
    };
}

function readSession() {
    let session = null;

    try {
        session = Session?.get?.() || null;
    } catch (err) {
        warn("No se pudo leer Session.get()", err);
    }

    if (!session) session = readCookiePayload();

    const normalized = normalizeSession(session);

    State.session = session || null;
    State.sessionData = normalized.data;
    State.usuario = normalized.usuario;
    State.rol = normalized.rol;
    State.token = normalized.token;

    log("Sesión detectada en modales:", State.session);
    log("Sesión normalizada en modales:", normalized);

    return normalized;
}

function getUsuarioId() {
    return Number(State.usuario?.usuario_id || State.sessionData?.usuario_id || 0);
}

function getAuthHeaders() {
    const headers = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
    };

    if (State.token) {
        headers.Authorization = `Bearer ${State.token}`;
    }

    return headers;
}

async function postJSON(url, body = {}) {
    const response = await fetch(url, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
        cache: "no-store",
    });

    const status = response.status;
    const raw = await response.text();

    let data = null;

    try {
        data = raw ? JSON.parse(raw) : null;
    } catch {
        console.error(TAG, "Respuesta no JSON:", raw);
        throw new Error("El endpoint respondió algo que no es JSON.");
    }

    log("POST:", url, "status:", status, "body:", previewPayload(body), "response:", data);

    if (!response.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || `Error HTTP ${status}`);
    }

    return data;
}

function previewPayload(payload) {
    const clone = { ...(payload || {}) };

    if (typeof clone.url_archivo === "string" && clone.url_archivo.startsWith("data:")) {
        clone.url_archivo = clone.url_archivo.slice(0, 80) + "...";
    }

    if (typeof clone.image_data_url === "string" && clone.image_data_url.startsWith("data:")) {
        clone.image_data_url = clone.image_data_url.slice(0, 80) + "...";
    }

    return clone;
}

async function loadTerritoriosCatalog() {
    if (State.secciones.length) return State.secciones;

    try {
        const out = await postJSON(ENDPOINTS.territorios, {
            activo: 1,
            page: 1,
            page_size: 500,
        });

        State.territorios = Array.isArray(out.data) ? out.data : [];

        State.secciones = State.territorios
            .filter((item) => {
                return (
                    String(item?.tipo || "").toUpperCase() === "SECCION" &&
                    Number(item?.activo) === 1
                );
            })
            .sort((a, b) => {
                const ac = Number(a.codigo) || 0;
                const bc = Number(b.codigo) || 0;
                return ac - bc;
            });

        log("Secciones cargadas:", State.secciones);

        return State.secciones;
    } catch (err) {
        warn("No se pudieron cargar las secciones:", err);
        State.territorios = [];
        State.secciones = [];
        return [];
    }
}

function findSeccionByInput(value) {
    const clean = String(value || "").trim();

    if (!clean) return null;

    return State.secciones.find((item) => {
        return (
            String(item.territorio_id || "") === clean ||
            String(item.codigo || "") === clean
        );
    }) || null;
}

function paintResidenceSecciones(selectedValue = "") {
    const input = $(SEL.residenceSeccion);
    const text = $(SEL.residenceSeccionText);
    const list = $(SEL.residenceSeccionList);

    if (!input || !text || !list) return;

    const cleanSelected = String(selectedValue || "").trim();

    input.value = "";
    text.textContent = "Selecciona una sección";
    list.innerHTML = "";

    State.secciones.forEach((item) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "red-residence-combo-option";
        option.role = "option";

        const value = String(item.territorio_id || "");
        const label = `${item.codigo || "S/C"} - ${item.nombre || "Sección"}`;

        option.dataset.value = value;
        option.dataset.label = label;
        option.textContent = label;

        if (
            cleanSelected &&
            (
                String(item.territorio_id || "") === cleanSelected ||
                String(item.codigo || "") === cleanSelected
            )
        ) {
            option.classList.add("is-selected");
            option.setAttribute("aria-selected", "true");
            input.value = value;
            text.textContent = label;
        } else {
            option.setAttribute("aria-selected", "false");
        }

        option.addEventListener("click", () => {
            selectResidenceSeccion(value, label);
            closeResidenceSeccionList();
        });

        list.appendChild(option);
    });
}

function selectResidenceSeccion(value, label) {
    const input = $(SEL.residenceSeccion);
    const text = $(SEL.residenceSeccionText);
    const list = $(SEL.residenceSeccionList);

    if (input) input.value = value || "";
    if (text) text.textContent = label || "Selecciona una sección";

    if (list) {
        list.querySelectorAll(".red-residence-combo-option").forEach((btn) => {
            const selected = btn.dataset.value === String(value || "");
            btn.classList.toggle("is-selected", selected);
            btn.setAttribute("aria-selected", selected ? "true" : "false");
        });
    }
}

function openResidenceSeccionList() {
    const toggle = $(SEL.residenceSeccionToggle);
    const list = $(SEL.residenceSeccionList);

    if (!toggle || !list || toggle.disabled) return;

    list.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
}

function closeResidenceSeccionList() {
    const toggle = $(SEL.residenceSeccionToggle);
    const list = $(SEL.residenceSeccionList);

    if (!toggle || !list) return;

    list.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
}

function toggleResidenceSeccionList() {
    const list = $(SEL.residenceSeccionList);
    if (!list) return;

    if (list.hidden) {
        openResidenceSeccionList();
    } else {
        closeResidenceSeccionList();
    }
}

function setResidenceModalOpen(isOpen) {
    const modal = $(SEL.residenceModal);
    if (!modal) return;

    modal.hidden = !isOpen;
    modal.setAttribute("aria-hidden", isOpen ? "false" : "true");

    syncBodyModalState();
}

function resetResidenceModal() {
    const form = $(SEL.residenceForm);
    const seccion = $(SEL.residenceSeccion);
    const seccionToggle = $(SEL.residenceSeccionToggle);
    const seccionText = $(SEL.residenceSeccionText);
    const domicilio = $(SEL.residenceDomicilio);
    const telefono = $(SEL.residenceTelefono);
    const submit = $(SEL.residenceSubmit);

    if (form) form.reset();

    if (seccion) seccion.value = "";
    if (seccionText) seccionText.textContent = "Selecciona una sección";
    if (seccionToggle) {
        seccionToggle.disabled = true;
        seccionToggle.setAttribute("aria-expanded", "false");
    }

    closeResidenceSeccionList();

    [domicilio, telefono].forEach((field) => {
        if (field) field.disabled = true;
    });

    if (submit) submit.disabled = true;
}

function enableResidenceFields() {
    const seccionToggle = $(SEL.residenceSeccionToggle);
    const domicilio = $(SEL.residenceDomicilio);
    const telefono = $(SEL.residenceTelefono);
    const submit = $(SEL.residenceSubmit);

    if (seccionToggle) seccionToggle.disabled = false;

    [domicilio, telefono].forEach((field) => {
        if (field) field.disabled = false;
    });

    if (submit) submit.disabled = false;

    seccionToggle?.focus();
}

async function openResidenceModal(pendingPayload) {
    State.pendingReviewSubmit = pendingPayload || null;

    resetResidenceModal();

    await loadTerritoriosCatalog();

    const currentSeccion = getFieldValue("#ine-review-seccion");
    const currentDomicilio = getFieldValue("#ine-review-domicilio");
    const currentTelefono = getFieldValue("#ine-review-telefono");

    paintResidenceSecciones(currentSeccion);

    setFieldValue(SEL.residenceDomicilio, currentDomicilio);
    setFieldValue(SEL.residenceTelefono, currentTelefono);

    setResidenceModalOpen(true);
}

function closeResidenceModal({ clearPending = true } = {}) {
    setResidenceModalOpen(false);
    resetResidenceModal();

    if (clearPending) {
        State.pendingReviewSubmit = null;
    }
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
        } catch (err) {
            warn("video.play() falló, pero el stream ya fue asignado:", err);
        }

        prepareCaptureStep(State.step || "front");

        log("Cámara iniciada correctamente.");
    } catch (err) {
        warn("No se pudo abrir la cámara:", err);

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

async function captureGuideImage() {
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

    const capture = await compressCanvasCapture(canvas, {
        ...CONFIG.MEDIA,
        label: State.step,
    });

    log("Captura generada:", {
        step: State.step,
        crop,
        width: capture.width,
        height: capture.height,
        mime: capture.mime,
        extension: capture.extension,
        sizeKB: capture.sizeKB,
        withinLimit: capture.withinLimit,
    });

    return capture;
}

async function compressCanvasCapture(canvas, options = {}) {
    if (window.PRIMedia?.compressCanvasToDataUrl) {
        const result = await window.PRIMedia.compressCanvasToDataUrl(canvas, options);

        return normalizeCaptureObject(result);
    }

    warn("window.PRIMedia no está disponible. Se usará canvas.toDataURL sin compresión avanzada.");

    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    const sizeBytes = dataUrlSizeBytes(dataUrl);

    return normalizeCaptureObject({
        dataUrl,
        mime: "image/jpeg",
        extension: "jpg",
        sizeBytes,
        sizeKB: Math.round(sizeBytes / 1024),
        width: canvas.width,
        height: canvas.height,
        quality: 0.82,
        compressed: false,
        withinLimit: sizeBytes <= CONFIG.MEDIA.maxBytes,
    });
}

function normalizeCaptureObject(input) {
    if (!input) return null;

    if (typeof input === "string") {
        const sizeBytes = dataUrlSizeBytes(input);

        return {
            dataUrl: input,
            mime: getMimeFromDataUrl(input) || "image/jpeg",
            extension: getExtensionFromMime(getMimeFromDataUrl(input) || "image/jpeg"),
            sizeBytes,
            sizeKB: Math.round(sizeBytes / 1024),
            width: null,
            height: null,
            quality: null,
            compressed: false,
            withinLimit: sizeBytes <= CONFIG.MEDIA.maxBytes,
        };
    }

    const dataUrl = input.dataUrl || input.data_url || "";
    const mime = input.mime || getMimeFromDataUrl(dataUrl) || "image/jpeg";
    const sizeBytes = Number(input.sizeBytes || input.size_bytes || dataUrlSizeBytes(dataUrl) || 0);

    return {
        dataUrl,
        blob: input.blob || null,
        mime,
        extension: input.extension || getExtensionFromMime(mime),
        sizeBytes,
        sizeKB: Number(input.sizeKB || Math.round(sizeBytes / 1024) || 0),
        width: input.width || null,
        height: input.height || null,
        quality: input.quality ?? null,
        compressed: Boolean(input.compressed),
        withinLimit: input.withinLimit !== undefined ? Boolean(input.withinLimit) : true,
        original: Boolean(input.original),
    };
}

function getCaptureDataUrl(capture) {
    if (!capture) return "";
    if (typeof capture === "string") return capture;
    return capture.dataUrl || "";
}

function getMimeFromDataUrl(dataUrl) {
    const match = String(dataUrl || "").match(/^data:([^;]+);base64,/i);
    return match ? match[1].toLowerCase() : "";
}

function getExtensionFromMime(mime) {
    const clean = String(mime || "").toLowerCase();

    if (clean === "image/webp") return "webp";
    if (clean === "image/png") return "png";
    if (clean === "image/jpeg" || clean === "image/jpg") return "jpg";

    return "jpg";
}

async function captureCurrentStep() {
    if (State.captureState === "captured" || State.captureState === "processing") {
        return;
    }

    try {
        lockCaptureButton(true, "Capturando...");
        setCaptureState("processing");

        await new Promise((resolve) => setTimeout(resolve, 280));

        const imageData = await captureGuideImage();
        acceptCapture(imageData, State.step);
    } catch (err) {
        warn("Error capturando imagen:", err);
        showCameraError(err?.message || "No se pudo capturar la imagen.");
    } finally {
        if (State.captureState !== "captured") {
            lockCaptureButton(false, "Capturar");
        }
    }
}

function acceptCapture(imageData, side) {
    State.captures[side] = normalizeCaptureObject(imageData);

    setCaptureState("captured");

    const status = $(SEL.status);
    const btnCapture = $(SEL.btnCapture);
    const btnRetry = $(SEL.btnRetry);
    const btnNext = $(SEL.btnNext);

    if (status) {
        status.innerHTML =
            side === "front"
                ? "<strong>Frente capturado.</strong><br>Continúa con el reverso de la INE."
                : "<strong>Reverso capturado.</strong><br>Revisa las capturas antes de leer los datos.";
    }

    if (btnCapture) {
        btnCapture.hidden = true;
        btnCapture.disabled = false;
        btnCapture.textContent = "Capturar";
    }

    setHidden(btnRetry, false);
    setHidden(btnNext, false);

    if (btnNext) {
        btnNext.textContent = side === "front" ? "Capturar reverso" : "Ver capturas";
    }

    const capture = State.captures[side];

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
        mime: capture?.mime,
        extension: capture?.extension,
        sizeKB: capture?.sizeKB,
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

    if (front) {
        front.src = getCaptureDataUrl(State.captures.front);
    }

    if (back) {
        back.src = getCaptureDataUrl(State.captures.back);
    }

    stopCamera();
    showScreen("summary");

    log("Resumen mostrado.", {
        hasFront: Boolean(State.captures.front),
        hasBack: Boolean(State.captures.back),
    });
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
    const frontDataUrl = getCaptureDataUrl(State.captures.front);
    const backDataUrl = getCaptureDataUrl(State.captures.back);

    if (!frontDataUrl || !backDataUrl) {
        throw new Error("Faltan capturas de frente y reverso.");
    }

    const frontImg = await loadImageFromDataUrl(frontDataUrl);
    const backImg = await loadImageFromDataUrl(backDataUrl);

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

    if (window.PRIMedia?.compressCanvasToDataUrl) {
        const result = await window.PRIMedia.compressCanvasToDataUrl(canvas, {
            ...CONFIG.MEDIA,
            maxBytes: CONFIG.EXTRACTION.compositeMaxBytes,
            maxWidth: CONFIG.EXTRACTION.compositeMaxWidth,
            maxHeight: 1800,
            startQuality: CONFIG.EXTRACTION.compositeQuality,
            minQuality: 0.52,
            label: "composite",
        });

        log("Imagen compuesta comprimida:", {
            mime: result.mime,
            extension: result.extension,
            sizeKB: result.sizeKB,
            width: result.width,
            height: result.height,
        });

        return result.dataUrl;
    }

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
    console.log("Payload preview:", previewPayload(payload));
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
    } catch (err) {
        throw new Error("Error de conexión con el endpoint de OpenAI: " + err.message);
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

        hideCaptureModalWithoutReset();
        openReviewModal(payload);
    } catch (err) {
        console.error("[RED Home Modals] Error OpenAI:", err);

        toast(
            err?.message || "No se pudo procesar la identificación.",
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

function nullableString(value) {
    const clean = normalizeValue(value);
    return clean || null;
}

function nullableNumber(value) {
    const clean = onlyDigits(value);
    if (!clean) return null;

    const number = Number(clean);
    return Number.isFinite(number) && number > 0 ? number : null;
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

function getTodayDateTimeForMysql() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
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

        idmex: cleanUpper(findExtractedValue(fields, [
            "idmex",
            "id_mex",
            "id_mexico",
            "idméx",
        ])).replace(/[^A-Z0-9]/g, ""),

        ocr: cleanUpper(findExtractedValue(fields, [
            "ocr",
            "numero_ocr",
            "ocr_number",
        ])).replace(/[^A-Z0-9]/g, ""),

        cic: cleanUpper(findExtractedValue(fields, [
            "cic",
            "numero_cic",
            "cic_number",
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













































/* -------------------------------------------------------------------------- */
/* MODAL REVISIÓN                                                              */
/* -------------------------------------------------------------------------- */

function fillReviewForm(persona) {
    setFieldValue("#ine-review-fecha-extraccion", getTodayLongEs());

    setFieldValue("#ine-review-nombres", persona.nombres);
    setFieldValue("#ine-review-apellido-paterno", persona.apellido_paterno);
    setFieldValue("#ine-review-apellido-materno", persona.apellido_materno);
    setFieldValue("#ine-review-fecha-nacimiento", persona.fecha_nacimiento);
    setFieldValue("#ine-review-sexo", persona.sexo);

    setFieldValue("#ine-review-curp", persona.curp);
    setFieldValue("#ine-review-clave-elector", persona.clave_elector);
    setFieldValue("#ine-review-idmex", persona.idmex);
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

function resetReviewModalForCapture() {
    const modal = $(SEL.reviewModal);
    const form = $(SEL.reviewForm);

    if (!modal || !form) return;

    modal.dataset.mode = "capture";
    form.classList.remove("is-readonly");

    form.querySelectorAll("input, textarea").forEach((field) => {
        field.readOnly = false;
    });

    form.querySelectorAll("select").forEach((field) => {
        field.disabled = false;
    });

    const saveBtn = $("#ine-modal-affiliate");
    const reprocessBtn = $(SEL.btnReprocess);
    const cancelBtn = form.querySelector("[data-ine-review-close]");
    const title = $("#ine-review-title");
    const kicker = $(".ine-review-kicker");
    const warning = $(".ine-review-warning");

    if (saveBtn) saveBtn.hidden = false;
    if (reprocessBtn) reprocessBtn.hidden = false;
    if (cancelBtn) cancelBtn.textContent = "Cancelar";

    if (kicker) kicker.textContent = "Datos extraídos";
    if (title) title.textContent = "Revisión de información INE";

    if (warning) {
        warning.innerHTML = `
      <strong>Importante: La información fue extraída automáticamente.</strong>
      Valide esta información comparando contra el documento INE,
      realice los ajustes que sean necesarios y guarde el registro.
    `;
    }
}

function paintReviewImages(payload) {
    const front = $(SEL.reviewFront);
    const back = $(SEL.reviewBack);

    if (front && payload?.images?.front) {
        front.src = getCaptureDataUrl(payload.images.front);
    }

    if (back && payload?.images?.back) {
        back.src = getCaptureDataUrl(payload.images.back);
    }
}

function openReviewModal(payload) {
    const modal = $(SEL.reviewModal);

    if (!modal) {
        warn("No existe #ine-review-modal en esta vista.");
        console.log("Payload listo para review:", payload);
        return;
    }

    resetReviewModalForCapture();
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
        idmex: getFieldValue("#ine-review-idmex"),
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

/* -------------------------------------------------------------------------- */
/* HASH / PAYLOADS GUARDADO                                                    */
/* -------------------------------------------------------------------------- */

async function sha256Hex(value) {
    const clean = normalizeValue(value);
    if (!clean) return null;

    if (!window.crypto?.subtle) {
        warn("crypto.subtle no está disponible. No se pudo generar hash.");
        return null;
    }

    const encoded = new TextEncoder().encode(clean);
    const buffer = await crypto.subtle.digest("SHA-256", encoded);

    return Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function buildPersonaInsertPayload(payload) {
    const usuarioId = getUsuarioId();

    const personaPayload = {
        nombres: cleanUpper(payload.nombres),
        apellido_paterno: nullableString(cleanUpper(payload.apellido_paterno)),
        apellido_materno: nullableString(cleanUpper(payload.apellido_materno)),
        fecha_nacimiento: nullableString(payload.fecha_nacimiento),
        sexo: nullableString(normalizeSex(payload.sexo)),

        curp: nullableString(cleanUpper(payload.curp).replace(/[^A-Z0-9]/g, "")),
        clave_elector: nullableString(cleanUpper(payload.clave_elector).replace(/[^A-Z0-9]/g, "")),
        idmex_hash: await sha256Hex(cleanUpper(payload.idmex).replace(/[^A-Z0-9]/g, "")),

        seccion_id: nullableNumber(payload.seccion_id),
        anio_registro: nullableNumber(payload.anio_registro),
        emision: nullableNumber(payload.emision),
        vigencia_inicio: nullableString(payload.vigencia_inicio),
        vigencia_fin: nullableString(payload.vigencia_fin),

        domicilio_texto: nullableString(cleanUpper(payload.domicilio_texto)),

        telefono: nullableString(payload.telefono),
        whatsapp: nullableString(payload.whatsapp),
        email: nullableString(payload.email),

        acepta_tratamiento_datos: Number(payload.acepta_tratamiento_datos) === 1 ? 1 : 0,
        acepta_contacto_whatsapp: Number(payload.acepta_contacto_whatsapp) === 1 ? 1 : 0,
        acepta_datos_sensibles: Number(payload.acepta_tratamiento_datos) === 1 ? 1 : 0,
        aviso_privacidad_version: CONFIG.SAVE.avisoPrivacidadVersion,
        fecha_consentimiento: Number(payload.acepta_tratamiento_datos) === 1 ? getTodayDateTimeForMysql() : null,

        estatus_id: CONFIG.SAVE.estatusIdDefault,
        capturado_por: usuarioId || null,
        created_by: usuarioId || null,

        observaciones: nullableString(payload.observaciones),
    };

    Object.keys(personaPayload).forEach((key) => {
        if (personaPayload[key] === null || personaPayload[key] === "") {
            delete personaPayload[key];
        }
    });

    return personaPayload;
}

function buildArchivoInsertPayload({ personaId, side, capture, usuarioId }) {
    const usoArchivo = side === "front" ? "INE_FRENTE" : "INE_REVERSO";
    const suffix = side === "front" ? "frente" : "reverso";
    const normalizedCapture = normalizeCaptureObject(capture);
    const extension = normalizedCapture?.extension || "jpg";
    const mime = normalizedCapture?.mime || "image/jpeg";
    const timestamp = Date.now();

    return {
        entidad_tipo: "PERSONA",
        entidad_id: Number(personaId),
        uso_archivo: usoArchivo,

        nombre_original: `ine_${suffix}.${extension}`,
        nombre_storage: `persona_${personaId}_ine_${suffix}_${timestamp}.${extension}`,

        url_archivo: normalizedCapture?.dataUrl || "",
        mime_type: mime,
        extension,
        tamano_bytes: normalizedCapture?.sizeBytes || null,

        version_no: 1,
        es_actual: 1,
        privado: 1,

        uploaded_by: usuarioId || null,
        updated_by: usuarioId || null,
    };
}

function validateReviewPayload(payload) {
    if (!payload.nombres) {
        toast("El campo Nombre es obligatorio.", "error", 5000);
        return false;
    }

    if (!payload.curp) {
        toast("El campo CURP es obligatorio.", "error", 5000);
        return false;
    }

    if (!payload.clave_elector) {
        toast("El campo Clave de elector es obligatorio.", "error", 5000);
        return false;
    }

    if (!payload.seccion_id) {
        return true;
    }

    if (!State.captures.front || !State.captures.back) {
        toast("Faltan las fotos de frente y reverso de la INE.", "error", 5000);
        return false;
    }

    return true;
}

async function savePersonaAndFiles(payload) {
    const reviewModal = $(SEL.reviewModal);
    const originalPayload = reviewModal?.__inePayload || null;
    const usuarioId = getUsuarioId();

    const personaPayload = await buildPersonaInsertPayload(payload);

    log("Payload persona listo:", personaPayload);

    const personaResponse = await postJSON(ENDPOINTS.insertPersona, personaPayload);
    const persona = personaResponse.data || null;
    const personaId = Number(persona?.persona_id || 0);

    if (!personaId) {
        throw new Error("La persona fue creada, pero no se recibió persona_id.");
    }

    const captures = {
        front: originalPayload?.images?.front || State.captures.front,
        back: originalPayload?.images?.back || State.captures.back,
    };

    const archivoPayloads = [
        buildArchivoInsertPayload({
            personaId,
            side: "front",
            capture: captures.front,
            usuarioId,
        }),
        buildArchivoInsertPayload({
            personaId,
            side: "back",
            capture: captures.back,
            usuarioId,
        }),
    ];

    const archivos = [];
    const erroresArchivo = [];

    for (const archivoPayload of archivoPayloads) {
        try {
            const archivoResponse = await postJSON(ENDPOINTS.insertArchivo, archivoPayload);
            archivos.push(archivoResponse.data || null);
        } catch (err) {
            erroresArchivo.push({
                uso_archivo: archivoPayload.uso_archivo,
                error: err?.message || "No se pudo registrar archivo.",
            });

            error(`No se pudo registrar ${archivoPayload.uso_archivo}:`, err);
        }
    }

    const saved = {
        persona,
        archivos: archivos.filter(Boolean),
        erroresArchivo,
        extraction: originalPayload?.extraction || null,
        fields: originalPayload?.fields || [],
    };

    document.dispatchEvent(
        new CustomEvent("red:persona-saved", {
            detail: saved,
        })
    );

    return saved;
}

async function shouldOpenResidenceModalBeforeSave(payload) {
    await loadTerritoriosCatalog();

    const currentSeccion = String(payload?.seccion_id || "").trim();

    if (!currentSeccion) {
        return true;
    }

    const found = findSeccionByInput(currentSeccion);

    if (!found) {
        return true;
    }

    // Si el usuario capturó el código de sección, lo convertimos a territorio_id.
    // Esto evita enviar "1593" cuando el backend necesita "78".
    if (String(found.territorio_id || "") !== currentSeccion) {
        setFieldValue("#ine-review-seccion", found.territorio_id);
        payload.seccion_id = String(found.territorio_id);
    }

    return false;
}

async function handleReviewSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitBtn = form?.querySelector('[type="submit"]');

    const payload = collectReviewPayload();

    if (!validateReviewPayload(payload)) return;

    const isContinuingFromResidenceModal = Boolean(State.pendingReviewSubmit);

    if (!isContinuingFromResidenceModal) {
        const needsResidenceModal = await shouldOpenResidenceModalBeforeSave(payload);

        if (needsResidenceModal) {
            await openResidenceModal(payload);
            return;
        }
    }

    State.pendingReviewSubmit = null;

    const reviewModal = $(SEL.reviewModal);
    const originalText = submitBtn?.textContent || "Guardar persona";

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Guardando...";
    }

    try {
        const saved = await savePersonaAndFiles(payload);

        if (reviewModal) {
            reviewModal.__ineSavedPayload = saved;
        }

        log("Persona guardada en backend:", saved);

        if (saved.erroresArchivo.length) {
            toast("Persona guardada, pero una o más fotos no pudieron registrarse.", "warning", 7000);
        } else {
            toast("Persona y fotos de INE guardadas correctamente.", "exito", 5000);
        }

        closeReviewModal();
        resetCaptureFlow();

        if (CONFIG.SAVE.reloadPageAfterSave) {
            window.setTimeout(() => {
                window.location.reload();
            }, CONFIG.SAVE.reloadDelayMs);
        }
    } catch (err) {
        console.error("[RED Home Modals] Error guardando persona real:", err);
        toast(err?.message || "No se pudo guardar la persona.", "error", 8000);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
}

function bindResidenceModalEvents() {
    $$(SEL.residenceClose).forEach((btn) => {
        btn.addEventListener("click", closeResidenceModal);
    });

    $(SEL.residenceYes)?.addEventListener("click", () => {
        enableResidenceFields();
    });

    $(SEL.residenceNo)?.addEventListener("click", () => {
        closeResidenceModal();
        toast(
            "Solo se pueden dar de alta ciudadanos de Ixtlahuacán de los Membrillos.",
            "warning",
            6000
        );
    });

    $(SEL.residenceSeccionToggle)?.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleResidenceSeccionList();
    });

    document.addEventListener("click", (event) => {
        const combo = event.target.closest(".red-residence-field--combo");
        if (!combo) closeResidenceSeccionList();
    });

    $(SEL.residenceForm)?.addEventListener("submit", async (event) => {
        event.preventDefault();

        const seccion = getFieldValue(SEL.residenceSeccion);
        const domicilio = getFieldValue(SEL.residenceDomicilio);
        const telefono = getFieldValue(SEL.residenceTelefono);

        if (!seccion) {
            toast("Selecciona una sección.", "warning", 4500);
            return;
        }

        if (!domicilio) {
            toast("Captura la calle actual de residencia.", "warning", 4500);
            return;
        }

        if (!telefono) {
            toast("Captura el método de contacto.", "warning", 4500);
            return;
        }

        setFieldValue("#ine-review-seccion", seccion);
        setFieldValue("#ine-review-domicilio", domicilio);
        setFieldValue("#ine-review-telefono", telefono);

        closeResidenceModal({ clearPending: false });

        const form = $(SEL.reviewForm);
        if (form) {
            form.requestSubmit();
        }
    });
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

    readSession();
    resetCaptureFlow();
    setModalOpen(true);

    await startCamera();
}

function hideCaptureModalWithoutReset() {
    log("Ocultando modal captura INE sin limpiar capturas.");

    stopCamera();
    setModalOpen(false);
}

function closeCaptureModal() {
    log("Cerrando modal captura INE.");

    stopCamera();
    setModalOpen(false);
    resetCaptureFlow();
}

function handleEscape(event) {
    if (event.key !== "Escape") return;

    const residenceModal = $(SEL.residenceModal);
    if (residenceModal && !residenceModal.hidden) {
        closeResidenceModal();
        return;
    }

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
    bindResidenceModalEvents();
}

function init() {
    const modal = $(SEL.modal);

    if (!modal) {
        warn("No existe #ine-capture-modal en esta vista.");
        return;
    }

    readSession();
    bindCaptureModalEvents();

    log("home.modals.js inicializado.");
}

document.addEventListener("DOMContentLoaded", init);
