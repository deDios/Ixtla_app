// /JS/api/mediaUpload.js
(() => {
    "use strict";

    const TAG = "[mediaUpload]";
    const log = (...args) => {
        try {
            console.log(TAG, ...args);
        } catch { }
    };
    const warn = (...args) => {
        try {
            console.warn(TAG, ...args);
        } catch { }
    };

    const MIME = {
        JPG: "image/jpeg",
        PNG: "image/png",
        WEBP: "image/webp",
        HEIC: "image/heic",
        HEIF: "image/heif",
    };

    const SUPPORTED_INPUT_MIME = [MIME.JPG, MIME.PNG, MIME.WEBP];
    const BLOCKED_INPUT_MIME = [MIME.HEIC, MIME.HEIF];

    const DEFAULTS = {
        profile: "photo",
        outputType: MIME.WEBP,
        maxBytes: 900 * 1024,
        maxWidth: 1600,
        maxHeight: 1600,
        initialQuality: 0.86,
        minQuality: 0.5,
        qualityStep: 0.07,
        maxAttempts: 8,
        fileNameBase: "media",
        skipIfUnderBytes: 220 * 1024,
        preserveAlpha: true,
        forceConvertSmallFiles: false,
    };

    const PROFILE_PRESETS = {
        photo: {
            maxBytes: 850 * 1024,
            maxWidth: 1600,
            maxHeight: 1600,
            initialQuality: 0.82,
            minQuality: 0.55,
            qualityStep: 0.07,
            maxAttempts: 8,
            skipIfUnderBytes: 250 * 1024,
            forceConvertSmallFiles: false,
        },

        logo: {
            maxBytes: 450 * 1024,
            maxWidth: 1200,
            maxHeight: 1200,
            initialQuality: 0.92,
            minQuality: 0.75,
            qualityStep: 0.05,
            maxAttempts: 7,
            skipIfUnderBytes: 180 * 1024,
            forceConvertSmallFiles: false,
        },

        graphic: {
            maxBytes: 600 * 1024,
            maxWidth: 1400,
            maxHeight: 1400,
            initialQuality: 0.88,
            minQuality: 0.7,
            qualityStep: 0.05,
            maxAttempts: 7,
            skipIfUnderBytes: 200 * 1024,
            forceConvertSmallFiles: false,
        },

        icon: {
            maxBytes: 250 * 1024,
            maxWidth: 800,
            maxHeight: 800,
            initialQuality: 0.9,
            minQuality: 0.72,
            qualityStep: 0.05,
            maxAttempts: 7,
            skipIfUnderBytes: 120 * 1024,
            forceConvertSmallFiles: false,
        },

        card: {
            maxBytes: 700 * 1024,
            maxWidth: 1400,
            maxHeight: 1400,
            initialQuality: 0.84,
            minQuality: 0.6,
            qualityStep: 0.06,
            maxAttempts: 8,
            skipIfUnderBytes: 220 * 1024,
            forceConvertSmallFiles: false,
        },
    };

    function getToast() {
        return typeof window.gcToast === "function" ? window.gcToast : null;
    }

    function showToast(message, type = "warning", duration = 5000) {
        const toast = getToast();
        if (toast) {
            toast(message, type, duration);
        }
    }

    function isFile(value) {
        return value instanceof File;
    }

    function isImageFile(file) {
        return isFile(file) && /^image\//i.test(file.type || "");
    }

    function isBlockedMime(type) {
        return BLOCKED_INPUT_MIME.includes(String(type || "").toLowerCase());
    }

    function isSupportedMime(type) {
        return SUPPORTED_INPUT_MIME.includes(String(type || "").toLowerCase());
    }

    function safeBaseName(name = "media") {
        const base = String(name || "media")
            .replace(/\.[^.]+$/, "")
            .replace(/[^a-zA-Z0-9_-]/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "");

        return base || "media";
    }

    function buildWebpName(fileNameBase) {
        return `${safeBaseName(fileNameBase)}.webp`;
    }

    function mergeProfileConfig(options = {}) {
        const requestedProfile = String(options.profile || DEFAULTS.profile).trim().toLowerCase();
        const preset = PROFILE_PRESETS[requestedProfile] || PROFILE_PRESETS.photo;

        return {
            ...DEFAULTS,
            ...preset,
            ...options,
            profile: requestedProfile || DEFAULTS.profile,
            outputType: MIME.WEBP,
        };
    }

    function shouldSkipCompression(file, config) {
        if (!file || !(file.size > 0)) return false;
        if (config.forceConvertSmallFiles) return false;
        return file.size <= Number(config.skipIfUnderBytes || 0);
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
            img.onerror = () => {
                reject(
                    new Error(
                        "No se pudo procesar la imagen seleccionada. Usa JPG, PNG o WebP."
                    )
                );
            };

            img.src = src;
        });
    }

    function getScaledSize(width, height, maxWidth, maxHeight) {
        const w = Math.max(1, Number(width) || 1);
        const h = Math.max(1, Number(height) || 1);
        const mw = Math.max(1, Number(maxWidth) || w);
        const mh = Math.max(1, Number(maxHeight) || h);

        if (w <= mw && h <= mh) {
            return { width: w, height: h };
        }

        const ratio = Math.min(mw / w, mh / h);

        return {
            width: Math.max(1, Math.round(w * ratio)),
            height: Math.max(1, Math.round(h * ratio)),
        };
    }

    function drawToCanvas(img, width, height, preserveAlpha = true) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d", { alpha: preserveAlpha });
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

    async function compressCanvasToTarget(canvas, config) {
        let quality = Number(config.initialQuality) || DEFAULTS.initialQuality;
        const minQuality = Number(config.minQuality) || DEFAULTS.minQuality;
        const qualityStep = Number(config.qualityStep) || DEFAULTS.qualityStep;
        const maxAttempts = Number(config.maxAttempts) || DEFAULTS.maxAttempts;
        const maxBytes = Number(config.maxBytes) || DEFAULTS.maxBytes;
        const outputType = config.outputType || MIME.WEBP;

        let bestBlob = null;
        let attempt = 0;

        while (attempt < maxAttempts) {
            const blob = await canvasToBlob(canvas, outputType, quality);
            bestBlob = blob;

            log(
                `profile=${config.profile} attempt=${attempt + 1} size=${Math.round(
                    blob.size / 1024
                )}KB quality=${quality.toFixed(2)}`
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

        return bestBlob;
    }

    function buildOutputFile(blob, fileNameBase) {
        return new File([blob], buildWebpName(fileNameBase), {
            type: MIME.WEBP,
            lastModified: Date.now(),
        });
    }

    function validateInputFile(file) {
        if (!isFile(file)) {
            throw new Error("No se recibió un archivo válido.");
        }

        if (!isImageFile(file)) {
            throw new Error("El archivo seleccionado no es una imagen.");
        }

        const type = String(file.type || "").toLowerCase();

        if (isBlockedMime(type)) {
            throw new Error(
                "Las imágenes HEIC/HEIF no son compatibles en este flujo. Convierte tu archivo a JPG, PNG o WebP."
            );
        }

        if (!isSupportedMime(type)) {
            throw new Error("Formato no soportado. Usa JPG, PNG o WebP.");
        }
    }

    async function compressImageForUpload(file, options = {}) {
        validateInputFile(file);

        const config = mergeProfileConfig(options);
        const fileNameBase =
            config.fileNameBase || safeBaseName(file.name || DEFAULTS.fileNameBase);

        if (shouldSkipCompression(file, config)) {
            log(
                `Se omite compresión para ${file.name} (${Math.round(
                    file.size / 1024
                )}KB) por estar debajo del umbral.`
            );
            return file;
        }

        const source = await readFileAsDataURL(file);
        const img = await loadImage(source);

        const scaled = getScaledSize(
            img.naturalWidth || img.width,
            img.naturalHeight || img.height,
            config.maxWidth,
            config.maxHeight
        );

        const canvas = drawToCanvas(
            img,
            scaled.width,
            scaled.height,
            config.preserveAlpha
        );

        const blob = await compressCanvasToTarget(canvas, config);

        if (blob.size > config.maxBytes) {
            warn(
                `La imagen quedó en ${Math.round(blob.size / 1024)}KB y supera el objetivo de ${Math.round(
                    config.maxBytes / 1024
                )}KB.`
            );
        }

        return buildOutputFile(blob, fileNameBase);
    }

    async function maybeCompressImage(file, options = {}) {
        if (!isFile(file)) return file;
        if (!isImageFile(file)) return file;
        return compressImageForUpload(file, options);
    }

    function getRecommendedOptionsByContext(context = "photo", extra = {}) {
        const config = mergeProfileConfig({ profile: context, ...extra });
        return { ...config };
    }

    function validateImageBeforeUpload(file, { showFeedback = true } = {}) {
        try {
            validateInputFile(file);
            return { ok: true, error: null };
        } catch (err) {
            const message = err?.message || "No se pudo validar la imagen.";
            if (showFeedback) {
                showToast(message, "warning", 6000);
            }
            return { ok: false, error: message };
        }
    }

    window.MediaUpload = {
        compressImageForUpload,
        maybeCompressImage,
        getRecommendedOptionsByContext,
        validateImageBeforeUpload,
    };
})();