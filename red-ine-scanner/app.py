from flask import Flask, render_template, request, jsonify
import pytesseract
import cv2
import numpy as np
import re

app = Flask(__name__)

# pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe" # esta esla direccion de mi pc de escritorio.
pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Users\jacks\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"
) #esta es la direcion de tesseract en mi laptop, si lo vas a usar en tu pc cambia esta direccion por la de tu tesseract


@app.route("/")
def index():
    return render_template("scannerTest.php")


@app.route("/scan-ine", methods=["POST"])
def scan_ine():
    if "image" not in request.files:
        return jsonify({"ok": False, "error": "No se recibió imagen"}), 400

    file = request.files["image"]
    file_bytes = np.frombuffer(file.read(), np.uint8)
    img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    if img is None:
        return jsonify({"ok": False, "error": "No se pudo leer la imagen"}), 400

    card_img, crop_info = crop_card_if_possible(img)
    variants = preprocess_variants(card_img)

    ocr_results = []

    for name, processed_img in variants.items():
        text = run_ocr(processed_img)
        data = extract_ine_data(text)
        score = score_ocr_result(text, data)

        ocr_results.append({
            "method": name,
            "score": score,
            "raw_text": text,
            "data": data
        })

    best_result = max(ocr_results, key=lambda item: item["score"])
    merged_data = merge_best_data(ocr_results)

    return jsonify({
        "ok": True,
        "best_method": best_result["method"],
        "score": best_result["score"],
        "crop_info": crop_info,
        "raw_text": best_result["raw_text"],
        "data": merged_data,
        "debug_results": ocr_results
    })


def crop_card_if_possible(img):
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


def preprocess_variants(img):
    variants = {}

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    h, w = gray.shape[:2]
    target_width = 1400

    if w < target_width:
        scale = target_width / w
        gray = cv2.resize(
            gray,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_CUBIC
        )

    variants["gray"] = gray

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    contrast = clahe.apply(gray)
    variants["contrast"] = contrast

    blur = cv2.GaussianBlur(contrast, (3, 3), 0)
    _, threshold = cv2.threshold(
        blur,
        0,
        255,
        cv2.THRESH_BINARY + cv2.THRESH_OTSU
    )
    variants["threshold"] = threshold

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


def run_ocr(img):
    config = "--oem 3 --psm 6"

    try:
        return pytesseract.image_to_string(img, lang="spa", config=config)
    except Exception:
        return pytesseract.image_to_string(img, config=config)


def normalize_text(text):
    clean = text.upper()

    replacements = {
        "Á": "A",
        "É": "E",
        "Í": "I",
        "Ó": "O",
        "Ú": "U",
        "Ñ": "N",
        "VICENCA": "VIGENCIA",
        "VICENCIA": "VIGENCIA",
        "WGENCIA": "VIGENCIA",
        "WENCH": "VIGENCIA",
        "WIGENCIA": "VIGENCIA",
        "WAENCN": "VIGENCIA",
        "WOENCN": "VIGENCIA",
        "VIGENCA": "VIGENCIA",
        "CLAB": "CLAVE",
        "CURR": "CURP",
        "GURE": "CURP",
        "CREDENCIAL PARAVOTAR": "CREDENCIAL PARA VOTAR",
        "NAGIMIENTO": "NACIMIENTO",
        "AFIO": "ANIO",
        "AÑO": "ANIO",
        "MURCEIEIO": "MUNICIPIO",
        "MUNCPIO": "MUNICIPIO",
        "MUNCIPIO": "MUNICIPIO",
        "MUNICIPlO": "MUNICIPIO",
        "SECON": "SECCION",
        "SECION": "SECCION",
        "COCAUPAP": "LOCALIDAD",
        "LOCAUPAP": "LOCALIDAD",
        "LOCAUOAN": "LOCALIDAD",
        "LOCAUMO": "LOCALIDAD",
        "EWSIN": "EMISION",
        "EASION": "EMISION",
        "ENISION": "EMISION",
        "EAMADN": "EMISION",
    }

    for old, new in replacements.items():
        clean = clean.replace(old, new)

    clean = re.sub(r"\s+", " ", clean).strip()
    return clean


def normalize_ocr_code(value):
    value = value.upper()
    value = value.replace(" ", "")
    value = value.replace("O", "0")
    value = value.replace("I", "1")
    value = value.replace("L", "1")
    value = value.replace("|", "1")
    return value

