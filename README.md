# PetAura - MVP (PC02)

PetAura es un prototipo de interacción humano-máquina para mascotas que transforma la entrada de voz o texto en un análisis de estado emocional y físico, desplegando ese resultado como una visualización de "aura" generativa en HTML5 Canvas.

**Curso:** CC451 Interacción Humano Computador
**Semestre:** 2026-1

## Descripción general
Este MVP demuestra el flujo completo de la aplicación:

1. El usuario describe cómo se comportó su mascota mediante texto o grabación de voz.
2. El frontend muestra el transcript en pantalla y envía los datos al backend.
3. El backend hace proxy seguro a Groq API para analizar el perfil y la transcripción.
4. El sistema normaliza la respuesta de IA y renderiza una aura dinámica basada en el estado de ánimo detectado.
5. El usuario ve recomendaciones y métricas de energía, estrés y calidez.

## Qué incluye esta versión

- Frontend en React + Vite con UI responsiva.
- Visualización generativa de aura con partículas en `src/components/AuraCanvas.jsx`.
- Reconocimiento de voz mediante Web Speech API: el transcript aparece en el textarea mientras se graba.
- Análisis semántico con Groq API, protegido por un backend Express.
- Soporte para los 8 estados de ánimo definidos: `happy`, `calm`, `tired`, `anxious`, `playful`, `affectionate`, `curious`, `sick`.
- Mapa de colores de mood usado para derivar la paleta del aura y evitar depender de color directo de la IA.
- Fallback seguro cuando la respuesta de IA no cumple formato JSON esperado.

## Arquitectura del flujo

- `src/App.jsx` maneja la experiencia del usuario.
- `src/services/groqService.js` envía el perfil y transcript al backend.
- `src/ai/analyzeTranscript.js` normaliza la respuesta de IA y aplica fallback si el endpoint no está disponible.
- `backend/server.js` expone `/api/analyze`, agrega la clave `GROQ_API_KEY` desde `backend/.env`, y llama al endpoint OpenAI-compatible de Groq.

## Configuración y ejecución local

### 1. Instalar dependencias

En la raíz del proyecto:

```bash
npm install
```

En el backend:

```bash
cd backend
npm install
```

### 2. Configurar la clave de Groq

Crea `backend/.env` a partir de `backend/.env.example` y agrega tu clave:

```env
GROQ_API_KEY=tu_clave_groq_aqui
PORT=3002
```

> Si usas otro puerto, asegúrate de ajustar el proxy en `vite.config.js` o define `VITE_BACKEND_URL`.

### 3. Iniciar el backend

Desde `backend/`:

```bash
npm run dev
```

### 4. Iniciar el frontend

Desde la raíz del proyecto:

```bash
npm run dev
```

### 5. Abrir la aplicación

Visita `http://localhost:5173` en tu navegador.

## Notas de implementación

- `vite.config.js` configura el proxy para que `/api` apunte al backend local.
- El backend no guarda la clave en el repositorio; usa `backend/.env` para protegerla.
- Si el navegador no soporta SpeechRecognition, la aplicación sigue permitiendo entrada manual de texto.
- El sistema detecta el mood y utiliza `moodColors` en `src/App.jsx` para derivar el color del aura.

## Estructura del repositorio

- `src/` — frontend React
- `src/components/AuraCanvas.jsx` — renderizado del aura en Canvas
- `src/services/groqService.js` — cliente que llama al backend
- `src/ai/analyzeTranscript.js` — normalización y fallback del análisis de texto
- `backend/server.js` — proxy Express que llama a Groq API
- `backend/.env.example` — plantilla para la clave de Groq
- `vite.config.js` — proxy y configuración de servidor de desarrollo

## Relevancia para PC02

Este MVP cumple el objetivo del entregable PC02 al mostrar:

- una experiencia de interacción completo con entrada multimodal (voz y texto),
- una visualización no convencional de datos emocionales,
- integración con un servicio de IA externo,
- y un flujo seguro que protege la clave de API fuera del repositorio.

## Licencia
Este proyecto está bajo la Licencia MIT. Ver [LICENSE](LICENSE) para más detalles.
