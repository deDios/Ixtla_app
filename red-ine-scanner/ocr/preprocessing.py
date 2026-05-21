"""
Preprocesamiento de imágenes para OCR.

Genera distintas variantes de una imagen:
- Escala de grises.
- Reducción de ruido.
- Contraste.
- Threshold.
- Adaptive threshold.
- Sharpen.
- Bilateral.
- Invertida.

Estas variantes se prueban para elegir la que mejor lee Tesseract.
"""
import cv2
import numpy as np


def preprocess_variants(img):
    """
    Genera distintas versiones de la imagen para probar cuál lee mejor Tesseract.
    """
    variants = {}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    h, w = gray.shape[:2]
    target_width = 1600

    if w < target_width:
        scale = target_width / w
        gray = cv2.resize(
            gray,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_CUBIC
        )

    variants["gray"] = gray

    denoise = cv2.medianBlur(gray, 3)
    variants["denoise"] = denoise

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    contrast = clahe.apply(denoise)
    variants["contrast"] = contrast

    blur = cv2.GaussianBlur(contrast, (3, 3), 0)
    _, threshold = cv2.threshold(
        blur,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )
    variants["threshold"] = threshold

    adaptive = cv2.adaptiveThreshold(
        contrast,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        11
    )
    variants["adaptive"] = adaptive

    kernel = np.array([
        [0, -1, 0],
        [-1, 5, -1],
        [0, -1, 0]
    ])

    sharpen = cv2.filter2D(contrast, -1, kernel)
    variants["sharpen"] = sharpen

    bilateral = cv2.bilateralFilter(gray, 9, 75, 75)
    variants["bilateral"] = bilateral

    inverted = cv2.bitwise_not(threshold)
    variants["inverted"] = inverted

    return variants