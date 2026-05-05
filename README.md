# PetAura - MVP (PC02)

PetAura es una aplicación web progresiva (PWA) que traduce el estado emocional de una mascota en una visualización generativa ("Aura") de partículas interactiva.

**Curso:** CC451 Interacción Humano Computador
**Semestre:** 2026-1

## Sobre este MVP (Producto Mínimo Viable)
Para esta etapa del proyecto, el MVP se centra en demostrar la **interfaz gráfica no convencional** (Canvas 2D) y el comportamiento de la aplicación. 

Tal como se permite en los lineamientos del proyecto, **se está utilizando información simulada**:
- La entrada del Large Language Model (LLM) ha sido *mockeada* mediante archivos JSON locales.
- Al interactuar con los botones de prueba, el sistema inyecta estos JSONs simulando la respuesta de la API de Claude, lo que desencadena las animaciones de transición en el sistema de partículas y activa la retroalimentación háptica (Vibration API).

## Tecnologías
* React + Vite
* HTML5 Canvas 2D (Renderizado del Aura)
* Vibration API (Interfaces Hápticas)

## Cómo ejecutar localmente
1. Clonar el repositorio: `git clone <tu-url-de-github>`
2. Instalar dependencias: `npm install`
3. Iniciar el servidor de desarrollo: `npm run dev`

## Licencia
Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.
