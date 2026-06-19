"use strict";

import { Session } from "/PRI/JS/auth/session.js";
import { getDeviceContext } from "/PRI/JS/ui/deviceContext.js";

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
        personaEstatusIdCapturado: 1,
        avisoPrivacidadVersion: "RED-INE-2026-01",
        reloadPageAfterSave: false,
        reloadDelayMs: 900,
    },
};

const ENDPOINTS = {
    extractOpenAI: "/PRI/extract_identificacion_openai.php",
    insertPersona: "/PRI/db/WEB/ixtla_i_persona.php",
    insertArchivo: "/PRI/db/WEB/ixtla_i_archivo.php",
    personas: "/PRI/db/WEB/ixtla_c_persona.php",
    territorios: "/PRI/db/WEB/ixtla_c_territorio.php",
    usuarios: "/PRI/db/WEB/ixtla_c_usuario.php",
    updatePersona: "/PRI/db/WEB/ixtla_u_persona.php",
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
    usuariosById: new Map(),
    pendingReviewSubmit: null,
    pendingDuplicateUpdate: null,
    residenceContext: null,

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

    btnUseCamera: "#ine-btn-use-camera",
    btnUseUpload: "#ine-btn-use-upload",

    uploadFront: "#ine-upload-front",
    uploadBack: "#ine-upload-back",
    uploadPreviewFront: "#ine-upload-preview-front",
    uploadPreviewBack: "#ine-upload-preview-back",
    btnUploadBack: "#ine-btn-upload-back",
    btnUploadContinue: "#ine-btn-upload-continue",

    previewFront: "#ine-preview-front",
    previewBack: "#ine-preview-back",

    reviewModal: "#ine-review-modal",
    reviewClose: "[data-ine-review-close]",
    reviewForm: "#ine-review-form",
    btnReprocess: "#ine-btn-reprocess",

    reviewFront: "#ine-review-front",
    reviewBack: "#ine-review-back",
    reviewSeccionToggle: "#ine-review-seccion-toggle",
    reviewSeccionText: "#ine-review-seccion-text",
    reviewSeccionList: "#ine-review-seccion-list",

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

    duplicateModal: "#red-duplicate-modal",
    duplicateClose: "[data-red-duplicate-close]",
    duplicateUpdate: "#red-duplicate-update",
    duplicateTitle: "#red-duplicate-title",
    duplicateMessage: "#red-duplicate-message",
    duplicatePerson: "#red-duplicate-person",
    duplicateOwner: "#red-duplicate-owner",

    validationModal: "#red-validation-modal",
    validationClose: "[data-red-validation-close]",
    validationTitle: "#red-validation-title",
    validationMessage: "#red-validation-message",
    validationRecapture: "#red-validation-recapture",
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
    const duplicateModal = $(SEL.duplicateModal);
    const validationModal = $(SEL.validationModal);

    const captureOpen = Boolean(captureModal && !captureModal.hidden);
    const reviewOpen = Boolean(reviewModal && !reviewModal.hidden);
    const residenceOpen = Boolean(residenceModal && !residenceModal.hidden);
    const duplicateOpen = Boolean(duplicateModal && !duplicateModal.hidden);
    const validationOpen = Boolean(validationModal && !validationModal.hidden);

    document.body.classList.toggle(
        "ine-modal-open",
        captureOpen || reviewOpen || residenceOpen || duplicateOpen || validationOpen
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

    clearUploadInputs();
    showScreen("method");
}

function lockCaptureButton(isLocked, text = "Capturar") {
    const btnCapture = $(SEL.btnCapture);
    if (!btnCapture) return;

    btnCapture.disabled = Boolean(isLocked);
    btnCapture.textContent = text;
}

async function openPreferredCaptureMethod() {
    const device = getDeviceContext();


    if (device.preferUpload) {
        showScreen("upload");
        return;
    }


    if (device.preferCamera) {
        prepareCaptureStep("front");
        await startCamera();
        return;
    }

    showScreen("method");
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("No se pudo leer la imagen seleccionada."));

        reader.readAsDataURL(file);
    });
}

function dataUrlToCanvas(dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;

            const ctx = canvas.getContext("2d", { alpha: false });

            if (!ctx) {
                reject(new Error("No se pudo preparar la imagen."));
                return;
            }

            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);

            resolve(canvas);
        };

        img.onerror = () => reject(new Error("La imagen seleccionada no se pudo cargar."));
        img.src = dataUrl;
    });
}

function syncUploadContinueButton() {
    const btn = $(SEL.btnUploadContinue);
    if (!btn) return;

    btn.disabled = !(State.captures.front && State.captures.back);
}

function clearUploadInputs() {
    const inputFront = $(SEL.uploadFront);
    const inputBack = $(SEL.uploadBack);
    const previewFront = $(SEL.uploadPreviewFront);
    const previewBack = $(SEL.uploadPreviewBack);

    if (inputFront) inputFront.value = "";
    if (inputBack) inputBack.value = "";

    if (previewFront) {
        previewFront.removeAttribute("src");
        previewFront.hidden = true;
    }

    if (previewBack) {
        previewBack.removeAttribute("src");
        previewBack.hidden = true;
    }

    syncUploadContinueButton();
}

