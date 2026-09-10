import json
import os

from http.server import BaseHTTPRequestHandler
from openai import OpenAI


ALLOWED_ORIGIN = os.environ.get(
   "ALLOWED_ORIGIN",
   ""
).rstrip("/")

MAX_BODY_BYTES = 48000
MAX_HISTORY_MESSAGES = 6
MAX_HISTORY_CHARS = 6000


def validate_input(data):
   if not isinstance(data, dict):
       raise ValueError("La petición debe ser un objeto JSON.")
   message = data.get("message")
   if not isinstance(message, str) or not message.strip():
       raise ValueError("Es necesario escribir un mensaje de texto.")
   message = message.strip()
   if len(message) > 1000:
       raise ValueError("El mensaje supera los 1000 caracteres.")
   history = data.get("history", [])
   if not isinstance(history, list) or len(history) % 2:
       raise ValueError("El historial debe contener pares user y assistant.")
   if len(history) > MAX_HISTORY_MESSAGES:
       raise OverflowError("El historial supera los 6 mensajes permitidos.")
   result, total = [], 0
   for index, item in enumerate(history):
       role = "user" if index % 2 == 0 else "assistant"
       if not isinstance(item, dict) or item.get("role") != role:
           raise ValueError("El historial solo admite pares user y assistant.")
       content = item.get("content")
       if not isinstance(content, str) or not content.strip():
           raise ValueError("Cada mensaje del historial debe contener texto.")
       total += len(content)
       if total > MAX_HISTORY_CHARS:
           raise OverflowError("El historial supera los 6000 caracteres.")
       result.append({"role": role, "content": content})
   return result + [{"role": "user", "content": message}]


class handler(BaseHTTPRequestHandler):

   def add_cors_headers(self):
       origin = self.headers.get("Origin", "")

       if ALLOWED_ORIGIN and origin == ALLOWED_ORIGIN:
           self.send_header(
               "Access-Control-Allow-Origin",
               origin
           )
           self.send_header("Vary", "Origin")


   def send_json(self, status_code, data):
       body = json.dumps(
           data,
           ensure_ascii=False
       ).encode("utf-8")

       self.send_response(status_code)
       self.send_header(
           "Content-Type",
           "application/json; charset=utf-8"
       )
       self.add_cors_headers()
       self.send_header(
           "Content-Length",
           str(len(body))
       )
       self.end_headers()

       self.wfile.write(body)


   def do_OPTIONS(self):
       origin = self.headers.get("Origin", "")

       if ALLOWED_ORIGIN and origin != ALLOWED_ORIGIN:
           self.send_response(403)
           self.end_headers()
           return

       self.send_response(204)
       self.add_cors_headers()
       self.send_header(
           "Access-Control-Allow-Methods",
           "POST, OPTIONS"
       )
       self.send_header(
           "Access-Control-Allow-Headers",
           "Content-Type"
       )
       self.send_header(
           "Access-Control-Max-Age",
           "86400"
       )
       self.end_headers()


   def do_GET(self):
       self.send_json(
           405,
           {
               "error":
                   "Este endpoint solamente acepta POST."
           }
       )


   def do_POST(self):
       try:
           origin = self.headers.get("Origin", "")

           if ALLOWED_ORIGIN and origin != ALLOWED_ORIGIN:
               self.send_json(
                   403,
                   {"error": "Origen no autorizado."}
               )
               return

           try:
               content_length = int(self.headers.get("Content-Length", 0))
           except ValueError:
               self.send_json(400, {"error": "Content-Length no válido."})
               return
           if content_length <= 0:
               self.send_json(400, {"error": "El cuerpo de la petición está vacío."})
               return
           if content_length > MAX_BODY_BYTES:
               self.send_json(
                   413,
                   {"error": "Petición no válida o demasiado grande."}
               )
               return

           body = self.rfile.read(content_length)

           data = json.loads(
               body.decode("utf-8")
           )

           try:
               model_input = validate_input(data)
           except ValueError as error:
               self.send_json(400, {"error": str(error)})
               return
           except OverflowError as error:
               self.send_json(413, {"error": str(error)})
               return

           api_key = os.environ.get(
               "OPENAI_API_KEY"
           )

           if not api_key:
               self.send_json(
                   500,
                   {"error": "OPENAI_API_KEY no está configurada."}
               )
               return

           client = OpenAI(
               api_key=api_key
           )

           response = client.responses.create(
               model="gpt-5.6-luna",
               instructions="""
               Eres Nexo, un asistente educativo especializado en redes
               de computadoras y ciberseguridad: TCP/IP, modelo OSI,
               direccionamiento y subredes, DNS, enrutamiento, VLAN,
               Wi-Fi, firewalls, criptografía, defensa y diagnóstico.
               Adapta las explicaciones al nivel del usuario y utiliza
               el historial disponible para responder preguntas de seguimiento.
               Si falta contexto, pide el dato necesario sin inventarlo.
               Orienta los ejercicios a laboratorios autorizados y protección
               de sistemas. Explica el efecto de comandos y configuraciones.
               Responde siempre en español, de manera clara,
               breve y didáctica. Incluye ejemplos cuando ayuden
               a comprender el concepto.
               Organiza las respuestas con Markdown: párrafos cortos,
               encabezados cuando sean útiles, listas para pasos y
               tablas para comparaciones. Usa bloques de código con
               el nombre del lenguaje y explica los ejemplos.
               Evita bloques largos de texto y no uses HTML.
               """,
               input=model_input,
               reasoning={
                   "effort": "none"
               },
               max_output_tokens=1200
           )

           self.send_json(
               200,
               {
                   "reply":
                       response.output_text
               }
           )

       except (json.JSONDecodeError, UnicodeDecodeError):
           self.send_json(
               400,
               {"error": "El cuerpo no contiene JSON válido."}
           )

       except Exception as error:
           print(
               f"Error en /api/chat: "
               f"{type(error).__name__}: {error}"
           )

           self.send_json(
               500,
               {
                   "error":
                       "No fue posible consultar el modelo de IA."
               }
           )
