<?php
// identificacion_ocr.php
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>OCR de identificación con watsonx y OpenAI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <!-- OCR en navegador -->
    <script src="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js"></script>

    <style>
        * {
            box-sizing: border-box;
        }

        body {
            font-family: Arial, Helvetica, sans-serif;
            margin: 0;
            background: #f4f6f8;
            color: #1f2933;
        }

        .page {
            max-width: 1500px;
            margin: 32px auto;
            padding: 0 24px 40px;
        }

        .header {
            margin-bottom: 24px;
        }

        .header h1 {
            margin: 0;
            font-size: 34px;
        }

        .header p {
            margin-top: 8px;
            color: #5b6770;
        }

        .grid {
            display: grid;
            grid-template-columns: minmax(320px, 1fr) minmax(320px, 1fr);
            gap: 24px;
        }

        .card {
            background: #ffffff;
            border-radius: 16px;
            padding: 22px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
        }

        .card h2 {
            margin: 0 0 14px;
            font-size: 20px;
        }

        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 16px 0;
        }

        .btn {
            border: none;
            background: #0f62fe;
            color: #ffffff;
            padding: 11px 15px;
            border-radius: 10px;
            cursor: pointer;
            font-weight: bold;
        }

        .btn.secondary {
            background: #1f2933;
        }

        .btn.warning {
            background: #f1c21b;
            color: #1f2933;
        }

        .btn.danger {
            background: #da1e28;
        }

        .btn.success {
            background: #24a148;
        }

        .btn:disabled {
            background: #94a3b8;
            cursor: not-allowed;
            color: #ffffff;
        }

        input[type="file"] {
            width: 100%;
            padding: 12px;
            border: 1px dashed #94a3b8;
            border-radius: 12px;
            background: #f8fafc;
        }

        video,
        canvas,
        img.preview {
            width: 100%;
            max-height: 420px;
            object-fit: contain;
            background: #111827;
            border-radius: 14px;
            margin-top: 12px;
        }

        canvas {
            display: none;
        }

        .image-list {
            margin-top: 14px;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
            gap: 10px;
        }

        .image-thumb {
            border: 2px solid #e5e7eb;
            border-radius: 12px;
            padding: 8px;
            background: #f8fafc;
            cursor: pointer;
            position: relative;
        }

        .image-thumb.active {
            border-color: #0f62fe;
            background: #eef4ff;
        }

        .image-thumb img {
            width: 100%;
            height: 80px;
            object-fit: contain;
            background: #111827;
            border-radius: 8px;
            display: block;
        }

        .image-thumb-title {
            margin-top: 6px;
            font-size: 12px;
            font-weight: bold;
            color: #1f2933;
            line-height: 1.2;
        }

        .image-thumb-subtitle {
            margin-top: 2px;
            font-size: 11px;
            color: #64748b;
        }

        .thumb-remove {
            position: absolute;
            top: 4px;
            right: 4px;
            border: none;
            background: #da1e28;
            color: #ffffff;
            border-radius: 999px;
            width: 22px;
            height: 22px;
            cursor: pointer;
            font-size: 13px;
            line-height: 22px;
            padding: 0;
        }

        .status {
            background: #eef4ff;
            border-left: 5px solid #0f62fe;
            padding: 12px 14px;
            border-radius: 10px;
            color: #1f2933;
            margin: 12px 0;
            font-size: 14px;
            white-space: pre-wrap;
        }

        .status.error {
            background: #fff1f1;
            border-left-color: #da1e28;
        }

        .status.success {
            background: #e8f7ee;
            border-left-color: #24a148;
        }

        .status.warning {
            background: #fff8db;
            border-left-color: #f1c21b;
        }

        textarea {
            width: 100%;
            height: 260px;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            padding: 14px;
            resize: vertical;
            font-family: monospace;
            font-size: 13px;
            line-height: 1.4;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 16px;
        }

        th {
            background: #1f2933;
            color: #ffffff;
            text-align: left;
            padding: 11px;
            font-size: 13px;
            position: sticky;
            top: 0;
            z-index: 1;
        }

        td {
            padding: 11px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 13px;
            vertical-align: top;
        }

        .table-wrapper {
            width: 100%;
            overflow-x: auto;
        }

        .json-box {
            background: #0f172a;
            color: #e5e7eb;
            padding: 14px;
            border-radius: 12px;
            overflow-x: auto;
            font-size: 12px;
            max-height: 460px;
        }

        .note {
            font-size: 13px;
            color: #64748b;
            line-height: 1.5;
        }

        .mini-info {
            font-size: 12px;
            color: #64748b;
            margin-top: 8px;
        }

        .provider-box {
            display: grid;
            grid-template-columns: repeat(2, minmax(220px, 1fr));
            gap: 12px;
            margin-top: 12px;
        }

        .provider-card {
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 14px;
            background: #f8fafc;
        }

        .provider-card strong {
            display: block;
            margin-bottom: 6px;
            color: #1f2933;
        }

        .provider-card span {
            display: block;
            color: #64748b;
            font-size: 12px;
            line-height: 1.4;
        }

        .value-empty {
            color: #94a3b8;
            font-style: italic;
        }

        .value-conflict {
            background: #fff8db;
            font-weight: bold;
        }

        .value-suggested {
            background: #e8f7ee;
            font-weight: bold;
        }

        .provider-pill {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: bold;
            margin-right: 6px;
        }

        .provider-pill.watsonx {
            background: #eef4ff;
            color: #0f62fe;
        }

        .provider-pill.openai {
            background: #fff8db;
            color: #8a5a00;
        }

        .field-label {
            font-weight: bold;
        }

        .field-target {
            color: #64748b;
            font-size: 12px;
        }

        small {
            font-size: 11px;
        }

        @media (max-width: 900px) {
            .grid {
                grid-template-columns: 1fr;
            }

            .provider-box {
                grid-template-columns: 1fr;
            }

            .page {
                padding: 0 16px 32px;
            }
        }
    </style>
</head>
<body>