async function handleUploadFile(side, file) {
    if (!file) return;

    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
        toast("Solo se permiten imágenes JPG, PNG o WEBP.", "warning", 5000);
        return;
    }

    try {
        const dataUrl = await fileToDataUrl(file);
        const canvas = await dataUrlToCanvas(dataUrl);

        const capture = await compressCanvasCapture(canvas, {
            ...CONFIG.MEDIA,
            label: `upload-${side}`,
        });

        State.captures[side] = normalizeCaptureObject(capture);

        const previewSelector = side === "front"
            ? SEL.uploadPreviewFront
            : SEL.uploadPreviewBack;

        const preview = $(previewSelector);

        if (preview) {
            preview.src = getCaptureDataUrl(State.captures[side]);
            preview.hidden = false;
        }

        syncUploadContinueButton();

        toast(
            side === "front"
                ? "Frente cargado correctamente."
                : "Reverso cargado correctamente.",
            "exito",
            3000
        );
    } catch (err) {
        console.error("[RED upload INE error]", err);
        toast(err?.message || "No se pudo cargar la imagen.", "error", 6000);
    }
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
        const msg = data?.error || data?.message || `Error HTTP ${status}`;

        const debugError = new Error(msg);
        debugError.status = status;
        debugError.response = data;
        debugError.raw = raw;

        throw debugError;
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

function getSeccionCodeLabel(item) {
    return String(
        item?.nombre ||
        // item?.codigo || esto es para mostrar el codigo en vez del nombre
        item?.territorio_id ||
        "S/C"
    ).trim();
}

function syncComboSelection(list, value) {
    if (!list) return;

    list.querySelectorAll(".red-residence-combo-option").forEach((btn) => {
        const selected = btn.dataset.value === String(value || "");
        btn.classList.toggle("is-selected", selected);
        btn.setAttribute("aria-selected", selected ? "true" : "false");
    });
}

function paintReviewSecciones(selectedValue = "") {
    const input = $("#ine-review-seccion");
    const text = $(SEL.reviewSeccionText);
    const list = $(SEL.reviewSeccionList);

    if (!input || !text || !list) return;

    const cleanSelected = String(selectedValue || "").trim();
    const selectedItem = findSeccionByInput(cleanSelected);

    input.value = selectedItem ? String(selectedItem.territorio_id || "") : "";
    text.textContent = selectedItem
        ? getSeccionCodeLabel(selectedItem)
        : cleanSelected || "Selecciona una sección";
    list.innerHTML = "";

    State.secciones.forEach((item) => {
        const option = document.createElement("button");
        option.type = "button";
        option.className = "red-residence-combo-option";
        option.role = "option";

        const value = String(item.territorio_id || "");
        const label = getSeccionCodeLabel(item);

        option.dataset.value = value;
        option.dataset.label = label;
        option.textContent = label;

        const isSelected = selectedItem && value === String(selectedItem.territorio_id || "");
        option.classList.toggle("is-selected", Boolean(isSelected));
        option.setAttribute("aria-selected", isSelected ? "true" : "false");

        option.addEventListener("click", () => {
            selectReviewSeccion(value, label);
            closeReviewSeccionList();
        });

        list.appendChild(option);
    });
}

async function syncReviewSeccionField(selectedValue = "") {
    await loadTerritoriosCatalog();
    paintReviewSecciones(selectedValue);
}

function selectReviewSeccion(value, label) {
    const input = $("#ine-review-seccion");
    const text = $(SEL.reviewSeccionText);
    const list = $(SEL.reviewSeccionList);

    if (input) input.value = String(value || "").trim();
    if (text) text.textContent = label || "Selecciona una sección";

    syncComboSelection(list, value);
}

function openReviewSeccionList() {
    const toggle = $(SEL.reviewSeccionToggle);
    const list = $(SEL.reviewSeccionList);

    if (!toggle || !list || toggle.disabled) return;

    list.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
}

function closeReviewSeccionList() {
    const toggle = $(SEL.reviewSeccionToggle);
    const list = $(SEL.reviewSeccionList);

    if (!toggle || !list) return;

    list.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
}

function toggleReviewSeccionList() {
    const list = $(SEL.reviewSeccionList);
    if (!list) return;

    if (list.hidden) {
        openReviewSeccionList();
    } else {
        closeReviewSeccionList();
    }
}

