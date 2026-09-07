# Chat IA — Aplicaciones Web con Inteligencia Artificial

Proyecto educativo de la materia **Inteligencia Artificial aplicada a las TIC**. Consiste en una página de chat donde el usuario escribe una pregunta y recibe una respuesta generada por un modelo de IA, con instrucciones para responder en español de forma breve y didáctica sobre Tecnologías de Información y Comunicaciones.

## ¿Qué hace el programa?

- Presenta una interfaz de chat adaptable a pantallas pequeñas.
- Permite escribir mensajes de hasta 1000 caracteres.
- Muestra el mensaje del usuario y el aviso «Pensando...» mientras espera la respuesta.
- Envía la pregunta a un servidor Python y muestra la respuesta o un mensaje de error.
- Desactiva temporalmente el formulario durante cada consulta.

Cada consulta envía únicamente el mensaje actual: el modelo no recibe el historial de la conversación. Los mensajes visibles permanecen en la página mientras está abierta y se pierden al recargarla.

## Estructura del proyecto

```text
1.2-aplicaciones-web-ia/
├── api/
│   └── chat.py
├── assets/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       └── app.js
├── index.html
├── requirements.txt
├── .python-version
├── .gitignore
├── vercel.json
└── README.md
```

| Archivo | Función |
| --- | --- |
| `index.html` | Define el encabezado, el área de mensajes y el formulario del chat. |
| `assets/css/styles.css` | Define colores, tamaños, distribución y adaptación a dispositivos móviles. |
| `assets/js/app.js` | Controla el formulario, envía las preguntas al backend y muestra las respuestas. |
| `api/chat.py` | Valida las peticiones, gestiona CORS y consulta la API de OpenAI desde el servidor. |
| `requirements.txt` | Declara la dependencia Python `openai`. |
| `.python-version` | Indica Python `3.12` como versión del proyecto. |
| `.gitignore` | Excluye archivos de entorno, cachés y configuración local del seguimiento de Git. |
| `vercel.json` | Declara `framework: null` para este proyecto sin framework web de JavaScript. |

`assets/` contiene recursos públicos que recibe el navegador. `api/` contiene el código destinado a ejecutarse en el servidor.

## ¿Cómo funciona una consulta?

```text
Usuario → Página en GitHub Pages → Backend en Vercel → API de OpenAI
Usuario ← Respuesta en el chat  ← Respuesta JSON    ← Texto generado
```

1. El usuario escribe una pregunta y presiona **Enviar**.
2. JavaScript envía un `POST` a `/api/chat` en el dominio de Vercel, con `Content-Type: application/json`.
3. Python comprueba el origen configurado, el tamaño de la petición y el mensaje.
4. El servidor obtiene `OPENAI_API_KEY` de sus variables de entorno y realiza la consulta mediante `client.responses.create()`.
5. El backend devuelve un objeto JSON con la propiedad `reply`.
6. JavaScript sustituye el aviso de espera por la respuesta.

Ejemplo del cuerpo enviado:

```json
{
  "message": "Explícame qué es IoT."
}
```

Ejemplo ilustrativo de una respuesta:

```json
{
  "reply": "IoT significa Internet de las cosas: dispositivos conectados que intercambian información."
}
```

## Configuración para GitHub Pages y Vercel

El proyecto está preparado para separar el frontend estático, publicado en GitHub Pages, del backend Python, desplegado como función en Vercel. GitHub Pages no ejecuta `api/chat.py`.

### Dirección del backend

En `assets/js/app.js`, sustituye el marcador `TU-PROYECTO` por el dominio real del despliegue:

```javascript
const API_URL =
   "https://TU-PROYECTO.vercel.app/api/chat";
```

Esta dirección es pública y no contiene la clave de OpenAI.

### Variables de entorno del servidor

Configura en el proyecto de Vercel:

| Variable | Valor esperado |
| --- | --- |
| `OPENAI_API_KEY` | La clave privada para que el servidor consulte OpenAI. |
| `ALLOWED_ORIGIN` | El origen exacto de la página autorizada, por ejemplo `https://alumno.github.io`. |

Si la página se publica en `https://alumno.github.io/1.2-aplicaciones-web-ia/`, el valor es:

```text
ALLOWED_ORIGIN=https://alumno.github.io
```

No incluyas la ruta del repositorio. Un origen se compone del protocolo, el dominio y el puerto, cuando corresponda. Sustituye `alumno` por el nombre real de tu cuenta.

El backend utiliza el modelo y los parámetros definidos en `api/chat.py`. Su disponibilidad y compatibilidad con la cuenta deben comprobarse al realizar una consulta real.

## POST, OPTIONS y CORS

**POST** es el método utilizado para enviar la pregunta. **CORS** permite que el navegador lea las respuestas de un servidor con un origen diferente al de la página.

Antes del POST con JSON, el navegador puede enviar una petición `OPTIONS` de comprobación. El backend responde indicando el origen, los métodos `POST, OPTIONS` y la cabecera `Content-Type` permitidos.

Cuando el origen coincide con `ALLOWED_ORIGIN`, el servidor agrega `Access-Control-Allow-Origin` a la respuesta. Si la variable está configurada y el origen no coincide, el código rechaza la petición con `403`.

Si `ALLOWED_ORIGIN` está vacío, el código omite esa comprobación, pero no agrega la cabecera que necesita el navegador para leer respuestas entre orígenes distintos. Por eso es necesario configurarlo para esta arquitectura.

CORS no autentica usuarios ni evita que otros programas llamen al servidor: una cabecera de origen se puede reproducir fuera del navegador. El proyecto no implementa autenticación ni límites de consultas por usuario.

## Validaciones y errores

| Estado HTTP | Significado en el backend |
| --- | --- |
| `200` | Consulta procesada correctamente. |
| `204` | Comprobación OPTIONS aceptada. |
| `400` | Mensaje vacío, mensaje de más de 1000 caracteres o JSON inválido. |
| `403` | Origen distinto al permitido, cuando `ALLOWED_ORIGIN` está configurado. |
| `405` | Se intentó consultar el endpoint mediante GET. |
| `413` | Longitud del cuerpo menor o igual a cero, o mayor a 5000 bytes. |
| `500` | Falta la clave de entorno o se produjo un error durante el procesamiento. |

Abrir la URL del endpoint directamente en una pestaña envía un GET y devuelve `405`; para consultar el chat se debe enviar un POST desde el formulario.

## Credenciales y archivos públicos

Nunca coloques una clave real en `index.html`, en `assets/`, en este README ni en archivos que se suban a Git. El navegador recibe solamente la URL pública del backend y el contenido del chat.

El archivo `.gitignore` excluye `.env` y `.env.*`, entre otros archivos locales. Esto no elimina secretos que ya hayan sido agregados al repositorio. Si una clave se publica accidentalmente, revócala y genera una nueva.

## Estado actual y comprobación

Los archivos de la interfaz, el backend y la configuración inicial están creados. La URL del frontend conserva el marcador `TU-PROYECTO`; todavía es necesario conectar los despliegues reales y configurar las variables del servidor.

Para comprobar la integración una vez publicada:

1. Abre la página de GitHub Pages.
2. Escribe una pregunta breve y presiona **Enviar**.
3. Comprueba que aparezca «Pensando...» y después una respuesta.
4. Si aparece un error, revisa la URL del backend, las variables de entorno y los registros de la función en Vercel.

La presencia de los archivos no confirma por sí sola que la consulta real a la IA funcione. Actualiza este README conforme agregues funcionalidades o cambies la configuración del programa.
