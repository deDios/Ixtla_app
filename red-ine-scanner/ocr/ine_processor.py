"""
Orquestador principal del procesamiento OCR de INE.

Coordina:
- Recorte de tarjeta.
- Preprocesamiento por variantes.
- OCR libre.
- OCR por regiones.
- Cajas de debug visual.
- Selección del mejor método.
- Unión de resultados entre frente y reverso.
- Fallbacks para completar campos faltantes.
"""

from ocr.image_utils import crop_card_if_possible
from ocr.preprocessing import preprocess_variants
from ocr.tesseract_runner import run_ocr, run_ocr_boxes
from ocr.ine_extractors import (
    empty_ine_data,
    extract_ine_data,
    extract_fallback_data,
    extract_name_from_mrz,
    score_ocr_result
)
from ocr.ine_layout import process_front_by_regions


def process_ine_image(img, include_boxes=False, side="front"):
    card_img, crop_info = crop_card_if_possible(img)
    variants = preprocess_variants(card_img)

    region_data = {}
    region_debug = []

    if side == "front":
        region_data, region_debug = process_front_by_regions(card_img)

    ocr_results = []

    for method_name, processed_img in variants.items():
        text = run_ocr(processed_img)
        data = extract_ine_data(text)
        score = score_ocr_result(text, data)

        result = {
            "method": method_name,
            "score": score,
            "raw_text": text,
            "data": data,
            "image_size": {
                "width": int(processed_img.shape[1]),
                "height": int(processed_img.shape[0])
            }
        }

        if include_boxes:
            result["boxes"] = run_ocr_boxes(processed_img)

        ocr_results.append(result)

    best_result = max(ocr_results, key=lambda item: item["score"])

    # Prioridad nueva:
    # 1. OCR por regiones
    # 2. OCR libre como fallback
    merged_data = empty_ine_data()

    for key, value in region_data.items():
        if value and key in merged_data:
            merged_data[key] = value

    fallback_data = merge_best_data(ocr_results)

    for key, value in fallback_data.items():
        if not merged_data.get(key) and value:
            merged_data[key] = value

    return {
        "best_method": best_result["method"],
        "score": best_result["score"],
        "raw_text": best_result["raw_text"],
        "debug_results": ocr_results,
        "region_debug": region_debug,
        "crop_info": crop_info,
        "data": merged_data
    }


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


def merge_front_back_data(front_data, back_data, back_text):
    merged = empty_ine_data()

    for key in merged.keys():
        if front_data.get(key):
            merged[key] = front_data[key]

        if key in ["nombre", "curp", "clave_elector"] and back_data.get(key):
            if not merged.get(key):
                merged[key] = back_data[key]
        elif not merged.get(key) and back_data.get(key):
            merged[key] = back_data[key]

    mrz_name = extract_name_from_mrz(back_text)

    if mrz_name and len(mrz_name.split()) >= 3:
        merged["nombre"] = mrz_name

    return merged