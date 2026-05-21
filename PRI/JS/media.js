(function (window) {
  "use strict";

  const TAG = "[PRI Media]";

  const DEFAULTS = {
    maxBytes: 900 * 1024,

    maxWidth: 1280,
    maxHeight: 900,
    minWidth: 520,

    startQuality: 0.78,
    minQuality: 0.42,
    qualityStep: 0.07,

    preferWebp: false,
    background: "#ffffff",

    debug: true,
  };

  const MIME_WEBP = "image/webp";
  const MIME_JPEG = "image/jpeg";

  function debugLog(enabled, ...args) {
    if (enabled) console.log(TAG, ...args);
  }

  function debugWarn(enabled, ...args) {
    if (enabled) console.warn(TAG, ...args);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No se pudo leer el archivo."));

      reader.readAsDataURL(file);
    });
  }

  function mergeOptions(options = {}) {
    return {
      ...DEFAULTS,
      ...options,
    };
  }

  async function supportsMimeEncode(mime) {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 2;

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, mime, 0.8);
    });

    return !!blob && blob.type === mime;
  }

  async function getOutputMime(options) {
    if (!options.preferWebp) return MIME_JPEG;

    const canWebp = await supportsMimeEncode(MIME_WEBP);
    return canWebp ? MIME_WEBP : MIME_JPEG;
  }

  function getExtensionFromMime(mime) {
    if (mime === MIME_WEBP) return "webp";
    if (mime === MIME_JPEG) return "jpg";
    return "jpg";
  }

  function getTargetSize(width, height, maxWidth, maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height, 1);

    return {
      width: Math.max(1, Math.round(width * ratio)),
      height: Math.max(1, Math.round(height * ratio)),
    };
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve) => {
      canvas.toBlob(resolve, mime, quality);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No se pudo leer la imagen comprimida."));

      reader.readAsDataURL(blob);
    });
  }

  function dataUrlSizeBytes(dataUrl) {
    const base64 = String(dataUrl || "").split(",")[1] || "";
    return Math.ceil((base64.length * 3) / 4);
  }

  function dataUrlSizeKB(dataUrl) {
    return Math.round(dataUrlSizeBytes(dataUrl) / 1024);
  }

  function dataUrlSizeMB(dataUrl) {
    return dataUrlSizeBytes(dataUrl) / 1024 / 1024;
  }

  function drawSourceToCanvas(source, width, height, background) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });

    if (!ctx) {
      throw new Error("No se pudo preparar la imagen.");
    }

    ctx.fillStyle = background || "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0, width, height);

    return canvas;
  }

  async function compressSourceToDataUrl(source, sourceWidth, sourceHeight, options = {}) {
    const cfg = mergeOptions(options);
    const outputMime = await getOutputMime(cfg);

    let maxWidth = cfg.maxWidth;
    let maxHeight = cfg.maxHeight;
    let lastBlob = null;
    let lastMeta = null;

    while (maxWidth >= cfg.minWidth) {
      const size = getTargetSize(sourceWidth, sourceHeight, maxWidth, maxHeight);
      const canvas = drawSourceToCanvas(source, size.width, size.height, cfg.background);

      for (
        let quality = cfg.startQuality;
        quality >= cfg.minQuality;
        quality -= cfg.qualityStep
      ) {
        const fixedQuality = Number(quality.toFixed(2));
        const blob = await canvasToBlob(canvas, outputMime, fixedQuality);

        if (!blob) continue;

        lastBlob = blob;
        lastMeta = {
          width: size.width,
          height: size.height,
          mime: blob.type,
          quality: fixedQuality,
          sizeBytes: blob.size,
          sizeKB: Math.round(blob.size / 1024),
          extension: getExtensionFromMime(blob.type),
        };

        debugLog(cfg.debug, "Imagen procesada:", lastMeta);

        if (blob.size <= cfg.maxBytes) {
          return {
            dataUrl: await blobToDataUrl(blob),
            blob,
            ...lastMeta,
            compressed: true,
            withinLimit: true,
          };
        }
      }

      maxWidth = Math.floor(maxWidth * 0.82);
      maxHeight = Math.floor(maxHeight * 0.82);
    }

    if (lastBlob) {
      debugWarn(cfg.debug, "No se llegó al peso objetivo, se usará la última compresión:", lastMeta);

      return {
        dataUrl: await blobToDataUrl(lastBlob),
        blob: lastBlob,
        ...lastMeta,
        compressed: true,
        withinLimit: lastBlob.size <= cfg.maxBytes,
      };
    }

    throw new Error("No se pudo comprimir la imagen.");
  }

  async function compressVideoFrameToDataUrl(video, options = {}) {
    if (!(video instanceof HTMLVideoElement)) {
      throw new Error("El origen no es un video válido.");
    }

    const width = video.videoWidth;
    const height = video.videoHeight;

    if (!width || !height) {
      throw new Error("El video aún no está listo para capturar.");
    }

    return compressSourceToDataUrl(video, width, height, options);
  }

  async function compressCanvasToDataUrl(canvas, options = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("El origen no es un canvas válido.");
    }

    if (!canvas.width || !canvas.height) {
      throw new Error("El canvas no tiene dimensiones válidas.");
    }

    return compressSourceToDataUrl(canvas, canvas.width, canvas.height, options);
  }

  async function compressImageElementToDataUrl(image, options = {}) {
    if (!(image instanceof HTMLImageElement)) {
      throw new Error("El origen no es una imagen válida.");
    }

    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;

    if (!width || !height) {
      throw new Error("La imagen no tiene dimensiones válidas.");
    }

    return compressSourceToDataUrl(image, width, height, options);
  }

  async function fileToImage(file) {
    if (!(file instanceof File)) {
      throw new Error("Archivo inválido.");
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No se pudo leer el archivo."));

      reader.readAsDataURL(file);
    });

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No se pudo cargar la imagen."));

      img.src = dataUrl;
    });
  }

  async function compressFileToDataUrl(file, options = {}) {
    const cfg = mergeOptions(options);

    if (!(file instanceof File)) {
      throw new Error("Archivo inválido.");
    }

    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      throw new Error("Formato no permitido. Usa JPG, PNG o WEBP.");
    }

    if (file.size <= cfg.maxBytes) {
      return {
        dataUrl: await fileToDataUrl(file),
        blob: file,
        width: null,
        height: null,
        mime: file.type,
        quality: null,
        sizeBytes: file.size,
        sizeKB: Math.round(file.size / 1024),
        extension: getExtensionFromMime(file.type),
        compressed: false,
        withinLimit: true,
        original: true,
      };
    }

    const image = await fileToImage(file);
    return compressImageElementToDataUrl(image, options);
  }

  window.PRIMedia = {
    DEFAULTS,

    MIME_WEBP,
    MIME_JPEG,

    supportsMimeEncode,
    getTargetSize,

    dataUrlSizeBytes,
    dataUrlSizeKB,
    dataUrlSizeMB,

    compressVideoFrameToDataUrl,
    compressCanvasToDataUrl,
    compressImageElementToDataUrl,
    compressFileToDataUrl,
    fileToDataUrl,
  };
})(window);