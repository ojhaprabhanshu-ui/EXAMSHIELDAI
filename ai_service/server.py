"""Small internal JSON HTTP wrapper around the simulator/analyzer."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from simulator import SCENARIOS, analyze


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"status": "ready", "service": "examshield-ai", "scenarios": list(SCENARIOS)})
        return self._send(404, {"error": "Not found"})

    def do_POST(self):
        if self.path != "/analyze":
            return self._send(404, {"error": "Not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 4096:
                return self._send(413, {"error": "Request is too large"})
            payload = json.loads(self.rfile.read(length) or b"{}")
            scenario = payload.get("scenario")
            if scenario not in SCENARIOS:
                return self._send(400, {"error": "Unsupported scenario"})
            return self._send(200, analyze(scenario))
        except (ValueError, TypeError, json.JSONDecodeError):
            return self._send(400, {"error": "Invalid JSON request"})

    def log_message(self, fmt, *args):
        print("[ai-service] " + fmt % args)


if __name__ == "__main__":
    # Hosted web services must bind to all interfaces and honor the platform port.
    host = os.environ.get("AI_SERVICE_HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", os.environ.get("AI_SERVICE_PORT", "8001")))
    print(f"ExamShield AI service listening on {host}:{port}")
    ThreadingHTTPServer((host, port), Handler).serve_forever()
