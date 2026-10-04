# ⏱ Contrarreloj

Juego de descripción por equipos para jugar con amigos alrededor de un celular. Está inspirado en el juego de mesa *Trivia Contrarreloj Royal*, pero tiene contenido propio y más funciones.

- **Más de 15.000 conceptos originales** (15.103 en la versión actual) en 34 categorías y 3 niveles de dificultad (ver [`docs/BANCO.md`](docs/BANCO.md)).
- **6 modalidades:** Clásico, Progresivo, Desafío, Ruleta temática, Libre y Supervivencia.
- Tablero de 34 casilleros, dado 0-1-2 y la penalización **avance = máx(0, aciertos − dado)**.
- Funciona **sin Internet** después de la primera carga y se puede **instalar** como app (PWA).
- **Costo cero:** sin servidores, sin cuentas y sin dependencias en producción.

Las decisiones de diseño están en [`docs/PROPUESTA.md`](docs/PROPUESTA.md).

---

## Cómo ejecutarla localmente

Requisitos: [Node.js](https://nodejs.org) 18 o superior. Para jugar no hace falta instalar nada más.

```bash
npm start            # sirve la carpeta app/ en http://localhost:5173
```

Cualquier servidor de archivos estáticos sirve, por ejemplo `python3 -m http.server 5173 -d app`. No se puede abrir `index.html` con doble clic, porque los navegadores bloquean los módulos JavaScript en `file://`.

## Cómo probarla desde el celular

1. Conectá la computadora y el celular a la **misma red wifi**.
2. Corré `npm start` y buscá la IP de la computadora (`ipconfig` en Windows, `ip addr` o `ifconfig` en Mac/Linux). Por ejemplo, `192.168.1.20`.
3. En el celular abrí `http://192.168.1.20:5173`.

> En la red local (`http://`), el modo sin conexión y la instalación no se activan, porque los navegadores exigen HTTPS. Para probarlos, publicá la app (ver más abajo) o usá `localhost`.

## Cómo instalarla como app (PWA)

Abrí el enlace publicado (HTTPS) una vez con Internet. Desde ese momento ya funciona sin conexión.

- **Android (Chrome):** menú ⋮ → *Instalar app* (o el botón *📲 Instalar* del menú principal).
- **iPhone (Safari):** botón *Compartir* → *Agregar a pantalla de inicio*.
- **Computadora (Chrome/Edge):** ícono de instalar en la barra de direcciones.

## Cómo publicarla gratis

### Opción A: GitHub Pages (recomendada, ya configurada)

1. En GitHub: **Settings → Pages → Source: GitHub Actions**.
2. Hacé merge a `main`. El workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml) valida el banco, corre las pruebas y publica `app/`.
3. La app queda en `https://<usuario>.github.io/<repositorio>/`.

> Si el repositorio es **privado**, GitHub Pages solo funciona en planes pagos. En ese caso, hacé el repositorio público o usá la opción B.

### Opción B: Netlify o Cloudflare Pages

Creá un sitio nuevo conectado al repositorio con estos valores:

- Build command: `node tools/build-bank.mjs && node tools/build-sw.mjs`
- Publish directory: `app`

También podés arrastrar la carpeta `app/` a [app.netlify.com/drop](https://app.netlify.com/drop).

## Cómo actualizar el banco de palabras

Las palabras están en `data/words/`, un archivo de texto por categoría:

```
# id: animales
# nombre: Animales
# icono: 🦁

# facil
Perro
Gato

# intermedio
Ñandú

# dificil
Tatú carreta
```

1. Agregá, quitá o mové líneas. Para crear una categoría, creá un archivo nuevo con su `id`, `nombre` e `icono`. **No cambies el `id` de una categoría existente**, porque el historial lo usa.
2. Corré `npm run build`. Este comando:
   - Valida duplicados exactos (sin importar mayúsculas ni tildes) y frena si encuentra alguno.
   - Avisa de duplicados aproximados (plurales y artículos). Si dos conceptos parecidos son distintos de verdad, agregá el par a `data/similares-permitidos.txt`.
   - Genera `app/data/bank.js`, `docs/BANCO.md` y un `app/sw.js` con una versión nueva, para que los celulares descarguen la actualización.
3. Para una revisión más estricta, corré `npm run bank:strict`. Avisa además cuando dos palabras difieren en una sola letra o cuando un concepto contiene a otro.

Para homónimos, usá una aclaración entre paréntesis: `Durazno (ciudad)`. En la pantalla de juego, la aclaración se muestra más chica, abajo de la palabra.

Las **palabras propias del grupo** se agregan desde la app (*Palabras → Mis palabras*) y quedan solo en ese dispositivo.

## Cómo modificar configuraciones

- **Desde la app**, en *Configuración*: duración de la ronda, casilleros, sonido, vibración, cuenta regresiva y pantalla encendida. También están el respaldo (exportar/importar) y el borrado de datos.
- **En cada partida** (paso 3 de la configuración): tiempo, casilleros, categorías, dificultad y opciones del modo (rondas, vidas, puntos, dado).
- **En el código**:
  - Desafíos y textos de los modos: `app/js/core/modes.js`.
  - Colores y tipografías: variables al inicio de `app/css/styles.css`.
  - Valores predeterminados: `DEFAULT_CONFIG` en `app/js/core/game.js` y `DEFAULT_SETTINGS` en `app/js/app.js`.

## Pruebas

```bash
npm test             # 30 pruebas de la lógica: penalización, dado (chi²), alternancia, victoria, modos, banco
npm start &          # en otra terminal
npm run test:e2e     # punta a punta en Chromium: partida completa, recarga, offline, pantallas
```

## Estructura

```
app/                 PWA publicada (HTML, CSS, JS, fuentes, íconos, banco generado, service worker)
  js/core/           lógica pura, sin DOM (reglas, partida, palabras, estadísticas, almacenamiento)
  js/ui/             componentes: tablero, dado, sonidos, confeti, utilidades DOM
  js/screens/        una pantalla por archivo
data/words/          fuente editable del banco de palabras
tools/               generadores: banco, service worker, íconos
tests/               pruebas unitarias (node --test) y de punta a punta (Playwright)
docs/                propuesta técnica y resumen del banco
```

## Limitaciones actuales

- **Un solo dispositivo por partida.** No hay multijugador en red: el celular pasa de mano en mano, como se pensó para el juego.
- **Datos locales.** Las estadísticas, el historial y las palabras propias se guardan en el navegador de cada dispositivo. Para pasarlos a otro celular, usá *Exportar/Importar respaldo*. Si se borran los datos del navegador, se pierden.
- **Vibración:** no funciona en iPhone, porque Safari no la permite.
- **Pantalla encendida:** depende del navegador (Wake Lock API). En iOS funciona desde la versión 16.4, con la app instalada.
- **Sonidos:** se habilitan después del primer toque en la pantalla (requisito de los navegadores). En iPhone no suenan si el celular está en silencio.
- **Dificultad de los conceptos:** la asignó el equipo de contenido pensando en jugadores de 18 a 20 años. Algunos conceptos pueden parecer más fáciles o más difíciles según el grupo. Si pasa, se pueden mover de sección en `data/words/`.
- **Estadísticas por equipo:** se agrupan por nombre. Si un equipo cambia de nombre, se cuenta como otro.
