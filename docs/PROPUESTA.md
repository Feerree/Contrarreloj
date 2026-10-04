# Contrarreloj — Propuesta técnica y funcional (Fase 1)

Este documento registra el análisis inicial y las decisiones que guían el desarrollo. Todas las decisiones son reversibles: el proyecto no depende de servicios externos, cuentas ni infraestructura paga.

## 1. Análisis del juego original

Trivia Contrarreloj Royal es un juego de descripción por equipos. En cada turno, un integrante describe las palabras de una carta sin nombrarlas y su equipo intenta adivinar la mayor cantidad posible antes de que termine el reloj de arena. Antes de empezar se tira un dado cuyas caras valen 0, 1 o 2, y ese valor se descuenta de los aciertos. El resultado final indica cuántos casilleros avanza la ficha. Gana el primer equipo que llega a la meta.

### Problemas que resuelve la app

| Problema del juego físico | Solución digital |
| --- | --- |
| Las cartas se memorizan después de muchas partidas. | Banco original de más de 15.000 conceptos, con historial que prioriza los no vistos. |
| Poca variedad temática y una sola dificultad. | 34 categorías, 3 niveles y filtros combinables. |
| El reloj de arena es impreciso y se discute. | Cronómetro basado en la hora real del sistema, con sonidos y aviso de 10 s. |
| Se pierde la cuenta de aciertos y de quién juega. | Contador en pantalla, alternancia automática y registro de cada ronda. |
| Siempre la misma forma de jugar. | Seis modalidades con reglas propias. |

## 2. Arquitectura elegida

**PWA estática, en JavaScript puro (módulos ES), sin framework y sin paso de compilación para la app.**

Motivos:

- **Presupuesto cero:** es un conjunto de archivos estáticos. Se publica gratis en GitHub Pages, Netlify o Cloudflare Pages.
- **Offline real:** un *service worker* guarda todos los archivos en caché en la primera visita. Después funciona sin Internet.
- **iOS y Android:** se instala desde el navegador ("Agregar a pantalla de inicio"). No requiere tiendas de aplicaciones.
- **Mantenimiento simple:** no hay dependencias de npm en producción. Nada se rompe por actualizaciones de terceros.
- **Rendimiento:** la app completa pesa poco y el banco se carga una sola vez.

Se descartaron React/Vue (agregan compilación y dependencias sin beneficio concreto para 12 pantallas) y una app nativa (requiere tiendas, cuentas de desarrollador y dos bases de código).

### Estructura

```
app/                 ← lo que se publica (PWA)
  index.html
  manifest.webmanifest
  sw.js              ← service worker (caché offline)
  css/styles.css
  fonts/             ← tipografías locales (licencia OFL)
  icons/
  data/bank.js       ← banco generado (no se edita a mano)
  js/core/           ← lógica pura, sin DOM, testeada con Node
  js/ui/             ← pantallas, sonido, animaciones
data/words/*.txt     ← fuente editable del banco (una categoría por archivo)
tools/build-bank.mjs ← valida, detecta duplicados y genera app/data/bank.js
tests/               ← pruebas unitarias (node --test) y de punta a punta (Playwright)
```

La separación entre `core` (reglas, selección de palabras, cronómetro, estadísticas) y `ui` permite probar las reglas sin abrir un navegador.

## 3. Almacenamiento

Se usa `localStorage` del navegador, con claves versionadas:

- Partida en curso (se guarda después de cada acción, incluso a mitad de ronda).
- Historial de conceptos usados (identificador + fecha de último uso).
- Partidas terminadas (para estadísticas e historial).
- Configuración y palabras personalizadas.

Los datos quedan en el dispositivo. No hay cuentas ni servidores. Se incluye exportación e importación de un respaldo en JSON para pasar los datos a otro celular.

## 4. Banco de palabras

- **Fuente:** archivos de texto plano, uno por categoría, con secciones `# facil`, `# intermedio` y `# dificil`. Agregar una palabra es escribir una línea.
- **Validación automática** (`tools/build-bank.mjs`):
  - Duplicados exactos, sin importar mayúsculas ni tildes.
  - Duplicados aproximados: singular/plural, artículos iniciales y diferencias de una letra (se reportan para revisión).
  - Longitud y caracteres válidos.