<div class="page">
    <div class="header">
        <h1>Lectura de identificación</h1>
        <p>
            Toma una o varias fotos de la identificación. Puedes cargar frente y reverso para complementar la información.
            La tabla final compara los resultados contra los campos objetivo de la tabla <strong>persona</strong>.
        </p>
    </div>

    <div class="grid">
        <div class="card">
            <h2>1. Imágenes de identificación</h2>

            <p class="note">
                Puedes cargar una o varias imágenes. Para INE se recomienda cargar frente y reverso.
                Para mejores resultados, usa buena luz, sin reflejos y que el documento esté completo.
            </p>

            <input type="file" id="imageInput" accept="image/*" multiple>

            <div class="actions">
                <button class="btn secondary" id="startCameraButton" type="button">
                    Abrir cámara
                </button>
                <button class="btn" id="captureButton" type="button" disabled>
                    Tomar foto y agregar
                </button>
                <button class="btn danger" id="stopCameraButton" type="button" disabled>
                    Cerrar cámara
                </button>
            </div>

            <video id="video" autoplay playsinline style="display:none;"></video>
            <canvas id="canvas"></canvas>
            <img id="preview" class="preview" alt="Vista previa" style="display:none;">

            <div class="actions">
                <button class="btn secondary" id="rotateLeftButton" type="button" disabled>
                    Girar imagen activa izquierda
                </button>
                <button class="btn secondary" id="rotateRightButton" type="button" disabled>
                    Girar imagen activa derecha
                </button>
                <button class="btn warning" id="ocrAutoButton" type="button" disabled>
                    OCR todas las imágenes
                </button>
                <button class="btn" id="ocrButton" type="button" disabled>
                    OCR imagen activa
                </button>
                <button class="btn secondary" id="clearButton" type="button">
                    Limpiar
                </button>
            </div>

            <div id="imageList" class="image-list"></div>

            <div id="ocrStatus" class="status">
                Esperando imagen.
            </div>

            <div class="mini-info">
                Para watsonx usa <strong>OCR todas las imágenes</strong>. Para OpenAI se enviará una imagen compuesta con todas las imágenes cargadas.
            </div>
        </div>

        <div class="card">
            <h2>2. Texto OCR y análisis</h2>

            <p class="note">
                El OCR puede tener errores. Puedes corregir manualmente el texto antes de mandarlo a watsonx.
                OpenAI puede usar todas las imágenes directamente y también puede recibir el OCR como apoyo.
            </p>

            <textarea id="rawText" placeholder="Aquí aparecerá el texto detectado por OCR de todas las imágenes..."></textarea>

            <div class="provider-box">
                <div class="provider-card">
                    <strong>watsonx</strong>
                    <span>Usa el texto OCR leído por Tesseract.js de una o varias imágenes.</span>
                </div>

                <div class="provider-card">
                    <strong>OpenAI</strong>
                    <span>Usa una imagen compuesta con todas las fotos cargadas. El OCR es opcional como apoyo.</span>
                </div>
            </div>

            <div class="actions">
                <button class="btn" id="analyzeWatsonxButton" type="button" disabled>
                    Analizar con watsonx
                </button>

                <button class="btn warning" id="analyzeOpenAIButton" type="button" disabled>
                    Analizar con OpenAI
                </button>
            </div>

            <div id="analyzeStatus" class="status">
                Esperando imagen o texto para analizar.
            </div>
        </div>
    </div>

    <div class="card" style="margin-top:24px;">
        <h2>3. Comparación de datos para tabla persona</h2>

        <p class="note">
            Esta tabla compara los campos detectados por watsonx y OpenAI contra los campos que quieres recuperar para la tabla
            <strong>persona</strong>. Los campos sensibles como CURP, clave de elector, OCR, CIC e IDMEX se muestran para comparación,
            pero al guardar en BD deberán cifrarse o guardarse como hash según corresponda.
        </p>

        <div id="documentSummary"></div>

        <div class="table-wrapper">
            <table id="fieldsTable" style="display:none;">
                <thead>
                    <tr>
                        <th>Campo persona</th>
                        <th>Destino DB</th>
                        <th>Watsonx</th>
                        <th>Conf. W</th>
                        <th>OpenAI</th>
                        <th>Conf. O</th>
                        <th>Valor sugerido</th>
                    </tr>
                </thead>
                <tbody id="fieldsBody"></tbody>
            </table>
        </div>

        <h3>JSON comparativo para CRM</h3>
        <pre id="jsonOutput" class="json-box">{}</pre>
    </div>
</div>

