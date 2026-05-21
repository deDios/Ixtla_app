"""
OCR por regiones relativas de la INE.

Define zonas aproximadas del frente de la credencial:
- Nombre.
- Domicilio.
- CURP.
- Clave de elector.
- Fecha de nacimiento.
- Sexo.
- Estado.
- Municipio.
- Sección.
- Vigencia.

Cada región se recorta, se procesa con OCR y se limpia según el tipo de campo.
"""
import re

from ocr.image_utils import crop_relative_region
from ocr.preprocessing import preprocess_variants
from ocr.tesseract_runner import run_ocr
from ocr.ine_extractors import normalize_text, normalize_ocr_code


# ==========================================================
# Layout frontal relativo
# ==========================================================
# Coordenadas relativas:
# x1, y1, x2, y2 van de 0.0 a 1.0 respecto al tamaño de la INE recortada.

INE_LAYOUT_FRONT = {
    "nombre": {
        "x1": 0.26,
        "y1": 0.16,
        "x2": 0.68,
        "y2": 0.40
    },
    "domicilio": {
        "x1": 0.26,
        "y1": 0.34,
        "x2": 0.84,
        "y2": 0.58
    },
    "clave_elector": {
        "x1": 0.26,
        "y1": 0.53,
        "x2": 0.84,
        "y2": 0.66
    },
    "curp": {
        "x1": 0.26,
        "y1": 0.60,
        "x2": 0.82,
        "y2": 0.74
    },
    "fecha_nacimiento": {
        "x1": 0.26,
        "y1": 0.68,
        "x2": 0.54,
        "y2": 0.84
    },
    "sexo": {
        "x1": 0.48,
        "y1": 0.67,
        "x2": 0.62,
        "y2": 0.84
    },
    "estado": {
        "x1": 0.58,
        "y1": 0.68,
        "x2": 0.72,
        "y2": 0.84
    },
    "municipio": {
        "x1": 0.68,
        "y1": 0.68,
        "x2": 0.84,
        "y2": 0.84
    },
    "seccion": {
        "x1": 0.78,
        "y1": 0.68,
        "x2": 0.94,
        "y2": 0.84
    },
    "localidad_emision": {
        "x1": 0.55,
        "y1": 0.78,
        "x2": 0.94,
        "y2": 0.95
    },
    "vigencia": {
        "x1": 0.64,
        "y1": 0.54,
        "x2": 0.96,
        "y2": 0.72
    }
}


# ==========================================================
# Procesamiento por regiones
# ==========================================================

def process_front_by_regions(card_img):
    """
    Lee campos del frente usando regiones relativas.
    """
    region_results = {}
    region_debug = []

    for field_name, region in INE_LAYOUT_FRONT.items():
        crop, box = crop_relative_region(card_img, region)

        if crop.size == 0:
            region_results[field_name] = ""
            region_debug.append({
                "field": field_name,
                "text": "",
                "value": "",
                "method": "",
                "score": 0,
                "box": box
            })
            continue

        variants = preprocess_variants(crop)

        best_text = ""
        best_score = -1
        best_method = ""

        for method_name, processed in variants.items():
            text = run_ocr(processed)
            clean_text = normalize_text(text)
            score = score_region_text(field_name, clean_text)

            if score > best_score:
                best_score = score
                best_text = clean_text
                best_method = method_name

        value = clean_region_value(field_name, best_text)

        # Si la región no tuvo suficiente confianza semántica,
        # no dejamos que contamine el resultado final.
        if best_score < 40:
            value = ""

        mapped_field = map_region_field(field_name)

        if mapped_field:
            region_results[mapped_field] = value

        region_debug.append({
            "field": field_name,
            "mapped_field": mapped_field,
            "text": best_text,
            "value": value,
            "method": best_method,
            "score": best_score,
            "box": box
        })

    return region_results, region_debug


def map_region_field(field_name):
    """
    Mapea regiones compuestas a campos reales del JSON.
    """
    if field_name == "localidad_emision":
        return ""

    return field_name


# ==========================================================
# Score por región
# ==========================================================

