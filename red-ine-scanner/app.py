"""
Archivo principal de la aplicación Flask.

Define las rutas HTTP del scanner:
- Renderiza la vista principal.
- Recibe imágenes frontal y trasera de la INE.
- Activa el modo debug si se solicita.
- Llama al procesador OCR.
- Devuelve la respuesta JSON final al frontend.
"""

from flask import Flask, render_template, request, jsonify
import pytesseract

from ocr.image_utils import read_uploaded_image
from ocr.ine_processor import process_ine_image, merge_front_back_data

app = Flask(__name__)

# PC escritorio
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

# Laptop
# pytesseract.pytesseract.tesseract_cmd = (
#     r"C:\Users\jacks\AppData\Local\Programs\Tesseract-OCR\tesseract.exe"
# )


@app.route("/")
def index():
    return render_template("scannerTest.php")


@app.route("/scan-ine", methods=["POST"])
def scan_ine():
    if "front_image" not in request.files:
        return jsonify({
            "ok": False,
            "error": "No se recibió la imagen frontal"
        }), 400

    if "back_image" not in request.files:
        return jsonify({
            "ok": False,
            "error": "No se recibió la imagen trasera"
        }), 400

    include_boxes = request.form.get("debug") == "1"

    front_img = read_uploaded_image(request.files["front_image"])
    back_img = read_uploaded_image(request.files["back_image"])

    if front_img is None:
        return jsonify({
            "ok": False,
            "error": "No se pudo leer la imagen frontal"
        }), 400

    if back_img is None:
        return jsonify({
            "ok": False,
            "error": "No se pudo leer la imagen trasera"
        }), 400

    front_result = process_ine_image(
        front_img,
        include_boxes=include_boxes,
        side="front"
    )

    back_result = process_ine_image(
        back_img,
        include_boxes=include_boxes,
        side="back"
    )

    merged_data = merge_front_back_data(
        front_result["data"],
        back_result["data"],
        back_result["raw_text"]
    )

    return jsonify({
        "ok": True,
        "best_method": front_result["best_method"],
        "score": front_result["score"],
        "data": merged_data,

        "front_raw_text": front_result["raw_text"],
        "back_raw_text": back_result["raw_text"],

        "front_debug_results": front_result["debug_results"],
        "back_debug_results": back_result["debug_results"],

        "front_region_debug": front_result.get("region_debug", []),
        "back_region_debug": back_result.get("region_debug", []),

        "front_crop_info": front_result["crop_info"],
        "back_crop_info": back_result["crop_info"]
    })


@app.route("/test-ocr")
def test_ocr():
    version = pytesseract.get_tesseract_version()

    return {
        "ok": True,
        "tesseract_version": str(version)
    }


if __name__ == "__main__":
    app.run(debug=True)