<script>
    const imageInput = document.getElementById("imageInput");
    const imageList = document.getElementById("imageList");

    const startCameraButton = document.getElementById("startCameraButton");
    const captureButton = document.getElementById("captureButton");
    const stopCameraButton = document.getElementById("stopCameraButton");
    const rotateLeftButton = document.getElementById("rotateLeftButton");
    const rotateRightButton = document.getElementById("rotateRightButton");
    const ocrAutoButton = document.getElementById("ocrAutoButton");
    const ocrButton = document.getElementById("ocrButton");
    const clearButton = document.getElementById("clearButton");
    const analyzeWatsonxButton = document.getElementById("analyzeWatsonxButton");
    const analyzeOpenAIButton = document.getElementById("analyzeOpenAIButton");

    const video = document.getElementById("video");
    const canvas = document.getElementById("canvas");
    const preview = document.getElementById("preview");

    const rawText = document.getElementById("rawText");
    const ocrStatus = document.getElementById("ocrStatus");
    const analyzeStatus = document.getElementById("analyzeStatus");

    const documentSummary = document.getElementById("documentSummary");
    const fieldsTable = document.getElementById("fieldsTable");
    const fieldsBody = document.getElementById("fieldsBody");
    const jsonOutput = document.getElementById("jsonOutput");

    let mediaStream = null;

    let documentImages = [];
    let activeImageIndex = -1;

    /*
     * Compatibilidad con funciones anteriores.
     * originalImage y rotationAngle representan la imagen activa.
     */
    let originalImage = null;
    let currentImageDataUrl = null;
    let rotationAngle = 0;

    const providerResults = {
        watsonx: null,
        openai: null
    };

    /*
     * Campos objetivo según tabla persona.
     * Estos son los datos que intentaremos recuperar desde cualquier identificación, no solo INE.
     */
    const personaFieldDefinitions = [
        {
            key: "nombres",
            label: "Nombres",
            dbTarget: "nombres",
            aliases: ["nombres", "nombre", "nombre_completo", "name", "names", "given_names", "first_name"]
        },
        {
            key: "apellido_paterno",
            label: "Apellido paterno",
            dbTarget: "apellido_paterno",
            aliases: ["apellido_paterno", "primer_apellido", "paternal_surname", "last_name", "first_surname"]
        },
        {
            key: "apellido_materno",
            label: "Apellido materno",
            dbTarget: "apellido_materno",
            aliases: ["apellido_materno", "segundo_apellido", "maternal_surname", "second_last_name", "second_surname"]
        },
        {
            key: "fecha_nacimiento",
            label: "Fecha nacimiento",
            dbTarget: "fecha_nacimiento",
            aliases: ["fecha_nacimiento", "fecha_de_nacimiento", "nacimiento", "date_of_birth", "dob", "birth_date"]
        },
        {
            key: "sexo",
            label: "Sexo",
            dbTarget: "sexo",
            aliases: ["sexo", "genero", "género", "gender", "sex"]
        },
        {
            key: "curp",
            label: "CURP",
            dbTarget: "curp_hash / curp_enc",
            aliases: ["curp"]
        },
        {
            key: "clave_elector",
            label: "Clave elector",
            dbTarget: "clave_elector_hash / clave_elector_enc",
            aliases: ["clave_elector", "clave_de_elector", "elector_key", "voter_key"]
        },
        {
            key: "seccion_id",
            label: "Sección",
            dbTarget: "seccion_id",
            aliases: ["seccion_id", "seccion", "sección", "electoral_section", "section"]
        },
        {
            key: "anio_registro",
            label: "Año registro",
            dbTarget: "anio_registro",
            aliases: ["anio_registro", "año_registro", "ano_registro", "año_de_registro", "anio_de_registro", "registration_year"]
        },
        {
            key: "emision",
            label: "Emisión",
            dbTarget: "emision",
            aliases: ["emision", "emisión", "numero_emision", "numero_de_emision", "issue_number"]
        },
        {
            key: "vigencia_inicio",
            label: "Vigencia inicio",
            dbTarget: "vigencia_inicio",
            aliases: ["vigencia_inicio", "inicio_vigencia", "valid_from", "validity_start"]
        },
        {
            key: "vigencia_fin",
            label: "Vigencia fin",
            dbTarget: "vigencia_fin",
            aliases: ["vigencia_fin", "fin_vigencia", "vigencia", "valid_until", "validity_end", "expiration_date"]
        },
        {
            key: "ocr",
            label: "OCR",
            dbTarget: "ocr_hash",
            aliases: ["ocr", "ocr_number", "numero_ocr", "número_ocr"]
        },
        {
            key: "cic",
            label: "CIC",
            dbTarget: "cic_hash",
            aliases: ["cic"]
        },
        {
            key: "idmex",
            label: "IDMEX",
            dbTarget: "idmex_hash",
            aliases: ["idmex", "id_mex", "idméx", "id_mx"]
        },
        {
            key: "domicilio_texto",
            label: "Domicilio completo",
            dbTarget: "domicilio_texto",
            aliases: ["domicilio_texto", "domicilio", "domicilio_completo", "direccion", "dirección", "address", "full_address"]
        },
        {
            key: "calle",
            label: "Calle",
            dbTarget: "calle",
            aliases: ["calle", "street", "street_name"]
        },
        {
            key: "numero_exterior",
            label: "Número exterior",
            dbTarget: "numero_exterior",
            aliases: ["numero_exterior", "número_exterior", "num_ext", "exterior", "external_number", "street_number"]
        },
        {
            key: "numero_interior",
            label: "Número interior",
            dbTarget: "numero_interior",
            aliases: ["numero_interior", "número_interior", "num_int", "interior", "internal_number", "apartment"]
        },
        {
            key: "colonia",
            label: "Colonia",
            dbTarget: "colonia",
            aliases: ["colonia", "neighborhood", "settlement", "suburb"]
        },
        {
            key: "localidad",
            label: "Localidad",
            dbTarget: "localidad",
            aliases: ["localidad", "locality", "city_area"]
        },
        {
            key: "municipio",
            label: "Municipio",
            dbTarget: "municipio",
            aliases: ["municipio", "delegacion", "delegación", "city", "municipality"]
        },
        {
            key: "estado",
            label: "Estado",
            dbTarget: "estado",
            aliases: ["estado", "state", "province"]
        },
        {
            key: "codigo_postal",
            label: "Código postal",
            dbTarget: "codigo_postal",
            aliases: ["codigo_postal", "código_postal", "cp", "c.p.", "postal_code", "zip"]
        },
        {
            key: "telefono",
            label: "Teléfono",
            dbTarget: "telefono",
            aliases: ["telefono", "teléfono", "phone", "telephone"]
        },
        {
            key: "whatsapp",
            label: "WhatsApp",
            dbTarget: "whatsapp",
            aliases: ["whatsapp", "wa"]
        },
        {
            key: "email",
            label: "Email",
            dbTarget: "email",
            aliases: ["email", "correo", "correo_electronico", "correo_electrónico", "mail"]
        }
    ];

    imageInput.addEventListener("change", handleImageUpload);
    startCameraButton.addEventListener("click", startCamera);
    captureButton.addEventListener("click", capturePhoto);
    stopCameraButton.addEventListener("click", stopCamera);
    rotateLeftButton.addEventListener("click", () => rotateImage(-90));
    rotateRightButton.addEventListener("click", () => rotateImage(90));
    ocrAutoButton.addEventListener("click", runOcrAllImagesAutoOrientation);
    ocrButton.addEventListener("click", runOcrCurrentOrientation);
    clearButton.addEventListener("click", clearAll);
    analyzeWatsonxButton.addEventListener("click", analyzeWithWatsonx);
    analyzeOpenAIButton.addEventListener("click", analyzeWithOpenAI);

    rawText.addEventListener("input", () => {
        analyzeWatsonxButton.disabled = rawText.value.trim() === "";
    });

    function setStatus(element, message, type = "") {
        element.className = "status";

        if (type) {
            element.classList.add(type);
        }

        element.textContent = message;
    }

    function enableImageActions(enabled) {
        rotateLeftButton.disabled = !enabled;
        rotateRightButton.disabled = !enabled;
        ocrAutoButton.disabled = !enabled;
        ocrButton.disabled = !enabled;
        analyzeOpenAIButton.disabled = !enabled;
    }

    function syncActiveImageGlobals() {
        const item = getActiveImageItem();

        if (!item) {
            originalImage = null;
            rotationAngle = 0;
            currentImageDataUrl = null;
            preview.src = "";
            preview.style.display = "none";
            return;
        }

        originalImage = item.image;
        rotationAngle = item.rotationAngle;
        renderPreviewFromOriginal();
    }

    function getActiveImageItem() {
        if (activeImageIndex < 0 || activeImageIndex >= documentImages.length) {
            return null;
        }

        return documentImages[activeImageIndex];
    }

    function addDocumentImage(image, sourceName = "") {
        const nextNumber = documentImages.length + 1;

        let label = "Imagen " + nextNumber;

        if (nextNumber === 1) {
            label = "Frente / Imagen 1";
        } else if (nextNumber === 2) {
            label = "Reverso / Imagen 2";
        }

        documentImages.push({
            id: Date.now() + "_" + Math.random().toString(36).slice(2),
            label: label,
            sourceName: sourceName || label,
            image: image,
            rotationAngle: 0,
            previewDataUrl: null
        });

        activeImageIndex = documentImages.length - 1;

        providerResults.watsonx = null;
        providerResults.openai = null;

        renderImageList();
        syncActiveImageGlobals();

        enableImageActions(documentImages.length > 0);

        fieldsBody.innerHTML = "";
        fieldsTable.style.display = "none";
        jsonOutput.textContent = "{}";
        documentSummary.innerHTML = "";

        setStatus(
            ocrStatus,
            `Imagen agregada correctamente. Total de imágenes: ${documentImages.length}.\nPuedes agregar frente y reverso para complementar información.`,
            "success"
        );

        setStatus(
            analyzeStatus,
            "Imagen lista. OpenAI puede analizar todas las imágenes. Para watsonx ejecuta OCR.",
            "warning"
        );
    }

    function renderImageList() {
        imageList.innerHTML = "";

        documentImages.forEach((item, index) => {
            const thumb = document.createElement("div");
            thumb.className = "image-thumb" + (index === activeImageIndex ? " active" : "");

            const thumbDataUrl = buildRotatedImageDataUrlForItem(item, false, 320);

            item.previewDataUrl = thumbDataUrl;

            thumb.innerHTML = `
                <button type="button" class="thumb-remove" title="Eliminar imagen">×</button>
                <img src="${thumbDataUrl}" alt="${escapeHtml(item.label)}">
                <div class="image-thumb-title">${escapeHtml(item.label)}</div>
                <div class="image-thumb-subtitle">Rotación: ${item.rotationAngle}°</div>
            `;

            thumb.addEventListener("click", () => {
                activeImageIndex = index;
                syncActiveImageGlobals();
                renderImageList();
                setStatus(ocrStatus, `Imagen activa: ${item.label}`, "success");
            });

            const removeButton = thumb.querySelector(".thumb-remove");

            removeButton.addEventListener("click", (event) => {
                event.stopPropagation();
                removeDocumentImage(index);
            });

            imageList.appendChild(thumb);
        });
    }

    function removeDocumentImage(index) {
        documentImages.splice(index, 1);

        if (documentImages.length === 0) {
            activeImageIndex = -1;
            syncActiveImageGlobals();
            enableImageActions(false);
            analyzeOpenAIButton.disabled = true;
            analyzeWatsonxButton.disabled = rawText.value.trim() === "";
            setStatus(ocrStatus, "No hay imágenes cargadas.", "warning");
        } else {
            if (activeImageIndex >= documentImages.length) {
                activeImageIndex = documentImages.length - 1;
            }

            if (activeImageIndex < 0) {
                activeImageIndex = 0;
            }

            syncActiveImageGlobals();
            enableImageActions(true);
            setStatus(ocrStatus, `Imagen eliminada. Total de imágenes: ${documentImages.length}.`, "success");
        }

        providerResults.watsonx = null;
        providerResults.openai = null;

        renderImageList();
        renderComparisonTable();
        renderComparisonJson();
    }

    function handleImageUpload(event) {
        const files = Array.from(event.target.files || []);

        if (files.length === 0) {
            return;
        }

        loadImagesFromFiles(files);
    }

    async function loadImagesFromFiles(files) {
        for (const file of files) {
            try {
                const dataUrl = await readFileAsDataUrl(file);
                const image = await createImageFromDataUrl(dataUrl);
                addDocumentImage(image, file.name);
            } catch (error) {
                setStatus(ocrStatus, "No se pudo cargar una imagen: " + error.message, "error");
            }
        }

        imageInput.value = "";
    }

    function readFileAsDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = function(e) {
                resolve(e.target.result);
            };

            reader.onerror = function() {
                reject(new Error("No se pudo leer el archivo."));
            };

            reader.readAsDataURL(file);
        });
    }

    function createImageFromDataUrl(dataUrl) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = function() {
                resolve(img);
            };

            img.onerror = function() {
                reject(new Error("No se pudo cargar la imagen."));
            };

            img.src = dataUrl;
        });
    }

    async function startCamera() {
        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment",
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            });

            video.srcObject = mediaStream;
            video.style.display = "block";

            captureButton.disabled = false;
            stopCameraButton.disabled = false;
            startCameraButton.disabled = true;

            setStatus(
                ocrStatus,
                "Cámara activa. Toma foto del frente y luego del reverso si aplica.",
                "success"
            );

        } catch (error) {
            setStatus(ocrStatus, "No se pudo abrir la cámara: " + error.message, "error");
        }
    }

    async function capturePhoto() {
        if (!mediaStream) {
            setStatus(ocrStatus, "La cámara no está activa.", "error");
            return;
        }

        const width = video.videoWidth;
        const height = video.videoHeight;

        if (!width || !height) {
            setStatus(ocrStatus, "No se pudo capturar la imagen de la cámara.", "error");
            return;
        }

        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(video, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.95);

        try {
            const image = await createImageFromDataUrl(dataUrl);
            addDocumentImage(image, "Foto cámara");
        } catch (error) {
            setStatus(ocrStatus, "No se pudo agregar la foto capturada: " + error.message, "error");
        }
    }

    function stopCamera() {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            mediaStream = null;
        }

        video.srcObject = null;
        video.style.display = "none";

        captureButton.disabled = true;
        stopCameraButton.disabled = true;
        startCameraButton.disabled = false;

        if (documentImages.length === 0) {
            setStatus(ocrStatus, "Cámara cerrada.");
        }
    }

    function rotateImage(degrees) {
        const item = getActiveImageItem();

        if (!item) {
            setStatus(ocrStatus, "Primero carga o captura una imagen.", "error");
            return;
        }

        item.rotationAngle = normalizeAngle(item.rotationAngle + degrees);
        rotationAngle = item.rotationAngle;

        renderPreviewFromOriginal();
        renderImageList();

        providerResults.openai = null;

        renderComparisonTable();
        renderComparisonJson();

        setStatus(
            ocrStatus,
            `Imagen activa girada a ${item.rotationAngle}°.\nOpenAI usará todas las imágenes con su rotación actual.`,
            "success"
        );
    }

    function normalizeAngle(angle) {
        let normalized = angle % 360;

        if (normalized < 0) {
            normalized += 360;
        }

        return normalized;
    }

    function renderPreviewFromOriginal() {
        const item = getActiveImageItem();

        if (!item) {
            preview.src = "";
            preview.style.display = "none";
            return;
        }

        currentImageDataUrl = buildRotatedImageDataUrlForItem(item, false, 1600);
        preview.src = currentImageDataUrl;
        preview.style.display = "block";
    }

    function buildRotatedImageDataUrlForItem(item, preprocessForOcr = false, maxSideOverride = null) {
        return buildRotatedImageDataUrlFromImage(
            item.image,
            item.rotationAngle,
            preprocessForOcr,
            maxSideOverride
        );
    }

    function buildRotatedImageDataUrlFromImage(image, angle, preprocessForOcr = false, maxSideOverride = null) {
        const normalizedAngle = normalizeAngle(angle);

        const sourceWidth = image.naturalWidth || image.width;
        const sourceHeight = image.naturalHeight || image.height;

        const isSideways = normalizedAngle === 90 || normalizedAngle === 270;

        let targetWidth = isSideways ? sourceHeight : sourceWidth;
        let targetHeight = isSideways ? sourceWidth : sourceHeight;

        const maxSide = maxSideOverride || (preprocessForOcr ? 2200 : 1600);
        const scale = Math.min(1, maxSide / Math.max(targetWidth, targetHeight));

        targetWidth = Math.round(targetWidth * scale);
        targetHeight = Math.round(targetHeight * scale);

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        ctx.save();

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, targetWidth, targetHeight);

        ctx.translate(targetWidth / 2, targetHeight / 2);
        ctx.rotate(normalizedAngle * Math.PI / 180);

        const drawWidth = Math.round(sourceWidth * scale);
        const drawHeight = Math.round(sourceHeight * scale);

        ctx.drawImage(
            image,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight
        );

        ctx.restore();

        if (preprocessForOcr) {
            preprocessCanvasForOcr(ctx, targetWidth, targetHeight);
        }

        return canvas.toDataURL("image/jpeg", preprocessForOcr ? 0.98 : 0.92);
    }

    /*
     * Compatibilidad con código anterior.
     */
    function buildRotatedImageDataUrl(image, angle, preprocessForOcr = false) {
        return buildRotatedImageDataUrlFromImage(image, angle, preprocessForOcr, null);
    }

    function preprocessCanvasForOcr(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        /*
         * Preprocesamiento simple:
         * - Escala de grises
         * - Aumento de contraste
         * - Umbral suave para mejorar texto oscuro sobre fondo claro
         */
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            let gray = (0.299 * r) + (0.587 * g) + (0.114 * b);

            gray = ((gray - 128) * 1.45) + 128;
            gray = gray + 8;
            gray = Math.max(0, Math.min(255, gray));

            if (gray > 185) {
                gray = 255;
            } else if (gray < 90) {
                gray = 0;
            }

            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }

        ctx.putImageData(imageData, 0, 0);
    }

    async function runOcrCurrentOrientation() {
        const item = getActiveImageItem();

        if (!item) {
            setStatus(ocrStatus, "Primero carga o captura una imagen.", "error");
            return;
        }

        providerResults.watsonx = null;

        analyzeWatsonxButton.disabled = true;
        ocrButton.disabled = true;
        ocrAutoButton.disabled = true;

        renderComparisonTable();
        renderComparisonJson();

        setStatus(ocrStatus, `Procesando OCR de ${item.label} con orientación ${item.rotationAngle}°...`);

        try {
            const ocrImageDataUrl = buildRotatedImageDataUrlForItem(item, true, 2200);
            preview.src = ocrImageDataUrl;

            const result = await recognizeImage(ocrImageDataUrl, item.rotationAngle, false);

            const sectionText = buildOcrSectionText(item, result.text);

            rawText.value = sectionText.trim();
            analyzeWatsonxButton.disabled = rawText.value.trim() === "";

            if (rawText.value.trim() === "") {
                setStatus(ocrStatus, "No se detectó texto. Intenta girar la imagen o tomar otra foto.", "error");
            } else {
                setStatus(
                    ocrStatus,
                    `Texto detectado correctamente en ${item.label}.\nOrientación usada: ${item.rotationAngle}°\nScore: ${result.score.toFixed(2)}\nConfianza OCR: ${result.confidence.toFixed(2)}`,
                    "success"
                );

                setStatus(
                    analyzeStatus,
                    "Texto OCR listo. Puedes analizarlo con watsonx o comparar usando OpenAI.",
                    "success"
                );
            }

        } catch (error) {
            setStatus(ocrStatus, "Error al hacer OCR: " + error.message, "error");
        } finally {
            ocrButton.disabled = false;
            ocrAutoButton.disabled = false;
        }
    }

    async function runOcrAllImagesAutoOrientation() {
        if (documentImages.length === 0) {
            setStatus(ocrStatus, "Primero carga o captura una o más imágenes.", "error");
            return;
        }

        rawText.value = "";
        providerResults.watsonx = null;

        analyzeWatsonxButton.disabled = true;
        ocrButton.disabled = true;
        ocrAutoButton.disabled = true;
        rotateLeftButton.disabled = true;
        rotateRightButton.disabled = true;
        analyzeOpenAIButton.disabled = true;

        renderComparisonTable();
        renderComparisonJson();

        const allSections = [];
        const globalScoreLines = [];

        try {
            for (let imgIndex = 0; imgIndex < documentImages.length; imgIndex++) {
                const item = documentImages[imgIndex];
                const angles = [item.rotationAngle, 0, 90, 180, 270]
                    .filter((angle, index, array) => array.indexOf(angle) === index);

                const results = [];

                for (let i = 0; i < angles.length; i++) {
                    const angle = angles[i];

                    setStatus(
                        ocrStatus,
                        `Procesando ${item.label} (${imgIndex + 1} de ${documentImages.length})\nProbando orientación ${angle}° (${i + 1} de ${angles.length})...`
                    );

                    const tmpItem = {
                        ...item,
                        rotationAngle: angle
                    };

                    const ocrImageDataUrl = buildRotatedImageDataUrlForItem(tmpItem, true, 2200);
                    const result = await recognizeImage(ocrImageDataUrl, angle, true);

                    results.push(result);
                }

                results.sort((a, b) => b.score - a.score);

                const best = results[0];

                item.rotationAngle = best.angle;

                const sectionText = buildOcrSectionText(item, best.text);
                allSections.push(sectionText);

                const scoreLines = results.map(resultItem => {
                    return `${item.label} ${resultItem.angle}° -> score ${resultItem.score.toFixed(2)}, confianza ${resultItem.confidence.toFixed(2)}, keywords ${resultItem.keywordHits}`;
                });

                globalScoreLines.push(...scoreLines);
            }

            activeImageIndex = Math.min(activeImageIndex < 0 ? 0 : activeImageIndex, documentImages.length - 1);
            syncActiveImageGlobals();
            renderImageList();

            rawText.value = allSections.join("\n\n").trim();
            analyzeWatsonxButton.disabled = rawText.value.trim() === "";

            if (rawText.value.trim() === "") {
                setStatus(ocrStatus, "No se detectó texto en ninguna imagen. Intenta con fotos más claras.", "error");
                return;
            }

            setStatus(
                ocrStatus,
                `OCR completado para ${documentImages.length} imagen(es).\n\nResultados:\n${globalScoreLines.join("\n")}`,
                "success"
            );

            setStatus(
                analyzeStatus,
                "Texto OCR combinado listo. Puedes analizarlo con watsonx o comparar usando OpenAI.",
                "success"
            );

        } catch (error) {
            setStatus(ocrStatus, "Error al hacer OCR automático: " + error.message, "error");
        } finally {
            ocrButton.disabled = documentImages.length === 0;
            ocrAutoButton.disabled = documentImages.length === 0;
            rotateLeftButton.disabled = documentImages.length === 0;
            rotateRightButton.disabled = documentImages.length === 0;
            analyzeOpenAIButton.disabled = documentImages.length === 0;
        }
    }

    function buildOcrSectionText(item, text) {
        return [
            "========================================",
            `IMAGEN: ${item.label}`,
            `ORIENTACION: ${item.rotationAngle} grados`,
            "TIPO: frente/reverso/complemento de identificación",
            "========================================",
            text || ""
        ].join("\n");
    }

    async function recognizeImage(imageDataUrl, angle, quietMode) {
        const result = await Tesseract.recognize(
            imageDataUrl,
            "spa+eng",
            {
                logger: function(message) {
                    if (quietMode) {
                        return;
                    }

                    if (message.status && typeof message.progress === "number") {
                        const percent = Math.round(message.progress * 100);
                        setStatus(ocrStatus, `OCR ${angle}°: ${message.status} ${percent}%`);
                    }
                }
            }
        );

        const text = result?.data?.text || "";
        const confidence = Number(result?.data?.confidence || 0);
        const keywordHits = countDocumentKeywords(text);
        const usefulLength = countUsefulCharacters(text);

        const score =
            confidence +
            Math.min(usefulLength / 12, 45) +
            (keywordHits * 18);

        return {
            angle,
            text,
            confidence,
            keywordHits,
            usefulLength,
            score
        };
    }

    function countDocumentKeywords(text) {
        const value = normalizeText(text);

        const keywords = [
            "nombre",
            "domicilio",
            "curp",
            "clave de elector",
            "clave elector",
            "fecha de nacimiento",
            "nacimiento",
            "seccion",
            "sexo",
            "vigencia",
            "instituto nacional electoral",
            "mexico",
            "credencial para votar",
            "pasaporte",
            "licencia",
            "address",
            "name",
            "date of birth",
            "document",
            "id",
            "idmex",
            "cic",
            "ocr"
        ];

        let count = 0;

        keywords.forEach(keyword => {
            if (value.includes(normalizeText(keyword))) {
                count++;
            }
        });

        return count;
    }

    function countUsefulCharacters(text) {
        return text
            .replace(/\s+/g, "")
            .replace(/[^\p{L}\p{N}]/gu, "")
            .length;
    }

    async function analyzeWithWatsonx() {
        const text = rawText.value.trim();

        if (!text) {
            setStatus(analyzeStatus, "No hay texto OCR para analizar con watsonx.", "error");
            return;
        }

        analyzeWatsonxButton.disabled = true;
        setStatus(analyzeStatus, "Analizando texto OCR combinado con watsonx...");

        try {
            const response = await fetch("extract_identificacion.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    raw_text: text
                })
            });

            const rawResponse = await response.text();

            let data;

            try {
                data = JSON.parse(rawResponse);
            } catch (jsonError) {
                setStatus(analyzeStatus, "El backend de watsonx respondió algo que no es JSON.", "error");
                jsonOutput.textContent = rawResponse;
                return;
            }

            if (!response.ok || !data.ok) {
                setStatus(analyzeStatus, data.error || "Error al analizar con watsonx.", "error");
                jsonOutput.textContent = JSON.stringify(data, null, 2);
                return;
            }

            if (!data.result.provider) {
                data.result.provider = "watsonx";
            }

            renderStructuredData(data.result);
            setStatus(analyzeStatus, "Análisis con watsonx completado.", "success");

        } catch (error) {
            setStatus(analyzeStatus, "Error de conexión con backend watsonx: " + error.message, "error");
        } finally {
            analyzeWatsonxButton.disabled = rawText.value.trim() === "";
        }
    }

    async function analyzeWithOpenAI() {
        if (documentImages.length === 0) {
            setStatus(analyzeStatus, "Primero carga o captura una o más imágenes.", "error");
            return;
        }

        analyzeOpenAIButton.disabled = true;
        setStatus(analyzeStatus, "Analizando todas las imágenes directamente con OpenAI...");

        try {
            /*
             * Se manda una imagen compuesta con todas las imágenes cargadas.
             * No usamos versión blanco/negro porque OpenAI puede aprovechar detalles visuales.
             */
            const imageDataUrl = buildCompositeImageDataUrl(false);

            const response = await fetch("extract_identificacion_openai.php", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    image_data_url: imageDataUrl,
                    raw_text: rawText.value.trim()
                })
            });

            const rawResponse = await response.text();

            let data;

            try {
                data = JSON.parse(rawResponse);
            } catch (jsonError) {
                setStatus(analyzeStatus, "El backend de OpenAI respondió algo que no es JSON.", "error");
                jsonOutput.textContent = rawResponse;
                return;
            }

            if (!response.ok || !data.ok) {
                setStatus(analyzeStatus, data.error || "Error al analizar con OpenAI.", "error");
                jsonOutput.textContent = JSON.stringify(data, null, 2);
                return;
            }

            if (!data.result.provider) {
                data.result.provider = "openai";
            }

            renderStructuredData(data.result);
            setStatus(analyzeStatus, "Análisis con OpenAI completado.", "success");

        } catch (error) {
            setStatus(analyzeStatus, "Error de conexión con backend OpenAI: " + error.message, "error");
        } finally {
            analyzeOpenAIButton.disabled = documentImages.length === 0;
        }
    }

    function buildCompositeImageDataUrl(preprocessForOcr = false) {
        if (documentImages.length === 0) {
            throw new Error("No hay imágenes para componer.");
        }

        const maxWidth = 1800;
        const padding = 40;
        const labelHeight = 50;
        const gap = 40;

        const prepared = documentImages.map((item) => {
            const normalizedAngle = normalizeAngle(item.rotationAngle);
            const sourceWidth = item.image.naturalWidth || item.image.width;
            const sourceHeight = item.image.naturalHeight || item.image.height;
            const isSideways = normalizedAngle === 90 || normalizedAngle === 270;

            const rotatedWidth = isSideways ? sourceHeight : sourceWidth;
            const rotatedHeight = isSideways ? sourceWidth : sourceHeight;

            const scale = Math.min(1, (maxWidth - (padding * 2)) / rotatedWidth);

            return {
                item,
                normalizedAngle,
                sourceWidth,
                sourceHeight,
                drawWidth: Math.round(sourceWidth * scale),
                drawHeight: Math.round(sourceHeight * scale),
                rotatedWidth: Math.round(rotatedWidth * scale),
                rotatedHeight: Math.round(rotatedHeight * scale),
                scale
            };
        });

        const canvasWidth = maxWidth;
        const canvasHeight =
            padding +
            prepared.reduce((sum, data) => {
                return sum + labelHeight + data.rotatedHeight + gap;
            }, 0);

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        let currentY = padding;

        prepared.forEach((data, index) => {
            const item = data.item;

            ctx.fillStyle = "#111827";
            ctx.font = "bold 30px Arial";
            ctx.fillText(`${index + 1}. ${item.label}`, padding, currentY + 32);

            currentY += labelHeight;

            const x = Math.round((canvasWidth - data.rotatedWidth) / 2);
            const y = currentY;

            ctx.save();

            ctx.translate(x + data.rotatedWidth / 2, y + data.rotatedHeight / 2);
            ctx.rotate(data.normalizedAngle * Math.PI / 180);

            ctx.drawImage(
                item.image,
                -data.drawWidth / 2,
                -data.drawHeight / 2,
                data.drawWidth,
                data.drawHeight
            );

            ctx.restore();

            currentY += data.rotatedHeight + gap;
        });

        if (preprocessForOcr) {
            preprocessCanvasForOcr(ctx, canvasWidth, canvasHeight);
        }

        return canvas.toDataURL("image/jpeg", preprocessForOcr ? 0.98 : 0.92);
    }

    function renderStructuredData(result) {
        const safeResult = result || {};
        const provider = normalizeProvider(safeResult.provider);

        if (provider === "openai") {
            providerResults.openai = safeResult;
        } else {
            providerResults.watsonx = safeResult;
        }

        renderProviderSummary();
        renderComparisonTable();
        renderComparisonJson();
    }

    function normalizeProvider(provider) {
        const value = normalizeText(provider || "");

        if (value.includes("openai") || value.includes("open ia")) {
            return "openai";
        }

        return "watsonx";
    }

    function renderProviderSummary() {
        const watsonxStatus = providerResults.watsonx
            ? `${providerResults.watsonx.document_type || "Documento"} / ${providerResults.watsonx.country || "País no detectado"} / Calidad: ${providerResults.watsonx.raw_text_quality || "N/D"}`
            : "Pendiente";

        const openaiStatus = providerResults.openai
            ? `${providerResults.openai.document_type || "Documento"} / ${providerResults.openai.country || "País no detectado"} / Calidad: ${providerResults.openai.raw_text_quality || "N/D"}`
            : "Pendiente";

        documentSummary.innerHTML = `
            <div class="status success">
                <span class="provider-pill watsonx">watsonx</span>
                ${escapeHtml(watsonxStatus)}
                <br>
                <span class="provider-pill openai">OpenAI</span>
                ${escapeHtml(openaiStatus)}
            </div>
        `;
    }

    function renderComparisonTable() {
        const watsonxMap = buildPersonaFieldMap(providerResults.watsonx);
        const openaiMap = buildPersonaFieldMap(providerResults.openai);

        fieldsBody.innerHTML = "";

        personaFieldDefinitions.forEach(fieldDef => {
            const watsonxField = watsonxMap[fieldDef.key] || null;
            const openaiField = openaiMap[fieldDef.key] || null;

            const watsonxValue = watsonxField?.value ?? "";
            const openaiValue = openaiField?.value ?? "";

            const suggested = chooseSuggestedValue(watsonxField, openaiField);
            const conflict = hasConflict(watsonxValue, openaiValue);

            const watsonxClass = watsonxValue === "" ? "value-empty" : (conflict ? "value-conflict" : "");
            const openaiClass = openaiValue === "" ? "value-empty" : (conflict ? "value-conflict" : "");

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>
                    <span class="field-label">${escapeHtml(fieldDef.label)}</span>
                </td>
                <td>
                    <span class="field-target">${escapeHtml(fieldDef.dbTarget)}</span>
                </td>
                <td class="${watsonxClass}">
                    ${escapeHtml(watsonxValue === "" ? "Sin dato" : watsonxValue)}
                    ${renderSmallLabel(watsonxField)}
                </td>
                <td>${escapeHtml(formatConfidence(watsonxField?.confidence))}</td>
                <td class="${openaiClass}">
                    ${escapeHtml(openaiValue === "" ? "Sin dato" : openaiValue)}
                    ${renderSmallLabel(openaiField)}
                </td>
                <td>${escapeHtml(formatConfidence(openaiField?.confidence))}</td>
                <td class="value-suggested">
                    ${escapeHtml(suggested === "" ? "Sin sugerencia" : suggested)}
                </td>
            `;

            fieldsBody.appendChild(tr);
        });

        fieldsTable.style.display = "table";
    }

    function buildPersonaFieldMap(providerResult) {
        const map = {};

        if (!providerResult || !Array.isArray(providerResult.fields)) {
            return map;
        }

        providerResult.fields.forEach(field => {
            if (!field || typeof field !== "object") {
                return;
            }

            const rawFieldName = field.field_name || "";
            const rawLabel = field.label_detected || "";
            const targetKey = resolvePersonaFieldKey(rawFieldName, rawLabel);

            if (!targetKey) {
                return;
            }

            const value = normalizeFieldValue(field.value);

            if (value === "") {
                return;
            }

            const confidence = normalizeConfidence(field.confidence);

            /*
             * Si el proveedor manda dos veces el mismo campo,
             * nos quedamos con el de mayor confianza.
             */
            if (!map[targetKey] || confidence > normalizeConfidence(map[targetKey].confidence)) {
                map[targetKey] = {
                    field_name: field.field_name || targetKey,
                    label_detected: field.label_detected || "",
                    value: value,
                    confidence: confidence
                };
            }
        });

        return map;
    }

    function resolvePersonaFieldKey(fieldName, labelDetected) {
        const normalizedFieldName = normalizeKey(fieldName);
        const normalizedLabel = normalizeKey(labelDetected);

        for (const fieldDef of personaFieldDefinitions) {
            if (normalizeKey(fieldDef.key) === normalizedFieldName) {
                return fieldDef.key;
            }

            const aliases = fieldDef.aliases || [];

            for (const alias of aliases) {
                const normalizedAlias = normalizeKey(alias);

                if (normalizedFieldName === normalizedAlias) {
                    return fieldDef.key;
                }

                if (normalizedLabel === normalizedAlias) {
                    return fieldDef.key;
                }
            }
        }

        return null;
    }

    function chooseSuggestedValue(watsonxField, openaiField) {
        const watsonxValue = normalizeFieldValue(watsonxField?.value);
        const openaiValue = normalizeFieldValue(openaiField?.value);

        if (watsonxValue === "" && openaiValue === "") {
            return "";
        }

        if (watsonxValue !== "" && openaiValue === "") {
            return watsonxValue;
        }

        if (watsonxValue === "" && openaiValue !== "") {
            return openaiValue;
        }

        if (normalizeComparableValue(watsonxValue) === normalizeComparableValue(openaiValue)) {
            return openaiValue;
        }

        const watsonxConfidence = normalizeConfidence(watsonxField?.confidence);
        const openaiConfidence = normalizeConfidence(openaiField?.confidence);

        if (openaiConfidence > watsonxConfidence) {
            return openaiValue;
        }

        if (watsonxConfidence > openaiConfidence) {
            return watsonxValue;
        }

        /*
         * Empate: preferimos OpenAI porque analiza imagen directa.
         */
        return openaiValue;
    }

    function hasConflict(watsonxValue, openaiValue) {
        const w = normalizeComparableValue(watsonxValue);
        const o = normalizeComparableValue(openaiValue);

        if (w === "" || o === "") {
            return false;
        }

        return w !== o;
    }

    function renderSmallLabel(field) {
        if (!field || !field.label_detected) {
            return "";
        }

        return `<br><small style="color:#64748b;">Etiqueta: ${escapeHtml(field.label_detected)}</small>`;
    }

    function renderComparisonJson() {
        const comparisonPayload = {
            imagenes_cargadas: documentImages.map((item, index) => ({
                index: index + 1,
                label: item.label,
                rotationAngle: item.rotationAngle,
                sourceName: item.sourceName
            })),
            watsonx: providerResults.watsonx,
            openai: providerResults.openai,
            persona_sugerida: buildSuggestedPersonaPayload(),
            notas_guardado: {
                curp: "Guardar en BD como curp_hash y curp_enc, no como texto plano.",
                clave_elector: "Guardar en BD como clave_elector_hash y clave_elector_enc, no como texto plano.",
                ocr: "Guardar en BD como ocr_hash.",
                cic: "Guardar en BD como cic_hash.",
                idmex: "Guardar en BD como idmex_hash.",
                consentimiento: "Los campos acepta_tratamiento_datos, acepta_datos_sensibles y acepta_contacto_whatsapp no deben venir de OCR; deben capturarse con consentimiento explícito.",
                campos_auditoria: "uuid, estatus_id, capturado_por, fecha_captura, created_at, created_by, updated_at y similares deben generarse por sistema."
            }
        };

        jsonOutput.textContent = JSON.stringify(comparisonPayload, null, 2);
    }

    function buildSuggestedPersonaPayload() {
        const watsonxMap = buildPersonaFieldMap(providerResults.watsonx);
        const openaiMap = buildPersonaFieldMap(providerResults.openai);

        const payload = {};

        personaFieldDefinitions.forEach(fieldDef => {
            const watsonxField = watsonxMap[fieldDef.key] || null;
            const openaiField = openaiMap[fieldDef.key] || null;
            const suggested = chooseSuggestedValue(watsonxField, openaiField);

            if (suggested !== "") {
                payload[fieldDef.key] = suggested;
            }
        });

        return payload;
    }

    function normalizeFieldValue(value) {
        if (value === null || value === undefined) {
            return "";
        }

        const text = String(value).trim();

        const normalized = normalizeText(text);

        if (
            text === "" ||
            normalized === "null" ||
            normalized === "na" ||
            normalized === "n/a" ||
            normalized === "no disponible" ||
            normalized === "sin dato" ||
            normalized === "sin datos" ||
            normalized === "no identificado" ||
            normalized === "desconocido"
        ) {
            return "";
        }

        return text;
    }

    function normalizeConfidence(value) {
        const number = Number(value);

        if (Number.isNaN(number)) {
            return 0;
        }

        if (number > 1) {
            return Math.min(number / 100, 1);
        }

        return Math.max(0, Math.min(number, 1));
    }

    function formatConfidence(value) {
        const confidence = normalizeConfidence(value);

        if (confidence === 0) {
            return "";
        }

        return Math.round(confidence * 100) + "%";
    }

    function normalizeComparableValue(value) {
        return normalizeText(value || "")
            .replace(/[^a-z0-9ñ]/g, "");
    }

    function normalizeKey(value) {
        return normalizeText(value || "")
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_ñ]/g, "");
    }

    function clearAll() {
        stopCamera();

        imageInput.value = "";

        documentImages = [];
        activeImageIndex = -1;

        originalImage = null;
        currentImageDataUrl = null;
        rotationAngle = 0;

        providerResults.watsonx = null;
        providerResults.openai = null;

        preview.src = "";
        preview.style.display = "none";
        imageList.innerHTML = "";
        rawText.value = "";

        fieldsBody.innerHTML = "";
        fieldsTable.style.display = "none";
        jsonOutput.textContent = "{}";
        documentSummary.innerHTML = "";

        enableImageActions(false);
        analyzeWatsonxButton.disabled = true;
        analyzeOpenAIButton.disabled = true;

        setStatus(ocrStatus, "Esperando imagen.");
        setStatus(analyzeStatus, "Esperando imagen o texto para analizar.");
    }

    function escapeHtml(value) {
        return value
            .toString()
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function normalizeText(text) {
        return text
            .toString()
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }
</script>

</body>
</html>