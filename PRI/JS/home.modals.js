"use strict";

/* -------------------------------------------------------------------------- */
/* RED HOME · MODALES                                                         */
/* Modal captura INE: frente -> reverso -> resumen -> loader                  */
/* -------------------------------------------------------------------------- */

const CONFIG = {
  DEBUG_LOGS: true,

  CAMERA: {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    facingMode: { ideal: "environment" },
  },

  MOCK: {
    readDelayMs: 2200,
  },
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
  dialog: ".ine-capture-dialog",
  close: "[data-ine-capture-close]",

  screen: ".ine-capture-screen",
  screenCamera: '[data-ine-screen="camera"]',
  screenSummary: '[data-ine-screen="summary"]',
  screenLoading: '[data-ine-screen="loading"]',

  stage: ".ine-camera-stage",
  video: "#ine-camera-video",
  canvas: "#ine-camera-canvas",
  guideBox: ".ine-camera-guide-box",

  subtitle: "#ine-capture-subtitle",
  stepTitle: "#ine-camera-step-title",
  status: "#ine-camera-status",

  btnCapture: "#ine-btn-capture",
  btnRetry: "#ine-btn-retry",
  btnNext: "#ine-btn-next",
  btnSummaryRetry: "#ine-btn-summary-retry",
  btnReadData: "#ine-btn-read-data",

  previewFront: "#ine-preview-front",
  previewBack: "#ine-preview-back",
};

/* -------------------------------------------------------------------------- */
/* HELPERS                                                                    */
/* -------------------------------------------------------------------------- */

function toast(message, type = "exito", duration = 4500) {
  if (typeof window.gcToast === "function") {
    window.gcToast(message, type, duration);
    return;
  }

  console.log(`[Toast fallback][${type}]`, message);
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

  document.body.classList.toggle("ine-modal-open", isOpen);
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
  const subtitle = $(SEL.subtitle);
  const title = $(SEL.stepTitle);
  const status = $(SEL.status);

  if (stage) {
    stage.dataset.step = step;
  }

  if (step === "front") {
    if (subtitle) subtitle.textContent = "Coloca el frente de la INE dentro del recuadro";
    if (title) title.textContent = "Coloca el frente de la INE dentro del recuadro";
    if (status) status.textContent = "Cuando la INE esté bien alineada, presiona Capturar";
  }

  if (step === "back") {
    if (subtitle) subtitle.textContent = "Coloca el reverso de la INE dentro del recuadro";
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
/* RESUMEN / LECTURA SIMULADA                                                  */
/* -------------------------------------------------------------------------- */

function showSummary() {
  const front = $(SEL.previewFront);
  const back = $(SEL.previewBack);

  if (front && State.captures.front) front.src = State.captures.front;
  if (back && State.captures.back) back.src = State.captures.back;

  stopCamera();
  showScreen("summary");

  const subtitle = $(SEL.subtitle);
  if (subtitle) subtitle.textContent = "Revisa las capturas antes de leer los datos";

  log("Resumen mostrado.");
}

async function simulateReadData() {
  if (!State.captures.front || !State.captures.back) {
    toast("Necesitas capturar frente y reverso antes de leer datos.", "error", 5000);
    return;
  }

  const btnRead = $(SEL.btnReadData);
  if (btnRead) btnRead.disabled = true;

  showScreen("loading");

  const subtitle = $(SEL.subtitle);
  if (subtitle) subtitle.textContent = "Procesando imágenes con OpenAI";

  log("Simulando lectura OpenAI...", {
    frontLength: State.captures.front.length,
    backLength: State.captures.back.length,
  });

  await new Promise((resolve) => setTimeout(resolve, CONFIG.MOCK.readDelayMs));

  const mockData = buildMockIneData();

  log("Datos simulados:", mockData);

  toast("Lectura simulada completada.", "exito", 3500);

  closeCaptureModal();

  /*
   * Siguiente paso:
   * Aquí abriremos el modal grande de revisión/alta de persona
   * y llamaremos una función tipo:
   *
   * window.REDHomePersonaModal?.open(mockData);
   *
   * Por ahora dejamos el evento listo para no acoplar todavía los modales.
   */
  window.dispatchEvent(new CustomEvent("red:ine-data-ready", {
    detail: {
      provider: "openai_mock",
      data: mockData,
      images: {
        front: State.captures.front,
        back: State.captures.back,
      },
    },
  }));

  if (btnRead) btnRead.disabled = false;
}

function buildMockIneData() {
  return {
    nombres: "JUAN PABLO",
    apellido_paterno: "GARCIA",
    apellido_materno: "CASILLAS",
    fecha_nacimiento: "2000-04-16",
    sexo: "H",
    curp: "GACJ000416HJCRSNA1",
    clave_elector: "GRCSJN00041614H990",
    seccion: "1592",
    anio_registro: "2018",
    emision: "2019",
    vigencia_inicio: "2019",
    vigencia_fin: "2029",
    domicilio_texto: "LA BANDERA #16, IXTLAHUACÁN DE LOS MEMBRILLOS, JAL.",
    calle: "LA BANDERA",
    numero_exterior: "16",
    numero_interior: "",
    colonia: "",
    localidad: "IXTLAHUACÁN DE LOS MEMBRILLOS",
    municipio: "IXTLAHUACÁN DE LOS MEMBRILLOS",
    estado: "JALISCO",
    codigo_postal: "",
  };
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

  const modal = $(SEL.modal);
  if (!modal || modal.hidden) return;

  closeCaptureModal();
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

  $(SEL.btnReadData)?.addEventListener("click", simulateReadData);

  document.addEventListener("keydown", handleEscape);

  /*
   * Evento temporal para comprobar que el flujo ya entrega datos.
   * Después aquí conectamos el modal/formulario de persona.
   */
  window.addEventListener("red:ine-data-ready", (event) => {
    log("Evento red:ine-data-ready recibido:", event.detail);
  });
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