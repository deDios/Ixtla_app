"use strict";

const CONFIG = {
    DEBUG: true,
    REQUIRED_STABLE_MS: 1400,
    PROGRESS_DECAY: 10,
    SIMULATION_MODE: true, // luego lo cambiamos a false cuando metamos OpenCV real
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
    captures: {
        front: null,
        back: null,
    },
    simulationTick: 0,
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
        warn("No se encontró el video.");
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: { ideal: "environment" },
                width: { ideal: 1280 },
                height: { ideal: 720 },
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
        showError("No se pudo abrir la cámara. Revisa permisos del navegador.");
    }
}

function stopCamera() {
    if (!State.stream) return;

    State.stream.getTracks().forEach((track) => track.stop());
    State.stream = null;

    log("Cámara detenida.");
}

function startScannerLoop() {
    const loop = () => {
        if (!State.stream) return;

        const result = CONFIG.SIMULATION_MODE
            ? getSimulatedValidation()
            : getRealValidationPlaceholder();

        updateScannerValidation(result);

        requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
}

function getSimulatedValidation() {
    State.simulationTick += 1;

    const cycle = State.simulationTick % 260;

    const hasCard = cycle > 25;
    const goodSize = cycle > 45;
    const goodAngle = cycle > 65;
    const goodFocus = cycle > 85;
    const goodLighting = cycle > 105;
    const isStable = cycle > 125;

    return {
        hasCard,
        goodSize,
        goodAngle,
        goodFocus,
        goodLighting,
        isStable,
    };
}

function getRealValidationPlaceholder() {
    return {
        hasCard: false,
        goodSize: false,
        goodAngle: false,
        goodFocus: false,
        goodLighting: false,
        isStable: false,
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
    if (State.autoCaptured || State.state === "captured" || State.state === "error") return;

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

    if (State.scanProgress >= 100) {
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

function capturePhoto() {
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

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, width, height);

    const imageData = canvas.toDataURL("image/jpeg", 0.92);

    State.captures[State.step] = imageData;

    setStageState("captured");
    updateCapturedUI();

    log(`Captura ${State.step} lista.`);
}

function updateCapturedUI() {
    const retry = $(SEL.retry);
    const next = $(SEL.continue);
    const text = $(SEL.statusText);
    const bar = $(SEL.progressBar);

    if (bar) bar.style.width = "100%";

    if (text) {
        text.textContent =
            State.step === "front"
                ? "Frente capturado correctamente"
                : "Reverso capturado correctamente";
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
    State.simulationTick = 0;

    const retry = $(SEL.retry);
    const next = $(SEL.continue);
    const bar = $(SEL.progressBar);

    if (retry) retry.hidden = true;
    if (next) next.hidden = true;
    if (bar) bar.style.width = "0%";

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
}

function showError(message) {
    setStageState("error");

    const text = $(SEL.statusText);
    const retry = $(SEL.retry);
    const next = $(SEL.continue);

    if (text) text.textContent = message;
    if (retry) retry.hidden = false;
    if (next) next.hidden = true;
}

function processOCR() {
    log("Procesar OCR:", State.captures);

    alert("Aquí enviaremos frente y reverso al backend para procesar OCR.");
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
}

function init() {
    bindEvents();
    setStep("front");
    setStageState("idle");
    startCamera();
}

document.addEventListener("DOMContentLoaded", init);