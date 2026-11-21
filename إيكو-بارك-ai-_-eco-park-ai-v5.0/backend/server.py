"""Eco-Park AI v5.0 Standalone Python HTTP/REST API Server (Port 8000)."""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from ai_model import assess_bess_safety, calculate_co2_saved_kg


class EcoParkHandler(BaseHTTPRequestHandler):
    def _send_json(self, code: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/health":
            self._send_json(200, {"status": "ok", "service": "eco-park-python-backend"})
            return
        self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        data = json.loads(raw)

        if self.path == "/api/co2":
            co2 = calculate_co2_saved_kg(
                data.get("vehicleType", "ELECTRIC"),
                float(data.get("distanceKm", 1.5)),
                float(data.get("idleMin", 5.0)),
            )
            self._send_json(200, {"co2SavedKg": co2})
            return

        if self.path == "/api/bess":
            self._send_json(200, assess_bess_safety(float(data.get("bessCharge", 100))))
            return

        self._send_json(404, {"error": "Endpoint not found"})


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 8000), EcoParkHandler)
    print("Eco-Park Python Backend running on http://0.0.0.0:8000")
    server.serve_forever()
