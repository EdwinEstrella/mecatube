# Plan de automatización — Videos Stickman

Basado en el flujo descrito en `idea.md` (DeepSeek → voz → Flow → CapCut + Claude → metadatos). Objetivo: automatizar al máximo ese flujo sin pagar créditos.

## Arquitectura

**Brave + extensión + Electron**, cada parte hace lo que mejor sabe:

- **Extensión de Brave (Mecatube en el panel lateral):** maneja DeepSeek y Flow en las pestañas del navegador, usando la sesión de Google ya iniciada. Pega los prompts, lee las respuestas, genera y descarga. Esto resuelve el problema del inicio de sesión de Google, que bloquea los navegadores incrustados como Electron.
- **App de Electron (motor local):** se encarga de lo que necesita el equipo: archivos, voz y armado del video. Reutiliza lo que ya está construido.

## Flujo paso a paso

| Paso | Hoy (manual) | Automatizado | Intervención del usuario |
|---|---|---|---|
| 1. Ideas | Copiar el prompt a DeepSeek | La extensión lo pega con la búsqueda activada y muestra las 10 ideas | Elegir una idea |
| 2. Guion | Pedir duración, copiar el guion | Automático | Leer y aprobar |
| 3. Voz | ElevenLabs con créditos | **Kokoro o Piper**: voces naturales locales, gratis y sin límite | Elegir la voz una vez |
| 4. Personajes | Prompt → Flow → aprobar | La extensión genera las hojas de personaje en Flow | Aprobar el personaje |
| 5. Escenas | ~160 prompts copiados a mano | La extensión recorre los bloques, sube la hoja de referencia, genera y descarga numerado (`001.png`, `002.png`, …) | Ninguna |
| 6. Animar el gancho | Manual en Flow | Automático, con los primeros N créditos del día | Ninguna |
| 7. Edición | CapCut + Claude de pago | **FFmpeg + Whisper** en local: sincroniza imágenes con la voz, agrega zooms suaves, música y subtítulos | Revisar el video final |
| 8. Metadatos | Volver al chat | Automático: títulos, descripción, etiquetas y miniatura | Elegir título y miniatura |

**Cambio clave en el paso 7:** en lugar de CapCut + Claude (lo único de pago en el flujo original), el video se arma con FFmpeg, gratis. Whisper detecta el momento exacto de cada frase, así que cada imagen aparece justo donde corresponde. Opcionalmente se puede exportar el proyecto para retocarlo a mano.

**Resultado:** unas 4 decisiones por video (idea, guion, personaje y revisión final) en lugar de 9 pasos manuales.

## Consideraciones

- **La automatización web es frágil:** si Google o DeepSeek cambian el diseño de su página, la extensión necesita ajustes. Es mantenimiento normal en este tipo de herramientas.
- **Límites gratuitos de Flow:** 200 imágenes por día y 50 animaciones. Un video de 8 minutos usa ~160 imágenes, así que entra en un día.
- **Sin rotación de cuentas:** no se implementa el truco de usar varias cuentas para obtener créditos extra. Va contra las condiciones de Google y arriesga la suspensión de la cuenta principal.
- **Condiciones de uso:** revisar las condiciones de Flow sobre automatización antes de usarlo a gran escala.

## Orden de construcción

Cada parte es útil por sí sola:

1. Extensión con DeepSeek (ideas → guion → prompts).
2. Voz local con Kokoro.
3. Armado del video con FFmpeg + Whisper.
4. Automatización de Flow (al final, por ser la parte más frágil).