def extract_ine_data(text):
    clean = normalize_text(text)
    compact = clean.replace(" ", "")
    compact_code = normalize_ocr_code(compact)

    data = empty_ine_data()

    fecha = re.search(r"\b\d{2}/\d{2}/\d{4}\b", clean)
    if fecha:
        data["fecha_nacimiento"] = fecha.group(0)
    else:
        fecha_compacta = re.search(r"\b(\d{2})(\d{2})(\d{4})\b", clean)
        if fecha_compacta:
            data["fecha_nacimiento"] = (
                f"{fecha_compacta.group(1)}/"
                f"{fecha_compacta.group(2)}/"
                f"{fecha_compacta.group(3)}"
            )

    sexo = re.search(r"SEXO\s*([HM])", clean)
    if sexo:
        data["sexo"] = sexo.group(1)

    curp = re.search(
        r"[A-Z]{4}[0-9]{6}[HM][A-Z0-9]{5}[A-Z0-9][0-9]",
        compact_code
    )
    if curp:
        data["curp"] = curp.group(0)

    clave = re.search(
        r"[A-Z]{6}[0-9]{8}[A-Z0-9][0-9]{3}",
        compact_code
    )
    if clave:
        data["clave_elector"] = clave.group(0)

    vigencia = re.search(r"VIGENCIA\s*(20\d{2})", clean)
    if vigencia:
        data["vigencia"] = vigencia.group(1)
    else:
        years = re.findall(r"\b20\d{2}\b", clean)
        if years:
            data["vigencia"] = years[-1]

    estado = re.search(r"ESTAD[O0]\s*(\d{2})", clean)
    if estado:
        data["estado"] = estado.group(1)

    municipio = re.search(r"MUNICIPIO\s*(\d{2,3})", clean)
    if municipio:
        data["municipio"] = municipio.group(1).zfill(3)

    seccion = re.search(r"SECCION\s*(\d{4})", clean)
    if seccion:
        data["seccion"] = seccion.group(1)

    localidad = re.search(r"LOCALIDAD\s*(\d{4})", clean)
    if localidad:
        data["localidad"] = localidad.group(1)

    emision = re.search(r"EMISION\s*(20\d{2})", clean)
    if emision:
        data["emision"] = emision.group(1)

    domicilio = re.search(
        r"D[O0]MICILI[O0]\s*(.*?)(CLAVE|CURP|ESTAD[O0]|LOCALIDAD|MUNICIPIO|SECCION)",
        clean
    )
    if domicilio:
        data["domicilio"] = domicilio.group(1).strip(" .,-")

    nombre = re.search(
        r"NOMBRE\s*(.*?)(D[O0]MICILI[O0]|FECHA DE NACIMIENTO|SEXO)",
        clean
    )
    if nombre:
        data["nombre"] = nombre.group(1).strip(" .,-")

    return data


def merge_best_data(ocr_results):
    merged = empty_ine_data()

    for result in sorted(ocr_results, key=lambda item: item["score"], reverse=True):
        data = result.get("data", {})

        for key in merged.keys():
            if not merged[key] and data.get(key):
                merged[key] = data[key]

    combined_text = " ".join([
        result.get("raw_text", "") for result in ocr_results
    ])

    fallback_data = extract_fallback_data(combined_text)

    for key in merged.keys():
        if not merged[key] and fallback_data.get(key):
            merged[key] = fallback_data[key]

    return merged


