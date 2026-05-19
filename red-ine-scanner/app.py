from flask import Flask, render_template
import pytesseract

app = Flask(__name__)

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

@app.route("/")
def index():
    return render_template("scannerTest.php")

@app.route("/test-ocr")
def test_ocr():
    version = pytesseract.get_tesseract_version()
    return {
        "ok": True,
        "tesseract_version": str(version)
    }

if __name__ == "__main__":
    app.run(debug=True)