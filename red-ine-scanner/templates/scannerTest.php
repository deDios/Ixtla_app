<!DOCTYPE html>
<html lang="es">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Scanner INE | RED</title>

  <link rel="stylesheet" href="{{ url_for('static', filename='css/styles.css') }}">
</head>

<body>

  <main class="scanner-page">
    <section class="scanner-hero">
      <div>
        <span class="scanner-badge">Demo local OCR</span>
        <h1>Scanner de INE</h1>
        <p>
          Sube una imagen de prueba para procesarla con Python, OpenCV y Tesseract.
        </p>
      </div>
    </section>

    <section class="scanner-grid">
      <article class="scanner-card">
        <h2>Imagen</h2>

        <form id="scanner-form">
          <div class="upload-group">
            <label class="upload-box" for="ine-front">
              <span>Seleccionar frente</span>
              <small>Imagen frontal de la INE</small>
            </label>
            <input type="file" id="ine-front" accept="image/*">
            <img id="front-preview" class="image-preview" alt="Vista previa frente">
          </div>

          <div class="upload-group">
            <label class="upload-box" for="ine-back">
              <span>Seleccionar reverso</span>
              <small>Imagen trasera de la INE</small>
            </label>
            <input type="file" id="ine-back" accept="image/*">
            <img id="back-preview" class="image-preview" alt="Vissta previa reverso">
          </div>

          <button type="submit" id="btn-scan">
            Escanear INE
          </button>
        </form>
      </article>

      <article class="scanner-card">
        <h2>Datos detectados</h2>
        <div id="result-data" class="result-data">
          <p class="empty-state">Aquí aparecerán los campos detectados.</p>
        </div>
      </article>

      <article class="scanner-card scanner-card--full">
        <h2>Texto OCR crudo</h2>
        <pre id="raw-text" class="raw-text">Aquí aparecerá el texto leído por Tesseract.</pre>
      </article>
    </section>
  </main>

  <script src="{{ url_for('static', filename='js/scanner.js') }}"></script>
</body>

</html>