def extract_fallback_data(text):
    clean = normalize_text(text)
    clean_code = normalize_ocr_code(clean)

    data = empty_ine_data()

    fecha = re.search(r"(\d{2})[\/\s]?(\d{2})[\/\s]?(\d{4})", clean)
    if fecha:
        data["fecha_nacimiento"] = (
            f"{fecha.group(1)}/{fecha.group(2)}/{fecha.group(3)}"
        )

    sexo = re.search(r"SEXO\s*([HM])", clean)
    if sexo:
        data["sexo"] = sexo.group(1)

    curp_candidates = re.findall(
        r"[A-Z]{4}[0-9]{6}[HM][A-Z0-9]{6}[0-9]",
        clean_code
    )
    if curp_candidates:
        data["curp"] = curp_candidates[0]

    clave_candidates = re.findall(
        r"[A-Z]{6}[0-9]{8}[A-Z0-9][0-9]{3}",
        clean_code
    )
    if clave_candidates:
        data["clave_elector"] = clave_candidates[0]

    estado = re.search(r"ESTAD[O0]\s*(\d{2})", clean)
    if estado:
        data["estado"] = estado.group(1)

    municipio = re.search(r"MUNICIPIO\s*(\d{2,3})", clean)
    if municipio:
        data["municipio"] = municipio.group(1).zfill(3)

    seccion = re.search(r"SECCION\s*(\d{4})", clean)
    if seccion:
        data["seccion"] = seccion.group(1)

    localidad = re.search(r"LOCALIDAD\s*(\d{4})", clean)
    if localidad:
        data["localidad"] = localidad.group(1)

    emision = re.search(r"EMISION\s*(20\d{2})", clean)
    if emision:
        data["emision"] = emision.group(1)

    vigencia = re.search(r"VIGENCIA\s*(20\d{2})", clean)
    if vigencia:
        data["vigencia"] = vigencia.group(1)
    else:
        years = re.findall(r"\b20\d{2}\b", clean)
        if years:
            data["vigencia"] = years[-1]

    lines = [line.strip() for line in text.upper().splitlines() if line.strip()]
    possible_name = []

    for index, line in enumerate(lines):
        line_clean = normalize_text(line)

        if "NOMBRE" in line_clean:
            for next_line in lines[index + 1:index + 5]:
                next_clean = normalize_text(next_line)

                if any(stop in next_clean for stop in [
                    "DOMICILIO",
                    "CLAVE",
                    "CURP",
                    "FECHA",
                    "SEXO"
                ]):
                    break

                only_letters = re.sub(
                    r"[^A-ZÑÁÉÍÓÚ\s]",
                    "",
                    next_clean
                ).strip()

                if only_letters and len(only_letters) >= 3:
                    possible_name.append(only_letters)

            break

    if possible_name:
        data["nombre"] = " ".join(possible_name[:4]).strip()

    domicilio = re.search(
        r"D[O0]MICILI[O0]\s*(.*?)(CLAVE|CURP|ESTAD[O0]|LOCALIDAD|MUNICIPIO|SECCION)",
        clean
    )
    if domicilio:
        data["domicilio"] = domicilio.group(1).strip(" .,-")

    return data


def empty_ine_data():
    return {
        "nombre": "",
        "domicilio": "",
        "curp": "",
        "clave_elector": "",
        "fecha_nacimiento": "",
        "sexo": "",
        "estado": "",
        "municipio": "",
        "seccion": "",
        "localidad": "",
        "emision": "",
        "vigencia": ""
    }


def score_ocr_result(text, data):
    score = 0
    clean = normalize_text(text)

    if data["nombre"]:
        score += 20

    if data["domicilio"]:
        score += 15

    if data["curp"]:
        score += 35

    if data["clave_elector"]:
        score += 35

    if data["fecha_nacimiento"]:
        score += 15

    if data["sexo"]:
        score += 10

    if data["vigencia"]:
        score += 10

    if data["estado"]:
        score += 5

    if data["municipio"]:
        score += 5

    if data["seccion"]:
        score += 5

    if data["localidad"]:
        score += 5

    if data["emision"]:
        score += 5

    keywords = [
        "NOMBRE",
        "DOMICILIO",
        "CURP",
        "CLAVE",
        "ELECTOR",
        "SEXO",
        "VIGENCIA",
        "INSTITUTO",
        "CREDENCIAL",
        "FECHA",
        "NACIMIENTO"
    ]

    for word in keywords:
        if word in clean:
            score += 4

    letters_numbers = len(re.findall(r"[A-Z0-9]", clean))
    strange_chars = len(re.findall(r"[^A-Z0-9ÁÉÍÓÚÑ\s/<>.-]", clean))

    if letters_numbers > 0:
        noise_ratio = strange_chars / letters_numbers

        if noise_ratio > 0.35:
            score -= 25
        elif noise_ratio > 0.2:
            score -= 10

    if len(clean) > 1800 and score < 40:
        score -= 30

    score += min(len(clean) // 120, 8)

    return max(score, 0)


@app.route("/test-ocr")
def test_ocr():
    version = pytesseract.get_tesseract_version()
    return {
        "ok": True,
        "tesseract_version": str(version)
    }


if __name__ == "__main__":
    app.run(debug=True)