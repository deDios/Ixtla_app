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
  const input = document.querySelector("#ine-image");
  const preview = document.querySelector("#image-preview");
  const rawText = document.querySelector("#raw-text");
  const resultData = document.querySelector("#result-data");
  const btnScan = document.querySelector("#btn-scan");

  if (!form || !input) {
    console.warn("No se encontró el formulario o input del scanner.");
    return;
  }

  input.addEventListener("change", () => {
    const file = input.files[0];

    if (!file) return;

    if (preview) {
      preview.src = URL.createObjectURL(file);
      preview.style.display = "block";
    }

    if (rawText) rawText.textContent = "";
    if (resultData) {
      resultData.innerHTML = `<p class="empty-state">Aquí aparecerán los campos detectados.</p>`;
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const file = input.files[0];

    if (!file) {
      alert("Selecciona una imagen de la INE primero.");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    try {
      setLoading(true);

      const response = await fetch("/scan-ine", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      console.log("Respuesta OCR:", data);
      console.table(data.debug_results || []);

      if (!data.ok) {
        alert(data.error || "Ocurrió un error al procesar la imagen.");
        return;
      }

      renderData(data.data, data.best_method, data.score);
      renderRawText(data.raw_text);
    } catch (error) {
      console.error("Error escaneando INE:", error);
      alert("No se pudo conectar con el servidor OCR.");
    } finally {
      setLoading(false);
    }
  });

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

  function renderRawText(text) {
    if (!rawText) return;
    rawText.textContent = text || "No se detectó texto.";
  }
});