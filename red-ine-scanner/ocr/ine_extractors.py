"""
Extractores y normalizadores de datos INE.

Contiene:
- Estructura base de datos detectados.
- Limpieza y normalización de texto OCR.
- Regex para CURP, clave de elector, fechas y datos numéricos.
- Extracción de nombre, domicilio y MRZ.
- Score general de calidad OCR.
"""
import re


# ==========================================================
# Estructura base
# ==========================================================

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


# ==========================================================
# Normalización
# ==========================================================

def normalize_text(text):
    clean = str(text or "").upper()

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
    value = str(value or "").upper()
    value = value.replace(" ", "")
    value = value.replace("O", "0")
    value = value.replace("I", "1")
    value = value.replace("L", "1")
    value = value.replace("|", "1")
    return value


def normalize_lines(text):
    raw_lines = str(text or "").upper().splitlines()
    lines = []

    for line in raw_lines:
        clean_line = normalize_text(line)
        clean_line = re.sub(r"\s+", " ", clean_line).strip()

        if clean_line:
            lines.append(clean_line)

    return lines


# ==========================================================
# Validaciones auxiliares
# ==========================================================

def has_stop_word(line):
    stops = [
        "DOMICILIO",
        "BOMICUO",
        "DOMICUO",
        "FECHA",
        "SEXO",
        "CLAVE",
        "ELECTOR",
        "CURP",
        "ESTADO",
        "MUNICIPIO",
        "SECCION",
        "LOCALIDAD",
        "EMISION",
        "VIGENCIA",
        "REGISTRO"
    ]

    return any(stop in line for stop in stops)


def is_valid_name_line(line):
    if not line:
        return False

    if len(line) < 3:
        return False

    if re.search(r"\d", line):
        return False

    bad_words = [
        "MEXICO",
        "INSTITUTO",
        "NACIONAL",
        "ELECTORAL",
        "CREDENCIAL",
        "PARA",
        "VOTAR",
        "FECHA",
        "SEXO",
        "DOMICILIO",
        "CLAVE",
        "ELECTOR",
        "CURP",
        "ESTADO",
        "MUNICIPIO",
        "LOCALIDAD",
        "SECCION",
        "EMISION",
        "VIGENCIA",
        "REGISTRO"
    ]

    if any(word in line for word in bad_words):
        return False

    words = line.split()

    if len(words) > 4:
        return False

    return True


# ==========================================================
# Extractores generales
# ==========================================================

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

    domicilio_lineas = extract_address_from_lines(text)
    if domicilio_lineas:
        data["domicilio"] = domicilio_lineas
    else:
        domicilio = re.search(
            r"D[O0]MICILI[O0]\s*(.*?)(CLAVE|CURP|ESTAD[O0]|LOCALIDAD|MUNICIPIO|SECCION)",
            clean
        )
        if domicilio:
            data["domicilio"] = domicilio.group(1).strip(" .,-")

    nombre_lineas = extract_name_from_lines(text)
    if nombre_lineas:
        data["nombre"] = nombre_lineas
    else:
        nombre = re.search(
            r"NOMBRE\s*(.*?)(D[O0]MICILI[O0]|FECHA DE NACIMIENTO|SEXO)",
            clean
        )
        if nombre:
            data["nombre"] = nombre.group(1).strip(" .,-")

    return data


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

    nombre_lineas = extract_name_from_lines(text)
    if nombre_lineas:
        data["nombre"] = nombre_lineas

    domicilio_lineas = extract_address_from_lines(text)
    if domicilio_lineas:
        data["domicilio"] = domicilio_lineas

    return data


# ==========================================================
# Extractores por líneas
# ==========================================================

def extract_name_from_lines(text):
    lines = normalize_lines(text)

    for index, line in enumerate(lines):
        if "NOMBRE" not in line:
            continue

        candidates = []

        for next_line in lines[index + 1:index + 6]:
            if has_stop_word(next_line):
                break

            cleaned = re.sub(r"[^A-Z\s]", " ", next_line)
            cleaned = re.sub(r"\s+", " ", cleaned).strip()

            if is_valid_name_line(cleaned):
                candidates.append(cleaned)

        if candidates:
            return " ".join(candidates[:4]).strip()

    return ""


def extract_address_from_lines(text):
    lines = normalize_lines(text)

    for index, line in enumerate(lines):
        if "DOMICILIO" not in line and "BOMICUO" not in line and "DOMICUO" not in line:
            continue

        candidates = []

        for next_line in lines[index + 1:index + 5]:
            if any(stop in next_line for stop in [
                "CLAVE",
                "CURP",
                "ESTADO",
                "LOCALIDAD",
                "MUNICIPIO",
                "SECCION"
            ]):
                break

            cleaned = re.sub(r"[^A-Z0-9\s.,#/-]", " ", next_line)
            cleaned = re.sub(r"\s+", " ", cleaned).strip()

            if len(cleaned) >= 4:
                candidates.append(cleaned)

        if candidates:
            return " ".join(candidates).strip(" .,-")

    return ""


def extract_name_from_mrz(text):
    clean = normalize_text(text)
    clean = clean.replace(" ", "")

    candidates = re.findall(r"[A-Z<]{12,}", clean)

    for line in candidates:
        if "<<" not in line:
            continue

        line = re.sub(r"[^A-Z<]", "", line)

        parts = [part for part in line.split("<") if len(part) >= 2]

        bad_parts = [
            "IDMEX",
            "MEX",
            "INE",
            "CREDENCIAL",
            "INSTITUTO",
            "NACIONAL",
            "ELECTORAL"
        ]

        parts = [
            part for part in parts
            if not any(bad in part for bad in bad_parts)
        ]

        if len(parts) >= 3:
            full_name = " ".join(parts[:4])
            full_name = re.sub(r"\s+", " ", full_name).strip()
            return full_name

    return ""


# ==========================================================
# Score OCR general
# ==========================================================

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