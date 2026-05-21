/*
aqui guarde ciertos comanods para recordarlos y el como ejecutar la app.

cd "C:\Users\jacks\Desktop\Proyectos GodCode\Ixtla_app\red-ine-scanner"
>> .\venv\Scripts\Activate.ps1
>> python app.py


.\venv\Scripts\activate.bat                               
>> python app.py              
                

Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
>> .\venv\Scripts\Activate.ps1
>> python app.py
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

    try {
      setLoading(true);

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

      renderData(data.data, data.best_method, data.score);
      renderRawText(data);
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
    if (rawText) rawText.textContent = "Aquí aparecerá el texto leído por Tesseract.";

    if (resultData) {
      resultData.innerHTML = `<p class="empty-state">Aquí aparecerán los campos detectados.</p>`;
    }
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
});