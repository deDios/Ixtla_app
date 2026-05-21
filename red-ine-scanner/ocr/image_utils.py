"""
Utilidades de imagen para OpenCV.

Contiene funciones para:
- Leer archivos subidos desde Flask como imágenes OpenCV.
- Detectar y recortar automáticamente la tarjeta INE.
- Recortar regiones relativas dentro de una imagen.
"""
import cv2
import numpy as np


def read_uploaded_image(file):
    """
    Convierte un archivo recibido por Flask en una imagen OpenCV.
    """
    file_bytes = np.frombuffer(file.read(), np.uint8)
    return cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)


def crop_card_if_possible(img):
    """
    Intenta detectar y recortar la credencial dentro de la foto.
    Si no logra detectar la tarjeta, regresa la imagen original.
    """
    original = img.copy()
    height, width = img.shape[:2]

    max_width = 1200
    scale = 1

    if width > max_width:
        scale = max_width / width
        img = cv2.resize(
            img,
            (int(width * scale), int(height * scale)),
            interpolation=cv2.INTER_AREA
        )

    resized_height, resized_width = img.shape[:2]

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)

    edges = cv2.Canny(gray, 40, 130)

    contours, _ = cv2.findContours(
        edges,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    candidates = []
    image_area = resized_width * resized_height

    for contour in contours:
        area = cv2.contourArea(contour)

        if area < image_area * 0.08:
            continue

        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.03 * peri, True)

        x, y, w, h = cv2.boundingRect(contour)
        ratio = w / float(h) if h else 0

        valid_card_ratio = 1.35 <= ratio <= 2.25
        valid_vertical_card_ratio = 0.44 <= ratio <= 0.75

        if len(approx) >= 4 and (valid_card_ratio or valid_vertical_card_ratio):
            candidates.append({
                "contour": contour,
                "area": area,
                "rect": (x, y, w, h),
                "ratio": ratio
            })

    if not candidates:
        return original, {
            "cropped": False,
            "reason": "No se detectó contorno de tarjeta"
        }

    best = max(candidates, key=lambda item: item["area"])
    x, y, w, h = best["rect"]

    margin_x = int(w * 0.04)
    margin_y = int(h * 0.06)

    x1 = max(0, int((x - margin_x) / scale))
    y1 = max(0, int((y - margin_y) / scale))
    x2 = min(width, int((x + w + margin_x) / scale))
    y2 = min(height, int((y + h + margin_y) / scale))

    cropped = original[y1:y2, x1:x2]

    if cropped.size == 0:
        return original, {
            "cropped": False,
            "reason": "El recorte quedó vacío"
        }

    return cropped, {
        "cropped": True,
        "box": {
            "x1": x1,
            "y1": y1,
            "x2": x2,
            "y2": y2
        },
        "ratio": round(best["ratio"], 2),
        "area": int(best["area"])
    }


def crop_relative_region(img, region):
    """
    Recorta una región usando coordenadas relativas:
    x1, y1, x2, y2 van de 0.0 a 1.0.
    """
    h, w = img.shape[:2]

    x1 = int(w * region["x1"])
    y1 = int(h * region["y1"])
    x2 = int(w * region["x2"])
    y2 = int(h * region["y2"])

    x1 = max(0, min(w, x1))
    y1 = max(0, min(h, y1))
    x2 = max(0, min(w, x2))
    y2 = max(0, min(h, y2))

    crop = img[y1:y2, x1:x2]

    return crop, {
        "x1": x1,
        "y1": y1,
        "x2": x2,
        "y2": y2
    }