function paintResidenceSeccionesLegacy(selectedValue = "") {
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

function selectResidenceSeccionLegacy(value, label) {
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
        const label = getSeccionCodeLabel(item);

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

    syncComboSelection(list, value);
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

async function openResidenceModal(pendingPayload, context = "save") {
    State.pendingReviewSubmit = pendingPayload || null;
    State.residenceContext = context;

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

function getDuplicateDataFromError(err) {
    const response = err?.response || null;

    if (!response || response.duplicate !== true) {
        return null;
    }

    return {
        duplicate: true,
        duplicateField: response.duplicate_field || "",
        duplicateLabel: response.duplicate_label || "dato",
        existingPersona: response.existing_persona || null,
        message: response.message || response.error || "La persona ya se encuentra registrada.",
        raw: response,
    };
}

// bandera para pablo
function getDuplicateOwnerLabel(existingPersona) {
    const owner = existingPersona?.capturado_por_usuario || null;

    if (!owner) {
        return "un usuario del sistema";
    }

    const username = owner.username || owner.usuario_id || existingPersona?.capturado_por || "";
    const nombre = owner.nombre_completo || owner.nombre || "";

    if (username && nombre) {
        return `${username} - ${nombre}`;
    }

    return nombre || username || "un usuario del sistema";
}

function canCurrentUserUpdateDuplicate(existingPersona) {
    const currentUserId = getUsuarioId();
    const ownerUserId = Number(
        existingPersona?.capturado_por_usuario?.usuario_id ||
        existingPersona?.capturado_por ||
        0
    );

    return currentUserId > 0 && ownerUserId > 0 && currentUserId === ownerUserId;
}

function buildDuplicateDataFromPersona(existingPersona, duplicateField, duplicateLabel) {
    if (!existingPersona?.persona_id) {
        return null;
    }

    return {
        duplicate: true,
        duplicateField: duplicateField || "",
        duplicateLabel: duplicateLabel || "dato",
        existingPersona,
        message: `La persona ya se encuentra registrada por ${duplicateLabel || "dato"}.`,
        raw: {
            duplicate: true,
            duplicate_field: duplicateField || "",
            duplicate_label: duplicateLabel || "dato",
            existing_persona: existingPersona,
        },
    };
}

function formatAuditUserLabel(value, fallback = "Sin dato") {
    const userId = Number(value || 0);
    return userId > 0 ? `Usuario ID ${userId}` : fallback;
}

async function loadUsuarioNombreById(usuarioId) {
    const id = Number(usuarioId || 0);
    if (id <= 0) return "";

    if (State.usuariosById.has(id)) {
        return await State.usuariosById.get(id);
    }

    const pending = postJSON(ENDPOINTS.usuarios, { usuario_id: id })
        .then((out) => String(out?.data?.nombre_completo || "").trim())
        .catch((err) => {
            State.usuariosById.delete(id);
            throw err;
        });

    State.usuariosById.set(id, pending);

    const nombre = await pending;
    State.usuariosById.set(id, Promise.resolve(nombre));

    return nombre;
}

async function hydrateDuplicateAuditFields(existingPersona) {
    if (!existingPersona) return;

    setFieldValue(
        "#ine-review-fecha-extraccion",
        existingPersona?.fecha_captura || ""
    );

    setFieldValue(
        "#ine-review-capturado-por",
        formatAuditUserLabel(
            existingPersona?.capturado_por,
            "Sin capturador registrado"
        )
    );

    setFieldValue(
        "#ine-review-updated-by",
        formatAuditUserLabel(
            existingPersona?.updated_by,
            "Este registro aún no ha sido editado"
        )
    );

    try {
        const capturadoPorId = Number(existingPersona?.capturado_por || 0);
        if (capturadoPorId > 0) {
            const nombreCapturador = await loadUsuarioNombreById(capturadoPorId);
            if (nombreCapturador) {
                setFieldValue("#ine-review-capturado-por", nombreCapturador);
            }
        }
    } catch (err) {
        warn("No se pudo resolver capturado_por en duplicado:", err);
    }

    try {
        const updatedById = Number(existingPersona?.updated_by || 0);
        if (updatedById > 0) {
            const nombreEditor = await loadUsuarioNombreById(updatedById);
            if (nombreEditor) {
                setFieldValue("#ine-review-updated-by", nombreEditor);
            }
        }
    } catch (err) {
        warn("No se pudo resolver updated_by en duplicado:", err);
    }
}

async function findDuplicatePersonaBeforeSave(payload) {
    const curp = cleanUpper(payload?.curp || "").replace(/[^A-Z0-9]/g, "");
    const claveElector = cleanUpper(payload?.clave_elector || "").replace(/[^A-Z0-9]/g, "");

    if (curp) {
        try {
            const out = await postJSON(ENDPOINTS.personas, {
                curp,
                page: 1,
                page_size: 1,
            });

            const existingPersona = Array.isArray(out?.data) ? out.data[0] || null : null;
            const duplicateData = buildDuplicateDataFromPersona(existingPersona, "curp_hash", "CURP");
            if (duplicateData) return duplicateData;
        } catch (err) {
            if (err?.status !== 404) {
                warn("No se pudo consultar duplicado por CURP:", err);
            }
        }
    }

    if (claveElector) {
        try {
            const out = await postJSON(ENDPOINTS.personas, {
                clave_elector: claveElector,
                page: 1,
                page_size: 1,
            });

            const existingPersona = Array.isArray(out?.data) ? out.data[0] || null : null;
            const duplicateData = buildDuplicateDataFromPersona(existingPersona, "clave_elector_hash", "Clave de elector");
            if (duplicateData) return duplicateData;
        } catch (err) {
            if (err?.status !== 404) {
                warn("No se pudo consultar duplicado por clave de elector:", err);
            }
        }
    }

    return null;
}

function syncReviewPrimaryAction(duplicateData = null) {
    const reviewModal = $(SEL.reviewModal);
    const saveBtn = $("#ine-modal-affiliate");

    if (reviewModal) {
        reviewModal.__precheckedDuplicateData = duplicateData || null;
    }

    if (!saveBtn) return;

    if (!duplicateData?.duplicate) {
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar persona";
        return;
    }

    const canUpdate = canCurrentUserUpdateDuplicate(duplicateData.existingPersona || null);

    saveBtn.textContent = "Actualizar persona";
    saveBtn.disabled = !canUpdate;

    hydrateDuplicateAuditFields(duplicateData.existingPersona || null);
}

async function runDuplicateUpdate(duplicateData, btn = null) {
    const originalText = btn?.textContent || "Actualizar datos";

    if (!duplicateData?.existingPersona?.persona_id) {
        toast("No se encontró la persona existente para actualizar.", "error", 7000);
        return;
    }

    try {
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Actualizando...";
        }

        const saved = await updateDuplicatePersonaAndFiles(duplicateData);

        console.log("[RED duplicate updated]", saved);

        if (saved.erroresArchivo.length) {
            toast("Datos actualizados, pero una o más fotos no pudieron registrarse.", "warning", 7000);
        } else {
            toast("Datos y fotos actualizados correctamente.", "exito", 6000);
        }

        closeDuplicateModal();
        closeReviewModal();
        resetCaptureFlow();

        if (CONFIG.SAVE.reloadPageAfterSave) {
            window.setTimeout(() => {
                window.location.reload();
            }, CONFIG.SAVE.reloadDelayMs);
        }
    } catch (err) {
        console.error("[RED duplicate update error]", err);
        toast(err?.message || "No se pudieron actualizar los datos.", "error", 9000);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    }
}

async function handleDuplicateUpdateRequest(duplicateData, btn = null) {
    const existingPersona = duplicateData?.existingPersona || null;

    if (!canCurrentUserUpdateDuplicate(existingPersona)) {
        closeDuplicateModal({ closeReview: true, warnLocked: true });
        toast(
            "Solo el usuario que capturó originalmente este registro puede actualizarlo.",
            "warning",
            7000
        );
        return;
    }

    const payload = collectReviewPayload();

    if (!validateReviewPayload(payload)) return;

    const needsResidenceModal = await shouldOpenResidenceModalBeforeSave(payload);

    if (needsResidenceModal) {
        State.pendingDuplicateUpdate = duplicateData;
        closeDuplicateModal();
        await openResidenceModal(payload, "duplicate");
        return;
    }

    await runDuplicateUpdate(duplicateData, btn);
}

function ensureDuplicateModal() {
    const modal = $(SEL.duplicateModal);

    if (!modal) {
        warn("No existe #red-duplicate-modal en el HTML.");
        return null;
    }

    if (modal.dataset.bound === "1") {
        return modal;
    }

    modal.querySelectorAll(SEL.duplicateClose).forEach((btn) => {
        btn.addEventListener("click", () => {
            const isLocked = Boolean(modal.__duplicateLocked);
            closeDuplicateModal({
                closeReview: isLocked,
                warnLocked: isLocked,
            });
        });
    });

    modal.querySelector(SEL.duplicateUpdate)?.addEventListener("click", async () => {
        const duplicateData = modal.__duplicateData || null;
        const btn = modal.querySelector(SEL.duplicateUpdate);

        await handleDuplicateUpdateRequest(duplicateData, btn);
    });

    modal.dataset.bound = "1";

    return modal;
}

function setDuplicateModalOpen(isOpen) {
    const modal = ensureDuplicateModal();

    if (!modal) return;

    modal.hidden = !isOpen;
    modal.setAttribute("aria-hidden", isOpen ? "false" : "true");

    syncBodyModalState();
}

function openDuplicateModal(duplicateData) {
    const modal = ensureDuplicateModal();

    if (!modal) {
        toast("La persona ya se encuentra registrada.", "warning", 6500);
        return;
    }

    const existingPersona = duplicateData?.existingPersona || null;
    const nombrePersona =
        existingPersona?.nombre_completo ||
        existingPersona?.nombres ||
        "Esta persona";

    const ownerLabel = getDuplicateOwnerLabel(existingPersona);
    const canUpdate = canCurrentUserUpdateDuplicate(existingPersona);

    modal.__duplicateData = duplicateData;
    modal.__duplicateLocked = !canUpdate;

    const title = modal.querySelector(SEL.duplicateTitle);
    const message = modal.querySelector(SEL.duplicateMessage);
    const person = modal.querySelector(SEL.duplicatePerson);
    const owner = modal.querySelector(SEL.duplicateOwner);
    const updateBtn = modal.querySelector(SEL.duplicateUpdate);

    if (title) {
        title.textContent = "Persona ya registrada";
    }

    if (message) {
        message.innerHTML = `
            Este simpatizante ya ha sido registrado<br>
            por el afiliado <strong>(${escapeHTMLSafe(ownerLabel)})</strong>
        `;
    }

    if (person) {
        person.textContent = `(${nombrePersona})`;
    }

    if (owner) {
        owner.textContent = canUpdate
            ? ""
            : "Solo el usuario capturador puede actualizar este registro.";
    }

    if (updateBtn) {
        updateBtn.disabled = !canUpdate;
        updateBtn.title = canUpdate
            ? "Actualizar datos de la persona"
            : "Solo el capturador original puede actualizar este registro";
    }

    setDuplicateModalOpen(true);

    console.log("[RED duplicate persona]", duplicateData);
}

function closeDuplicateModal({ closeReview = false, warnLocked = false } = {}) {
    const modal = $(SEL.duplicateModal);
    if (!modal) return;

    const shouldWarnLockedClose = Boolean(modal.__duplicateLocked) && warnLocked;

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.__duplicateData = null;
    modal.__duplicateLocked = false;

    syncBodyModalState();

    if (closeReview) {
        closeReviewModal();
    }

    if (shouldWarnLockedClose) {
        toast(
            "Solo el usuario que capturó puede actualizar esta persona.",
            "warning",
            7000
        );
    }
}

function ensureValidationModal() {
    const modal = $(SEL.validationModal);

    if (!modal) {
        warn("No existe #red-validation-modal en el HTML.");
        return null;
    }

    if (modal.dataset.bound === "1") {
        return modal;
    }

    modal.querySelectorAll(SEL.validationClose).forEach((btn) => {
        btn.addEventListener("click", async () => {
            await abortValidationFlow();
        });
    });

    modal.querySelector(SEL.validationRecapture)?.addEventListener("click", async () => {
        await restartCaptureFromValidation();
    });

    modal.dataset.bound = "1";

    return modal;
}

function setValidationModalOpen(isOpen) {
    const modal = ensureValidationModal();

    if (!modal) return;

    modal.hidden = !isOpen;
    modal.setAttribute("aria-hidden", isOpen ? "false" : "true");

    syncBodyModalState();
}

function openValidationModal({
    title = "No pudimos validar los datos",
    message = "Verifica la captura e inténtalo nuevamente.",
} = {}) {
    const modal = ensureValidationModal();
    if (!modal) return;

    const titleEl = modal.querySelector(SEL.validationTitle);
    const messageEl = modal.querySelector(SEL.validationMessage);

    if (titleEl) {
        titleEl.textContent = title;
    }

    if (messageEl) {
        messageEl.textContent = message;
    }

    setValidationModalOpen(true);
}

function closeValidationModal() {
    const modal = $(SEL.validationModal);
    if (!modal) return;

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");

    syncBodyModalState();
}

async function abortValidationFlow() {
    closeValidationModal();
    closeDuplicateModal();
    closeResidenceModal({ clearPending: true });
    closeReviewModal();
    closeCaptureModal();
}

async function restartCaptureFromValidation() {
    closeValidationModal();
    closeDuplicateModal();
    closeResidenceModal({ clearPending: true });
    closeReviewModal();
    resetCaptureFlow();
    setModalOpen(true);
    await openPreferredCaptureMethod();
}

function normalizeCurp(value) {
    return cleanUpper(value).replace(/[^A-Z0-9]/g, "");
}

function normalizeClaveElector(value) {
    return cleanUpper(value).replace(/[^A-Z0-9]/g, "");
}

function isValidCurp(value) {
    const curp = normalizeCurp(value);
    const curpPattern =
        /^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]\d$/;

    return curpPattern.test(curp);
}

function isValidClaveElector(value) {
    const clave = normalizeClaveElector(value);
    const clavePattern = /^[A-Z]{6}\d{8}[A-Z]\d{3}$/;

    return clavePattern.test(clave);
}

function escapeHTMLSafe(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
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
        await openReviewModal(payload);
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

function normalizeEmision(value) {
    const clean = onlyDigits(value);

    if (!clean) return "";

    return clean.slice(0, 2).padStart(2, "0");
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

        emision: normalizeEmision(findExtractedValue(fields, [
            "emision",
            "emisión",
            "numero_emision",
            "número_emisión",
            "num_emision",
            "emission",
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

function setReviewCreateAdminbar() {
    const adminbar = $("#ine-review-adminbar");
    const statusField = $(".ine-review-status-field");
    const estatusSelect = $("#ine-review-estatus");
    const afiliadoInput = $("#ine-review-es-afiliado");
    const saveStatusBtn = $("#ine-review-save-status");

    /*
      Alta nueva desde INE:
      - Sí mostramos adminbar para que aparezca Afiliado.
      - Ocultamos Estado.
      - No mostramos botón Guardar de status.
      - Afiliado inicia apagado: default SIMPATIZANTE.
    */

    if (adminbar) adminbar.hidden = false;
    if (statusField) statusField.hidden = true;

    if (estatusSelect) {
        estatusSelect.disabled = true;
        estatusSelect.value = "";
    }

    if (afiliadoInput) {
        afiliadoInput.disabled = false;
        afiliadoInput.checked = false;
    }

    if (saveStatusBtn) {
        saveStatusBtn.hidden = true;
        saveStatusBtn.disabled = true;
    }
}

function resetReviewModalForCapture() {
    const modal = $(SEL.reviewModal);
    const form = $(SEL.reviewForm);
    const seccionText = $(SEL.reviewSeccionText);

    if (!modal || !form) return;

    modal.dataset.mode = "capture";
    modal.__precheckedDuplicateData = null;
    form.classList.remove("is-readonly");

    form.querySelectorAll("input, textarea").forEach((field) => {
        field.disabled = false;
        field.readOnly = false;
    });

    form.querySelectorAll("select").forEach((field) => {
        field.disabled = false;
    });

    [
        "#ine-review-fecha-extraccion",
        "#ine-review-capturado-por",
        "#ine-review-updated-by",
        "#ine-review-curp",
        "#ine-review-clave-elector",
        "#ine-review-idmex",
    ].forEach((selector) => {
        const field = $(selector);
        if (field) {
            field.readOnly = true;
        }
    });

    closeReviewSeccionList();

    if (seccionText) {
        seccionText.textContent = "Selecciona una sección";
    }

    const saveBtn = $("#ine-modal-affiliate");
    const reprocessBtn = $(SEL.btnReprocess);
    const cancelBtn = form.querySelector("[data-ine-review-close]");
    const title = $("#ine-review-title");
    const kicker = $(".ine-review-kicker");
    const warning = $(".ine-review-warning");

    if (saveBtn) {
        saveBtn.hidden = false;
        saveBtn.disabled = false;
        saveBtn.textContent = "Guardar persona";
    }

    if (reprocessBtn) {
        reprocessBtn.hidden = false;
        reprocessBtn.disabled = false;
    }
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

    setReviewCreateAdminbar();
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

async function openReviewModal(payload) {
    const modal = $(SEL.reviewModal);

    if (!modal) {
        warn("No existe #ine-review-modal en esta vista.");
        console.log("Payload listo para review:", payload);
        return;
    }

    resetReviewModalForCapture();
    fillReviewForm(payload.persona || {});
    await syncReviewSeccionField(payload?.persona?.seccion_id || "");
    modal.__inePayload = payload;
    paintReviewImages(payload);

    setReviewModalOpen(true);

    window.setTimeout(async () => {
        const reviewPayload = collectReviewPayload();

        if (!isValidCurp(reviewPayload.curp)) {
            openValidationModal({
                title: "CURP/CLAVE no válidas",
                message:
                    "La CURP o la clave de elector capturadas no cumplen con el formato esperado. Puedes volver a capturar la INE o cerrar el flujo.",
            });
            return;
        }

        if (!isValidClaveElector(reviewPayload.clave_elector)) {
            openValidationModal({
                title: "CURP/CLAVE no válidas",
                message:
                    "La CURP o la clave de elector capturadas no cumplen con el formato esperado. Puedes volver a capturar la INE o cerrar el flujo.",
            });
            return;
        }

        const duplicateData = await findDuplicatePersonaBeforeSave(reviewPayload);

        syncReviewPrimaryAction(duplicateData);

        if (duplicateData?.duplicate) {
            openDuplicateModal(duplicateData);
            return;
        }

        const needsResidenceModal = await shouldOpenResidenceModalBeforeSave(reviewPayload);

        if (needsResidenceModal) {
            await openResidenceModal(reviewPayload, "review");
        }
    }, 0);

    log("Modal de revisión abierto:", payload);
}

function closeReviewModal() {
    closeReviewSeccionList();
    setReviewModalOpen(false);
}

function collectReviewPayload() {
    return {
        nombres: getFieldValue("#ine-review-nombres"),
        apellido_paterno: getFieldValue("#ine-review-apellido-paterno"),
        apellido_materno: getFieldValue("#ine-review-apellido-materno"),
        fecha_nacimiento: getFieldValue("#ine-review-fecha-nacimiento"),
        sexo: getFieldValue("#ine-review-sexo"),

        curp: normalizeCurp(getFieldValue("#ine-review-curp")),
        clave_elector: normalizeClaveElector(getFieldValue("#ine-review-clave-elector")),
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

        es_afiliado: getFieldValue("#ine-review-es-afiliado"),

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

    const esAfiliado = Number(payload.es_afiliado) === 1;
    const tipoParticipacion = esAfiliado ? "AFILIADO" : "SIMPATIZANTE";

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

        estatus_id: CONFIG.SAVE.personaEstatusIdCapturado,
        capturado_por: usuarioId || null,
        created_by: usuarioId || null,

        observaciones: nullableString(payload.observaciones),

        tipo_participacion: tipoParticipacion,
        participacion_territorio_id: nullableNumber(payload.seccion_id),
        usuario_responsable_id: usuarioId || null,
        fuente_captura: "PORTAL",
        fecha_registro: getTodayDateTimeForMysql(),
    };

    Object.keys(personaPayload).forEach((key) => {
        if (personaPayload[key] === null || personaPayload[key] === "") {
            delete personaPayload[key];
        }
    });

    return personaPayload;
}

async function compressCaptureForArchivo(capture, side = "archivo") {
    const normalized = normalizeCaptureObject(capture);
    const dataUrl = normalized?.dataUrl || "";

    if (!dataUrl) {
        return normalized;
    }

    const currentSizeKB = normalized?.sizeKB || Math.round(dataUrlSizeBytes(dataUrl) / 1024);

    if (currentSizeKB <= 260) {
        log("Captura ya está ligera para archivo:", {
            side,
            sizeKB: currentSizeKB,
            mime: normalized.mime,
            extension: normalized.extension,
        });

        return normalized;
    }

    if (!window.PRIMedia?.compressImageElementToDataUrl) {
        warn("PRIMedia no está disponible para recomprimir archivo. Se usará captura original.", {
            side,
            sizeKB: currentSizeKB,
        });

        return normalized;
    }

    try {
        const image = await loadImageFromDataUrl(dataUrl);

        const compressed = await window.PRIMedia.compressImageElementToDataUrl(image, {
            maxBytes: 260 * 1024,
            maxWidth: 760,
            maxHeight: 540,
            minWidth: 360,
            startQuality: 0.64,
            minQuality: 0.38,
            qualityStep: 0.06,
            preferWebp: false,
            background: "#ffffff",
            debug: CONFIG.MEDIA.debug,
            label: `archivo_${side}`,
        });

        const result = normalizeCaptureObject(compressed);

        log("Captura recomprimida para i_archivo:", {
            side,
            beforeKB: currentSizeKB,
            afterKB: result.sizeKB,
            beforeLength: dataUrl.length,
            afterLength: result.dataUrl.length,
            mime: result.mime,
            extension: result.extension,
            withinLimit: result.withinLimit,
        });

        toast(
            `Foto ${side === "front" ? "frente" : "reverso"} comprimida: ${currentSizeKB}KB → ${result.sizeKB}KB`,
            "exito",
            4500
        );

        return result;
    } catch (err) {
        warn("No se pudo recomprimir captura para archivo. Se usará original.", {
            side,
            error: err,
        });

        toast(
            `No se pudo comprimir la foto ${side === "front" ? "frente" : "reverso"}. Se enviará original.`,
            "warning",
            6000
        );

        return normalized;
    }
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

    if (!isValidCurp(payload.curp)) {
        openValidationModal({
            title: "CURP/CLAVE no válidas",
            message:
                "La CURP o la clave de elector capturadas no cumplen con el formato esperado. Puedes cerrar para revisar la información o volver a capturar la INE.",
        });
        return false;
    }

    if (!isValidClaveElector(payload.clave_elector)) {
        openValidationModal({
            title: "CURP/CLAVE no válidas",
            message:
                "La CURP o la clave de elector capturadas no cumplen con el formato esperado. Puedes cerrar para revisar la información o volver a capturar la INE.",
        });
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

async function saveFilesForPersona({ personaId, usuarioId, originalPayload }) {
    const captures = {
        front: originalPayload?.images?.front || State.captures.front,
        back: originalPayload?.images?.back || State.captures.back,
    };

    toast("Comprimiendo fotos de INE para guardar...", "warning", 3500);

    const archivoCaptures = {
        front: await compressCaptureForArchivo(captures.front, "front"),
        back: await compressCaptureForArchivo(captures.back, "back"),
    };

    const archivoPayloads = [
        buildArchivoInsertPayload({
            personaId,
            side: "front",
            capture: archivoCaptures.front,
            usuarioId,
        }),
        buildArchivoInsertPayload({
            personaId,
            side: "back",
            capture: archivoCaptures.back,
            usuarioId,
        }),
    ];

    const archivos = [];
    const erroresArchivo = [];

    for (const archivoPayload of archivoPayloads) {
        try {
            const archivoResponse = await postJSON(ENDPOINTS.insertArchivo, archivoPayload);

            console.log("[DEBUG i_archivo response]", {
                uso_archivo: archivoPayload.uso_archivo,
                response: archivoResponse,
            });

            toast(
                `i_archivo ${archivoPayload.uso_archivo}: ${archivoResponse?.message || "OK"}`,
                "exito",
                9000
            );

            archivos.push(archivoResponse.data || null);
        } catch (err) {
            const msg = err?.message || "No se pudo registrar archivo.";

            console.error("[DEBUG i_archivo error]", {
                uso_archivo: archivoPayload.uso_archivo,
                status: err?.status || null,
                endpoint_response: err?.response || null,
                raw_response: err?.raw || null,
                error: err,
                message: msg,
                payload_preview: {
                    entidad_tipo: archivoPayload.entidad_tipo,
                    entidad_id: archivoPayload.entidad_id,
                    uso_archivo: archivoPayload.uso_archivo,
                    nombre_storage: archivoPayload.nombre_storage,
                    mime_type: archivoPayload.mime_type,
                    extension: archivoPayload.extension,
                    tamano_bytes: archivoPayload.tamano_bytes,
                    url_archivo_length: String(archivoPayload.url_archivo || "").length,
                    url_archivo_head: String(archivoPayload.url_archivo || "").slice(0, 60),
                },
            });

            toast(
                `ERROR i_archivo ${archivoPayload.uso_archivo}: ${msg}`,
                "error",
                12000
            );

            erroresArchivo.push({
                uso_archivo: archivoPayload.uso_archivo,
                error: msg,
            });

            error(`No se pudo registrar ${archivoPayload.uso_archivo}:`, err);
        }
    }

    return {
        archivos: archivos.filter(Boolean),
        erroresArchivo,
    };
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

    const fileResult = await saveFilesForPersona({
        personaId,
        usuarioId,
        originalPayload,
    });

    const saved = {
        persona,
        archivos: fileResult.archivos,
        erroresArchivo: fileResult.erroresArchivo,
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
        selectReviewSeccion(found.territorio_id, getSeccionCodeLabel(found));
        payload.seccion_id = String(found.territorio_id);
    }

    return false;
}

async function updateDuplicatePersonaAndFiles(duplicateData) {
    const reviewModal = $(SEL.reviewModal);
    const originalPayload = reviewModal?.__inePayload || null;
    const usuarioId = getUsuarioId();

    const existingPersona = duplicateData?.existingPersona || null;
    const personaId = Number(existingPersona?.persona_id || 0);

    if (!personaId) {
        throw new Error("No se encontró el ID de la persona existente.");
    }

    const payload = collectReviewPayload();
    const personaPayload = await buildPersonaInsertPayload(payload);

    delete personaPayload.created_by;
    delete personaPayload.capturado_por;

    personaPayload.persona_id = personaId;
    personaPayload.updated_by = usuarioId || null;

    log("Payload update persona duplicada listo:", personaPayload);

    const personaResponse = await postJSON(ENDPOINTS.updatePersona, personaPayload);
    const persona = personaResponse.data || null;

    const fileResult = await saveFilesForPersona({
        personaId,
        usuarioId,
        originalPayload,
    });

    const saved = {
        persona,
        archivos: fileResult.archivos,
        erroresArchivo: fileResult.erroresArchivo,
        duplicateUpdated: true,
        duplicateData,
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

async function handleReviewSubmit(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const submitBtn = form?.querySelector('[type="submit"]');

    const payload = collectReviewPayload();

    if (!validateReviewPayload(payload)) return;

    const isContinuingFromResidenceModal = Boolean(State.pendingReviewSubmit);
    const reviewModal = $(SEL.reviewModal);
    const duplicateData = reviewModal?.__precheckedDuplicateData || null;

    if (duplicateData?.duplicate) {
        await handleDuplicateUpdateRequest(duplicateData, submitBtn);
        return;
    }

    if (!isContinuingFromResidenceModal) {
        const needsResidenceModal = await shouldOpenResidenceModalBeforeSave(payload);

        if (needsResidenceModal) {
            await openResidenceModal(payload, "save");
            return;
        }
    }

    State.pendingReviewSubmit = null;
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

        const duplicateData = getDuplicateDataFromError(err);

        if (duplicateData?.duplicate) {
            openDuplicateModal(duplicateData);
            return;
        }

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
        State.pendingDuplicateUpdate = null;
        State.pendingReviewSubmit = null;
        State.residenceContext = null;

        closeResidenceModal();
        closeReviewModal();
        closeDuplicateModal();

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

        const foundSeccion = findSeccionByInput(seccion);
        selectReviewSeccion(
            seccion,
            foundSeccion ? getSeccionCodeLabel(foundSeccion) : seccion
        );
        setFieldValue("#ine-review-domicilio", domicilio);
        setFieldValue("#ine-review-telefono", telefono);

        closeResidenceModal({ clearPending: false });

        const residenceContext = State.residenceContext;
        State.residenceContext = null;

        const pendingDuplicate = State.pendingDuplicateUpdate;

        if (pendingDuplicate) {
            State.pendingDuplicateUpdate = null;
            return;
        }

        if (residenceContext === "review") {
            State.pendingReviewSubmit = null;
            return;
        }

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

    $(SEL.reviewSeccionToggle)?.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleReviewSeccionList();
    });

    document.addEventListener("click", (event) => {
        const combo = event.target.closest(".ine-review-field--combo");
        if (!combo) closeReviewSeccionList();
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

    await openPreferredCaptureMethod();
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

    const validationModal = $(SEL.validationModal);
    if (validationModal && !validationModal.hidden) {
        abortValidationFlow();
        return;
    }

    const duplicateModal = $(SEL.duplicateModal);
    if (duplicateModal && !duplicateModal.hidden) {
        closeDuplicateModal();
        return;
    }

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

    $(SEL.btnUseCamera)?.addEventListener("click", async () => {
        prepareCaptureStep("front");
        await startCamera();
    });

    $(SEL.btnUseUpload)?.addEventListener("click", () => {
        stopCamera();
        clearUploadInputs();
        showScreen("upload");
    });

    $(SEL.uploadFront)?.addEventListener("change", async (event) => {
        await handleUploadFile("front", event.target.files?.[0] || null);
    });

    $(SEL.uploadBack)?.addEventListener("change", async (event) => {
        await handleUploadFile("back", event.target.files?.[0] || null);
    });

    $(SEL.btnUploadBack)?.addEventListener("click", async () => {
        clearUploadInputs();
        await openPreferredCaptureMethod();
    });

    $(SEL.btnUploadContinue)?.addEventListener("click", () => {
        if (!State.captures.front || !State.captures.back) {
            toast("Sube el frente y reverso de la INE.", "warning", 4500);
            return;
        }

        showSummary();
    });

    $(SEL.btnCapture)?.addEventListener("click", captureCurrentStep);
    $(SEL.btnRetry)?.addEventListener("click", retryCurrentStep);
    $(SEL.btnNext)?.addEventListener("click", continueFlow);

    $(SEL.btnSummaryRetry)?.addEventListener("click", async () => {
        stopCamera();
        resetCaptureFlow();
        setModalOpen(true);
        await openPreferredCaptureMethod();
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