- **Identificador estable:** cada concepto se identifica por su texto normalizado. Así el historial sigue siendo válido aunque el banco crezca.
- **Contenido original:** generado para este proyecto; no reproduce las cartas del juego.
- **Público objetivo:** jugadores de 18 a 20 años, de Uruguay y Latinoamérica. La dificultad se asigna con ese criterio.

### Selección aleatoria

1. Se arma el conjunto de candidatos según categorías activas, dificultad y modo.
2. Se excluyen los conceptos ya mostrados en la partida actual (nunca se repiten dentro de una partida).
3. Se priorizan los conceptos nunca vistos en partidas anteriores.
4. Si no quedan conceptos nuevos, se avisa y se ofrece reiniciar el historial. Mientras tanto se eligen los vistos hace más tiempo.
5. La siguiente palabra se elige recién cuando se necesita, así no se puede ver por adelantado.

## 5. Reglas implementadas

- **Avance = máx(0, aciertos − dado)**. El dado tiene caras 0, 1 y 2, equiprobables. Nunca se retrocede.
- Las posiciones se **recalculan desde el registro de rondas**. Por eso corregir una ronda pasada actualiza el tablero sin inconsistencias.
- El orden de turnos se deriva de la cantidad de rondas jugadas, así ningún equipo puede jugar dos veces seguidas por error.
- El narrador rota automáticamente dentro de cada equipo, pero se puede cambiar.

## 6. Modalidades

| Modo | Tablero | Idea |
| --- | --- | --- |
| **Clásico** | Sí | Reglas originales con penalización por dado. |
| **Progresivo** | Sí | La dificultad depende de la posición del equipo: primer tercio fácil, segundo intermedio, último tercio difícil. |
| **Desafío** | Sí | Algunos casilleros (⚡) activan un desafío en el turno siguiente: tiempo reducido, sin pasar, doble o nada, categoría única, solo mímica, etc. |
| **Ruleta temática** | Sí | En cada turno se sortea una categoría y todas las palabras salen de ella. |
| **Libre** | No | Cantidad fija de rondas por equipo. Gana quien suma más aciertos. El dado es opcional. |
| **Supervivencia** | No | Cada equipo tiene vidas. Cada palabra pasada cuesta una vida. Gana quien llega primero al objetivo de puntos o el último que sobrevive. |

El "modo categorías" del pedido se resuelve como filtro disponible en **todas** las modalidades (y como la Ruleta temática), en lugar de un modo separado que duplicaría opciones.

## 7. Diseño UX/UI

- Estética de juego de mesa nocturno: fondo azul profundo, acento ámbar (el reloj) y colores fuertes por equipo.
- Tipografías: *Bricolage Grotesque* (títulos) y *Outfit* (texto), alojadas en la app para funcionar offline.
- Botones grandes en la parte inferior, pensados para un celular que pasa de mano en mano.
- La palabra ocupa el centro de la pantalla con tamaño máximo legible.
- Al pausar, la palabra se oculta.
- Sonidos sintetizados con Web Audio (no requieren archivos) y vibración donde el sistema lo permite.
- Se mantiene la pantalla encendida durante la ronda (Wake Lock API, cuando está disponible).

## 8. Plan de implementación

1. Banco de palabras + herramienta de validación.
2. Lógica pura: reglas, dado, selección, cronómetro, estadísticas. Pruebas unitarias.
3. Interfaz: sistema de pantallas, estilos, componentes.
4. PWA: manifest, íconos, service worker.
5. Pruebas de punta a punta en Chromium (flujo completo, offline, tamaños de pantalla).
6. Revisión de usabilidad y ajustes.
7. Documentación de uso, publicación y mantenimiento.

## 9. Funciones que requieren conexión

Ninguna durante el juego. Solo la **primera carga** (y las actualizaciones de la app) necesitan Internet.
