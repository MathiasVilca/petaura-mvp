# PetAura Backend

Este backend sirve como proxy seguro para la API de Groq. El frontend llama a `/api/analyze` y el servidor hace la petición real a Groq usando la clave privada.

## Instalación

```bash
cd backend
npm install
```

## Configuración

Copia el archivo `.env.example` a `.env` y agrega tu clave:

```env
GROQ_API_KEY=tu_clave_groq_aqui
PORT=3001
```

## Ejecución

```bash
cd backend
npm run dev
```

El backend quedará disponible en `http://localhost:3001` y el frontend usará el proxy Vite para acceder a `/api/analyze`.