def score_region_text(field_name, text):
    score = 0

    if not text:
        return score

    score += min(len(text), 30)

    field_keywords = {
        "nombre": ["NOMBRE"],
        "domicilio": ["DOMICILIO"],
        "clave_elector": ["CLAVE", "ELECTOR"],
        "curp": ["CURP"],
        "fecha_nacimiento": ["FECHA", "NACIMIENTO"],
        "sexo": ["SEXO"],
        "estado": ["ESTADO"],
        "municipio": ["MUNICIPIO"],
        "seccion": ["SECCION"],
        "localidad_emision": ["LOCALIDAD", "EMISION"],
        "vigencia": ["VIGENCIA"]
    }

    for keyword in field_keywords.get(field_name, []):
        if keyword in text:
            score += 20

    code_text = normalize_ocr_code(text)

    if field_name == "curp":
        if re.search(r"[A-Z]{4}[0-9]{6}[HM][A-Z0-9]{6}[0-9]", code_text):
            score += 90

    if field_name == "clave_elector":
        if re.search(r"[A-Z]{6}[0-9]{8}[A-Z0-9][0-9]{3}", code_text):
            score += 90

    if field_name == "fecha_nacimiento":
        if re.search(r"\d{2}/\d{2}/\d{4}", text):
            score += 70

    if field_name in ["estado", "municipio", "seccion"]:
        if re.search(r"\b\d{2,4}\b", text):
            score += 40

    if field_name in ["localidad_emision", "vigencia"]:
        if re.search(r"20\d{2}|\b\d{4}\b", text):
            score += 40

    return score


# ==========================================================
# Limpieza por región
# ==========================================================

def clean_region_value(field_name, text):
    clean = normalize_text(text)
    code_clean = normalize_ocr_code(clean)

    if field_name == "curp":
        curp = re.search(
            r"[A-Z]{4}[0-9]{6}[HM][A-Z0-9]{6}[0-9]",
            code_clean
        )
        return curp.group(0) if curp else ""

    if field_name == "clave_elector":
        clave = re.search(
            r"[A-Z]{6}[0-9]{8}[A-Z0-9][0-9]{3}",
            code_clean
        )
        return clave.group(0) if clave else ""

    if field_name == "fecha_nacimiento":
        fecha = re.search(r"\d{2}/\d{2}/\d{4}", clean)

        if fecha:
            return fecha.group(0)

        clean = clean.replace("FECHA DE NACIMIENTO", "")
        clean = clean.replace("FECHA NACIMIENTO", "")
        return clean.strip(" .,-")

    if field_name == "sexo":
        sexo = re.search(r"\b[HM]\b", clean)
        return sexo.group(0) if sexo else ""

    if field_name == "estado":
        estado = re.search(r"\b\d{2}\b", clean)
        return estado.group(0) if estado else ""

    if field_name == "municipio":
        municipio = re.search(r"\b\d{2,3}\b", clean)
        return municipio.group(0).zfill(3) if municipio else ""

    if field_name == "seccion":
        matches = re.findall(r"\b\d{4}\b", clean)

        for item in matches:
            if not item.startswith("20"):
                return item

        return ""

    if field_name == "vigencia":
        vigencia_range = re.search(r"20\d{2}\s*[- ]\s*20\d{2}", clean)
        if vigencia_range:
            return re.sub(r"\s+", "", vigencia_range.group(0))

        years = re.findall(r"20\d{2}", clean)

        valid_years = [
            year for year in years
            if int(year) >= 2020
        ]

        return valid_years[-1] if valid_years else ""

    if field_name == "localidad_emision":
        return clean_localidad_emision(clean)

    if field_name == "nombre":
        value = clean
        value = value.replace("NOMBRE", "")
        value = re.sub(
            r"\b(MEXICO|INSTITUTO|NACIONAL|ELECTORAL|CREDENCIAL|PARA|VOTAR|FECHA|NACIMIENTO)\b",
            " ",
            value
        )
        value = re.sub(r"[^A-Z\s]", " ", value)
        value = re.sub(r"\s+", " ", value).strip()

        if len(value.split()) > 5:
            return ""

        return value

    if field_name == "domicilio":
        value = clean
        value = value.replace("DOMICILIO", "")
        value = re.sub(r"\s+", " ", value)
        return value.strip(" .,-")

    return clean


def clean_localidad_emision(text):
    """
    Extrae localidad y emisión desde una región compuesta.
    De momento regresa texto limpio para debug.
    Después lo podemos partir en localidad/emision.
    """
    return normalize_text(text)