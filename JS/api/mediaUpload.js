//JS\api\mediaUpload.js

// /JS/api/mediaUpload.js
(() => {
  "use strict";

  const TAG = "[mediaUpload]";
  const log = (...args) => console.log(TAG, ...args);
  const warn = (...args) => console.warn(TAG, ...args);

  const DEFAULTS = {
    maxBytes: 900 * 1024,     // 900 KB, deja margen contra el límite de 1 MB
    maxWidth: 1600,
    maxHeight: 1600,
    outputType: "image/webp",
    initialQuality: 0.86,
    minQuality: 0.50,
    qualityStep: 0.07,
    maxAttempts: 8,
    fileNameBase: "media",
  };

  function isImageFile(file) {
    return file instanceof File && /^image\//i.test(file.type || "");
  }

  function safeBaseName(name = "media") {
    return String(name)
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "") || "media";
  }

  function renameToWebp(fileNameBase) {
    return `${safeBaseName(fileNameBase)}.webp`;
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(
          new Error(
            "No se pudo procesar la imagen. Usa JPG, PNG o WebP si el formato actual falla."
          )
        );

      img.src = src;
    });
  }

  function getScaledSize(width, height, maxWidth, maxHeight) {
    const safeWidth = Number(width) || 1;
    const safeHeight = Number(height) || 1;

    if (safeWidth <= maxWidth && safeHeight <= maxHeight) {
      return { width: safeWidth, height: safeHeight };
    }

    const ratio = Math.min(maxWidth / safeWidth, maxHeight / safeHeight);

    return {
      width: Math.max(1, Math.round(safeWidth * ratio)),
      height: Math.max(1, Math.round(safeHeight * ratio)),
    };
  }

  function drawToCanvas(img, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      throw new Error("No se pudo inicializar el canvas para procesar la imagen.");
    }

    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    return canvas;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("No se pudo generar la imagen optimizada."));
            return;
          }
          resolve(blob);
        },
        type,
        quality
      );
    });
  }

  async function compressImageForUpload(file, options = {}) {
    if (!isImageFile(file)) {
      throw new Error("El archivo seleccionado no es una imagen válida.");
    }

    const config = { ...DEFAULTS, ...options };
    const source = await readFileAsDataURL(file);
    const img = await loadImage(source);

    const scaled = getScaledSize(
      img.naturalWidth || img.width,
      img.naturalHeight || img.height,
      Number(config.maxWidth) || DEFAULTS.maxWidth,
      Number(config.maxHeight) || DEFAULTS.maxHeight
    );

    const canvas = drawToCanvas(img, scaled.width, scaled.height);

    let quality = Number(config.initialQuality) || DEFAULTS.initialQuality;
    const minQuality = Number(config.minQuality) || DEFAULTS.minQuality;
    const qualityStep = Number(config.qualityStep) || DEFAULTS.qualityStep;
    const maxAttempts = Number(config.maxAttempts) || DEFAULTS.maxAttempts;
    const maxBytes = Number(config.maxBytes) || DEFAULTS.maxBytes;
    const outputType = config.outputType || DEFAULTS.outputType;
    const outputName = renameToWebp(
      config.fileNameBase || file.name || DEFAULTS.fileNameBase
    );

    let bestBlob = null;
    let attempt = 0;

    while (attempt < maxAttempts) {
      const blob = await canvasToBlob(canvas, outputType, quality);
      bestBlob = blob;

      log(
        `Intento ${attempt + 1}: ${Math.round(blob.size / 1024)} KB, quality=${quality.toFixed(2)}`
      );

      if (blob.size <= maxBytes) {
        break;
      }

      const nextQuality = quality - qualityStep;
      if (nextQuality < minQuality) {
        break;
      }

      quality = nextQuality;
      attempt += 1;
    }

    if (!bestBlob) {
      throw new Error("No se pudo optimizar la imagen.");
    }

    if (bestBlob.size > maxBytes) {
      warn(
        `La imagen quedó en ${Math.round(bestBlob.size / 1024)} KB y supera el objetivo de ${Math.round(maxBytes / 1024)} KB.`
      );
    }

    return new File([bestBlob], outputName, {
      type: outputType,
      lastModified: Date.now(),
    });
  }

  async function maybeCompressImage(file, options = {}) {
    if (!isImageFile(file)) return file;
    return compressImageForUpload(file, options);
  }

  window.MediaUpload = {
    compressImageForUpload,
    maybeCompressImage,
  };
})();