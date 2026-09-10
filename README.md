# Nexo — Asistente de redes y ciberseguridad

**Desarrollado por Alonso Ramírez G.**

- [Abrir la aplicación en GitHub Pages](https://alonsorgt1.github.io/Aplicaciones-web-IA/)
- [Repositorio en GitHub](https://github.com/ALONSORGT1/Aplicaciones-web-IA)

Proyecto educativo de la materia **Inteligencia Artificial aplicada a las TIC**. Nexo es un asistente especializado en redes de computadoras y ciberseguridad, con respuestas en español, ejemplos prácticos y contexto de la conversación reciente.

## ¿Qué hace el programa?

- Presenta una interfaz de chat adaptable a pantallas pequeñas.
- Permite escribir mensajes de hasta 1000 caracteres.
- Muestra el mensaje del usuario y un indicador de carga mientras espera la respuesta.
- Envía la pregunta a un servidor Python y muestra la respuesta o un mensaje de error.
- Evita envíos simultáneos y permite detener la espera o preparar la siguiente pregunta.
- Alterna entre modo claro y oscuro mediante el botón de sol/luna; recuerda la preferencia con localStorage.
- Mantiene el cuadro de escritura visible al desplazar la conversación, también en celular.

Cada consulta envía el mensaje actual y hasta tres intercambios completos recientes (seis mensajes, máximo 6000 caracteres de historial). El historial se guarda en sessionStorage y se restaura al recargar la misma pestaña. Puede exportarse a Markdown o borrarse con Nueva conversación.

## Estructura del proyecto

```text
1.2-aplicaciones-web-ia/
├── api/
│   └── chat.py
├── assets/
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── app.js
│       └── theme.js
├── tests/
│   └── test_chat.py
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
| `assets/js/theme.js` | Alterna el tema claro/oscuro y restaura la preferencia guardada antes de mostrar la página. |
| `tests/test_chat.py` | Comprueba contexto, validaciones y errores del backend sin llamar a la API real. |
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
  "message": "Dame un ejemplo de ese protocolo.",
  "history": [
    {"role": "user", "content": "¿Qué hace DNS?"},
    {"role": "assistant", "content": "DNS traduce nombres de dominio a direcciones IP."}
  ]
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

En `assets/js/app.js` se utiliza el dominio principal de producción de Vercel:

```javascript
const API_URL =
   "https://aplicaciones-web-ia.vercel.app/api/chat";
```

Esta dirección es pública y no contiene la clave de OpenAI. Si reutilizas el proyecto, sustitúyela por tu dominio principal, conservando `/api/chat`. Evita direcciones de despliegues protegidas por el inicio de sesión de Vercel.

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
| `400` | Petición incorrecta: JSON inválido, cuerpo vacío, mensaje que no es texto, más de 1000 caracteres o historial con formato/roles incorrectos. Corrige el texto o reinicia el chat. |
| `403` | Acceso denegado: el origen no coincide con `ALLOWED_ORIGIN`. Revisa la variable de Vercel y vuelve a desplegar. |
| `405` | Se intentó consultar el endpoint mediante GET. |
| `413` | Petición demasiado grande: cuerpo mayor a 48000 bytes, más de seis mensajes de historial o más de 6000 caracteres de contexto. Reduce el contexto o inicia otra conversación. |
| `500` | Error interno: falta la clave de entorno o falló la consulta a la IA. Inténtalo más tarde y revisa los registros y variables de Vercel. |

Abrir la URL del endpoint directamente en una pestaña envía un GET y devuelve `405`; para consultar el chat se debe enviar un POST desde el formulario.

## Credenciales y archivos públicos

Nunca coloques una clave real en `index.html`, en `assets/`, en este README ni en archivos que se suban a Git. El navegador recibe solamente la URL pública del backend y el contenido del chat.

El archivo `.gitignore` excluye `.env` y `.env.*`, entre otros archivos locales. Esto no elimina secretos que ya hayan sido agregados al repositorio. Si una clave se publica accidentalmente, revócala y genera una nueva.

## Estado actual y comprobación

El frontend utiliza https://aplicaciones-web-ia.vercel.app/api/chat y se publica en GitHub Pages. Vercel ejecuta el backend mediante el repositorio conectado.

Para comprobar la integración una vez publicada:

1. Abre la página de GitHub Pages.
2. Escribe una pregunta breve y presiona **Enviar**.
3. Comprueba que aparezca el indicador de carga y después una respuesta.
4. Si aparece un error, revisa la URL del backend, las variables de entorno y los registros de la función en Vercel.

La presencia de los archivos no confirma por sí sola que la consulta real a la IA funcione. Actualiza este README conforme agregues funcionalidades o cambies la configuración del programa.

## Interfaz Nexo

El diseño utiliza tonos claros y verdes, navegación lateral en escritorio y una distribución compacta en celulares. El contenedor ocupa la altura disponible de la ventana: solo la conversación tiene desplazamiento vertical, mientras el formulario permanece visible. La altura se ajusta al área visible cuando se abre el teclado móvil.

Funciones disponibles:

- Modo claro y oscuro con preferencia persistente y botón accesible en escritorio y celular.
- Crédito de desarrollo de Alonso Ramírez G al pie de la interfaz.
- Preguntas sugeridas editables antes de enviar.
- Editor multilínea con contador de 1000 caracteres; Enter envía en escritorio y Shift + Enter agrega una línea. En dispositivos táctiles se utiliza el botón Enviar.
- Respuestas con títulos, negritas, listas, tablas, citas y bloques de código con botón para copiar.
- Renderizado de un subconjunto de Markdown mediante nodos DOM y texto, sin interpretar HTML de las respuestas.
- Copiar respuesta, exportar el historial como archivo Markdown y nueva conversación con confirmación.
- Historial guardado en la pestaña mediante sessionStorage, sin base de datos de conversaciones.
- Indicador de carga, cancelación de la espera, tiempo máximo de espera de 60 segundos y reintento de errores. Cancelar la espera no garantiza que el servidor deje de procesar la consulta.
- Botón para ir al último mensaje sin desplazar automáticamente al usuario mientras lee respuestas anteriores.
- Etiquetas accesibles, avisos para lectores de pantalla, foco visible y respeto de la preferencia de movimiento reducido.

El backend recibe instrucciones para organizar las respuestas en Markdown y admite hasta 1200 tokens de salida. Una respuesta puede alcanzar ese límite antes de completar una explicación extensa.

El diseño mejora la experiencia de uso, pero la aplicación aún no incorpora autenticación, cuotas por usuario ni almacenamiento de conversaciones en servidor. Estas capacidades requieren trabajo adicional para un servicio público a mayor escala.

## Especialización, contexto y consumo

`instructions` en `api/chat.py` define a Nexo como asistente de redes y ciberseguridad: TCP/IP, OSI, subredes, DNS, VLAN, Wi-Fi, firewalls y defensa de sistemas. El saludo inicial y las sugerencias reflejan esta especialidad.

`entries` conserva mensajes `user` y `assistant`. Antes de cada consulta, `buildContext()` selecciona hasta los últimos tres intercambios completos que caben en 6000 caracteres. No incluye mensajes de error, cancelaciones ni preguntas sin respuesta; tampoco duplica la pregunta actual. Si una pareja no cabe, se detiene la selección para conservar un tramo reciente continuo. El backend valida los mismos límites y no permite roles `system` o `developer` provenientes del navegador.

El historial reenviado aumenta los tokens de entrada. El límite por caracteres es una aproximación para controlar su crecimiento, no un conteo exacto de tokens ni un costo fijo. El límite de salida permanece en 1200 tokens. Referencia: [estado conversacional de OpenAI](https://developers.openai.com/api/docs/guides/conversation-state).

Nueva conversación borra los mensajes visibles y sessionStorage, restaura el saludo y reinicia el contador a `0 / 1000`; la siguiente pregunta envía un historial vacío. El contador se actualiza con el evento `input`. Al reintentar un error se crea una nueva consulta con el contexto válido actual.

Los errores 400, 403, 413 y 500 tienen mensajes diferentes en la interfaz, incluso si el servidor devuelve un error no JSON. Si el navegador bloquea una respuesta por CORS, JavaScript no puede leer el código 403: en ese caso se muestra el mensaje de conexión y el diagnóstico se hace en la pestaña Red del navegador.

Para probar el backend sin credenciales ni llamadas de pago: `python -m unittest discover -s tests -v`. Las pruebas cubren el envío de contexto al SDK simulado, validación de roles, límites y los cuatro códigos de error.
