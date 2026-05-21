"""
Ejecución de Tesseract OCR.

Contiene funciones para:
- Extraer texto completo desde una imagen.
- Extraer cajas OCR con texto, coordenadas y nivel de confianza.

Se usa tanto para el escaneo normal como para el modo diagnóstico visual.
"""
import re
import pytesseract


def run_ocr(img):
    """
    Ejecuta OCR normal y devuelve el texto completo detectado.
    """
    config = "--oem 3 --psm 6"

    try:
        return pytesseract.image_to_string(
            img,
            lang="spa",
            config=config
        )
    except Exception:
        return pytesseract.image_to_string(
            img,
            config=config
        )


def run_ocr_boxes(img):
    """
    Ejecuta OCR con cajas de texto.
    Devuelve coordenadas, texto y confianza por palabra.
    """
    config = "--oem 3 --psm 6"

    try:
        ocr_data = pytesseract.image_to_data(
            img,
            lang="spa",
            config=config,
            output_type=pytesseract.Output.DICT
        )
    except Exception:
        ocr_data = pytesseract.image_to_data(
            img,
            config=config,
            output_type=pytesseract.Output.DICT
        )

    boxes = []

    for i in range(len(ocr_data["text"])):
        text = str(ocr_data["text"][i]).strip()

        if not text:
            continue

        if len(text) <= 1:
            continue

        if re.fullmatch(r"[a-zA-Z]{1,2}", text):
            continue

        try:
            conf = float(ocr_data["conf"][i])
        except Exception:
            conf = -1

        if conf < 20:
            continue

        width = int(ocr_data["width"][i])
        height = int(ocr_data["height"][i])

        if width < 18:
            continue

        if height < 10:
            continue

        boxes.append({
            "text": text,
            "conf": round(conf, 2),
            "x": int(ocr_data["left"][i]),
            "y": int(ocr_data["top"][i]),
            "w": width,
            "h": height
        })

    return boxes