# Publicar la extensión en la Chrome Web Store (manual)

Esta guía es para el dueño del proyecto. Publicar en la tienda evita que los usuarios tengan que usar el modo de desarrollador, pero requiere una cuenta y una revisión de Google.

## Antes de empezar

1. Crea una cuenta en el [panel de desarrolladores de Chrome](https://chrome.google.com/webstore/devconsole). Tiene un **pago único de 5 USD**.
2. Genera el zip con `npm run pack:extension` (queda en `release/extension.zip`, con `manifest.json` en la raíz).
3. Ten a mano capturas de pantalla (1280x800 o 640x400), el icono de 128x128 y una descripción.

## Pasos

1. En el panel, pulsa **Nuevo elemento** y sube el zip.
2. Completa la **ficha de la tienda**: descripción, categoría, idioma (español), capturas.
3. Completa la pestaña **Privacidad**:
   - **Propósito único:** enviar los mensajes de la app de escritorio Mecatube a DeepSeek y Google Flow y devolver las respuestas e imágenes generadas.
   - **Uso de datos:** la extensión no recopila ni vende datos. Solo se comunica con la app Mecatube en `127.0.0.1` (el mismo equipo).
   - Indica una URL de política de privacidad (puede ser una página del repositorio).
4. Justifica cada permiso:
   - `tabs`: encontrar y abrir las pestañas de DeepSeek y Flow que usa la app.
   - `scripting`: inyectar el código que escribe los mensajes y lee las respuestas en esas páginas.
   - `storage`: guardar ajustes locales de la extensión.
   - `debugger`: controlar la página de Flow (por ejemplo, adjuntar imágenes y detectar la generación). Es el permiso más delicado; explica con claridad por qué es imprescindible.
   - Permisos de host `https://chat.deepseek.com/*` y `https://flow.google.com/*`: actuar solo en esos dos sitios.
5. Elige la visibilidad (pública, o no listada si solo quieres compartir el enlace).
6. Pulsa **Enviar a revisión**.

## Qué esperar

- La revisión suele tardar de unos días a un par de semanas. Los permisos como `debugger` y los permisos de host pueden provocar una revisión más lenta o preguntas adicionales.
- Si te rechazan, el correo indica el motivo; corrige y vuelve a enviar.
- Cada actualización requiere subir un zip con un `version` mayor en `manifest.json` y pasar otra revisión.

Mientras tanto, el zip de la release de GitHub sigue siendo la forma de instalarla.
