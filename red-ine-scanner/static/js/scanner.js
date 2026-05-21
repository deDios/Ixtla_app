/*
Comandos para arrancar:

cd "C:\Users\jacks\Desktop\Proyectos GodCode\Ixtla_app\red-ine-scanner"
.\venv\Scripts\Activate.ps1
python app.py

Si PowerShell bloquea:
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
python app.py
*/

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#scanner-form");

  const frontInput = document.querySelector("#ine-front");
  const backInput = document.querySelector("#ine-back");

  const frontPreview = document.querySelector("#front-preview");
  const backPreview = document.querySelector("#back-preview");

  const rawText = document.querySelector("#raw-text");
  const resultData = document.querySelector("#result-data");
  const btnScan = document.querySelector("#btn-scan");

  const debugCanvas = document.querySelector("#ocr-debug-canvas");
  const debugInfo = document.querySelector("#ocr-debug-info");
  const debugButtons = document.querySelectorAll("[data-ocr-side]");

  let lastOCRDebug = null;

  if (!form || !frontInput || !backInput) {
    console.warn("No se encontró el formulario o inputs del scanner.");
    return;
  }

  frontInput.addEventListener("change", () => {
    renderPreview(frontInput, frontPreview);
    resetResults();
  });

  backInput.addEventListener("change", () => {
    renderPreview(backInput, backPreview);
    resetResults();
  });

  debugButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      renderOCRDebug(btn.dataset.ocrSide);
      setActiveDebugButton(btn.dataset.ocrSide);
    });
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const frontFile = frontInput.files[0];
    const backFile = backInput.files[0];

    if (!frontFile) {
      alert("Selecciona la imagen frontal de la INE.");
      return;
    }

    if (!backFile) {
      alert("Selecciona la imagen trasera de la INE.");
      return;
    }

    const formData = new FormData();
    formData.append("front_image", frontFile);
    formData.append("back_image", backFile);
    formData.append("debug", "1");

    try {
      setLoading(true);
      clearDebugCanvas();

      const response = await fetch("/scan-ine", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      console.log("Respuesta OCR:", data);
      console.table(data.front_debug_results || []);
      console.table(data.back_debug_results || []);

      if (!data.ok) {
        alert(data.error || "Ocurrió un error al procesar la INE.");
        return;
      }

      lastOCRDebug = data;
      window.lastOCRDebug = data;

      renderData(data.data, data.best_method, data.score);
      renderRawText(data);

      renderOCRDebug("front");
      setActiveDebugButton("front");
    } catch (error) {
      console.error("Error escaneando INE:", error);
      alert("No se pudo conectar con el servidor OCR.");
    } finally {
      setLoading(false);
    }
  });

  function renderPreview(input, preview) {
    const file = input.files[0];

    if (!file || !preview) return;

    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
  }

  function resetResults() {
    lastOCRDebug = null;
    window.lastOCRDebug = null;

    if (rawText) {
      rawText.textContent = "Aquí aparecerá el texto leído por Tesseract.";
    }

    if (resultData) {
      resultData.innerHTML = `<p class="empty-state">Aquí aparecerán los campos detectados.</p>`;
    }

    clearDebugCanvas();
  }

  function setLoading(isLoading) {
    if (!btnScan) return;

    btnScan.disabled = isLoading;
    btnScan.textContent = isLoading ? "Escaneando..." : "Escanear INE";
  }

  function renderData(data, method, score) {
    if (!resultData) return;

    resultData.innerHTML = `
      <div class="result-meta">
        <span>Método: ${method || "N/A"}</span>
        <span>Score: ${score ?? "N/A"}</span>
      </div>

      <div class="result-card">
        ${fieldRow("Nombre", data.nombre)}
        ${fieldRow("Domicilio", data.domicilio)}
        ${fieldRow("CURP", data.curp)}
        ${fieldRow("Clave elector", data.clave_elector)}
        ${fieldRow("Fecha nacimiento", data.fecha_nacimiento)}
        ${fieldRow("Sexo", data.sexo)}
        ${fieldRow("Estado", data.estado)}
        ${fieldRow("Municipio", data.municipio)}
        ${fieldRow("Sección", data.seccion)}
        ${fieldRow("Localidad", data.localidad)}
        ${fieldRow("Emisión", data.emision)}
        ${fieldRow("Vigencia", data.vigencia)}
      </div>
    `;
  }

  function fieldRow(label, value) {
    const safeValue = value && String(value).trim() ? value : "No detectado";

    return `
      <p class="${safeValue === "No detectado" ? "is-empty" : "is-detected"}">
        <strong>${label}:</strong> ${safeValue}
      </p>
    `;
  }

  function renderRawText(data) {
    if (!rawText) return;

    rawText.textContent = `
===== FRENTE =====
${data.front_raw_text || "Sin texto frontal"}

===== REVERSO =====
${data.back_raw_text || "Sin texto trasero"}
    `.trim();
  }

  function renderOCRDebug(side = "front") {
    const debug = lastOCRDebug || window.lastOCRDebug;

    if (!debug || !debugCanvas) {
      updateDebugInfo("Esperando escaneo...");
      return;
    }

    const ctx = debugCanvas.getContext("2d");

    const img = side === "front" ? frontPreview : backPreview;
    const results = side === "front"
      ? debug.front_debug_results
      : debug.back_debug_results;

    if (!img || !results || !results.length) {
      updateDebugInfo("No hay resultados OCR para mostrar.");
      return;
    }

    const best = results.reduce((currentBest, item) => {
      return item.score > currentBest.score ? item : currentBest;
    }, results[0]);

    if (!img.complete || !img.naturalWidth) {
      img.onload = () => renderOCRDebug(side);
      return;
    }

    debugCanvas.width = img.naturalWidth;
    debugCanvas.height = img.naturalHeight;

    ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    ctx.drawImage(img, 0, 0, debugCanvas.width, debugCanvas.height);

    const sourceW = best.image_size?.width || debugCanvas.width;
    const sourceH = best.image_size?.height || debugCanvas.height;

    const scaleX = debugCanvas.width / sourceW;
    const scaleY = debugCanvas.height / sourceH;

    ctx.lineWidth = 2;
    ctx.font = "13px Arial";
    ctx.textBaseline = "bottom";

    const boxes = best.boxes || [];

    boxes.forEach((box) => {
      const x = box.x * scaleX;
      const y = box.y * scaleY;
      const w = box.w * scaleX;
      const h = box.h * scaleY;

      ctx.strokeRect(x, y, w, h);

      const label = `${box.text} ${Math.round(box.conf)}%`;
      const labelY = y > 18 ? y - 4 : y + h + 14;

      ctx.fillText(label, x, labelY);
    });

    updateDebugInfo(`
      <strong>Lado:</strong> ${side === "front" ? "Frente" : "Reverso"}<br>
      <strong>Método:</strong> ${best.method || "N/A"}<br>
      <strong>Score:</strong> ${best.score ?? "N/A"}<br>
      <strong>Cajas detectadas:</strong> ${boxes.length}<br>
      <strong>Tamaño OCR:</strong> ${sourceW} x ${sourceH}
    `);
  }

  function clearDebugCanvas() {
    if (debugCanvas) {
      const ctx = debugCanvas.getContext("2d");
      ctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
      debugCanvas.width = 0;
      debugCanvas.height = 0;
    }

    updateDebugInfo("Esperando escaneo...");
    setActiveDebugButton("front");
  }

  function updateDebugInfo(content) {
    if (!debugInfo) return;
    debugInfo.innerHTML = content;
  }

  function setActiveDebugButton(side) {
    debugButtons.forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.ocrSide === side);
    });
  }
});