# Tinparatan

Nueva pestaña, tema y arranque para [Helium](https://github.com/imputnet/helium). El escudo, el wordmark `>tinparatan_` y la búsqueda viven en una página que se abre al instante, se personaliza entera y no habla con ningún servidor.

Todo el código, las fuentes y los medios van dentro de la extensión. Los ajustes se guardan en `chrome.storage.local`. Las imágenes, GIF, SVG y vídeos van a IndexedDB en este equipo.

## Instalar en Helium

1. Descarga `tinparatan-extension.zip` y descomprímelo. Tiene que quedar una carpeta con `manifest.json` en la raíz.
2. Abre `helium://extensions`. Si Helium no reconoce esa dirección, usa `chrome://extensions`.
3. Activa el **modo de desarrollador**.
4. Pulsa **Cargar descomprimida** y elige esa carpeta. No hace falta compilar nada.
5. Abre una pestaña nueva.

Si Helium pregunta qué extensión controla la página de nueva pestaña, elige **Tinparatan**.

Si sigues viendo la página de inicio de Helium:

- En `helium://extensions`, abre los detalles de Tinparatan y comprueba que está activada. Si quieres la misma página en incógnito, activa «Permitir en incógnito».
- Si otra extensión también pide la nueva pestaña, desactívala o confirma el aviso del navegador para que mande Tinparatan.
- La página de **inicio** (al abrir el navegador) y la página de **nueva pestaña** no son la misma. En los ajustes de Helium, deja la página de nueva pestaña en su valor predeterminado. Una URL de inicio personalizada no sustituye a esta extensión, pero sí puede ser lo primero que ves al arrancar.
- Recarga la extensión desde `helium://extensions` si acabas de actualizar los archivos.

## Tema del marco

Una extensión no puede recolorear la barra, las pestañas ni el marco. Eso solo lo hace un tema de Chromium, que se carga como su propia extensión descomprimida (solo hay un tema activo a la vez). Hay dos incluidos: `themes/tinparatan-theme` (azul noche y rojo del escudo) y `themes/tinparatan-noir` (marco casi negro con brillo rojo e imágenes). En **Ajustes → Tema del navegador** puedes descargar cualquiera de los dos como `.zip`, o **generar** uno con los colores de tu preset actual, y abrir la página de extensiones con un clic.

1. Descomprime el zip del tema, o entra en la carpeta `themes/tinparatan-theme` del repositorio.
2. En `helium://extensions`, con el modo de desarrollador activo, **Cargar descomprimida** y elige esa carpeta (la que contiene su propio `manifest.json`).
3. El tema se aplica al cargarlo. Para volver al aspecto de Helium, quita la extensión del tema.

El tema no cambia la nueva pestaña: de eso se ocupa la extensión principal. Tampoco cambia el nombre del navegador.

## Icono en Windows

El archivo `assets/tinparatan.ico` incluye los tamaños 16, 24, 32, 48, 64, 128 y 256, generados desde el logotipo.

Esto cambia el icono del **acceso directo** y, si anclas ese acceso, el de la barra de tareas. No cambia el ejecutable de Helium ni el icono que el programa muestra en su propia interfaz.

1. Cierra Helium.
2. Clic derecho en el acceso directo (escritorio o menú Inicio) → **Propiedades** → pestaña **Acceso directo** → **Cambiar icono…**.
3. **Examinar…** y elige `tinparatan.ico`. Aceptar y Aplicar.
4. Si la barra de tareas sigue con el icono anterior, desancla Helium, ancla de nuevo el acceso directo ya actualizado y, si hace falta, reinicia el Explorador de Windows. Windows guarda una caché de iconos.

En Linux puedes apuntar la clave `Icon=` de un archivo `.desktop` a `assets/icons/icon-128.png`. Es el mismo límite: el acceso directo, no el programa.

## Qué no puede cambiar una extensión

Helium es Chromium. El modelo de extensiones Manifest V3, por diseño, no llega al producto en sí:

- **El nombre.** La ventana, `helium://settings`, la página de información y el texto del sistema siguen diciendo Helium. Una extensión no puede renombrar el navegador.
- **El icono de la aplicación.** El `.exe` (y el icono que Windows asocia al programa, no al acceso directo) no se puede sustituir desde una extensión. El `.ico` de arriba es un cambio manual del acceso directo.
- **El cromo del navegador.** La forma de las pestañas, la barra de herramientas, los menús, los botones de la ventana, la omnibox y las páginas internas no se redibujan con HTML de una extensión. Un **tema** solo puede cambiar colores (y, si se incluyen, imágenes de fondo del marco). Por eso el tema va en una carpeta aparte.
- **Otras páginas.** Tinparatan no inyecta scripts en las webs que visitas ni modifica `helium://` ni `chrome://`.

Lo que sí cubre esta extensión es todo lo que el modelo permite sin salir del equipo: la nueva pestaña, el botón de la barra, la página de opciones y, con el tema, el color del marco.

## Qué incluye

- Nueva pestaña con el logotipo, el wordmark en máquina de escribir y la búsqueda. El fondo oscuro está en el HTML para que no haya un destello blanco. Las animaciones respetan `prefers-reduced-motion` y el ajuste Animaciones (sistema, activadas o desactivadas). Los efectos de lienzo se pausan cuando la pestaña no se ve.
- Ajustes con vista previa en vivo, abiertos desde el engranaje o desde el menú de la extensión. Logo propio (PNG, JPG, GIF, WebP, SVG) o ninguno. Wordmark, fuente, tamaño, color y cursor. Posición y orden. Fondos de color, gradiente, imagen, vídeo o efecto (estrellas, partículas, aurora, matrix, brasas), con desenfoque, oscurecido y brillo. Seis presets y presets guardados por ti. Búsqueda (DuckDuckGo por defecto, Google, Brave, Startpage, Bing o una URL con `%s`). Accesos directos con el icono del propio sitio (por defecto, desde la caché local de favicons del navegador; si no hay, la inicial), letra, emoji o imagen. Widgets de reloj, fecha, saludo, notas y pendientes. CSS propio. Exportar e importar un JSON. Restablecer.
- Al arrancar el navegador, las pestañas fijadas que Chromium deja sin cargar se despiertan, con espera y escalonado. Puedes definir URL que deben existir fijadas, sin duplicar las que ya están. El botón del popup también puede recargarlas ahora.
- Popup con el preset, el interruptor de animaciones, la recarga y el acceso a los ajustes.
- Textos en español. English está en `lib/locales/en.js` y se activa en Avanzado → Idioma. Añadir otro idioma es un archivo con las mismas claves.

Las fuentes (JetBrains Mono, Inter, Space Grotesk, Fraunces, IBM Plex Mono) van en `assets/fonts/` bajo SIL OFL. Ver `assets/fonts/LICENSES.md`.

## Privacidad

La extensión no tiene analítica, ni código remoto, ni peticiones de red propias. Buscar o abrir un acceso es una navegación normal que tú inicias. En el CSS personalizado se eliminan `@import`, `expression` y las `url()` que apuntan a internet.

Permisos:

- `storage` e `unlimitedStorage`: ajustes y medios locales, también vídeos grandes.
- `tabs`: leer las URL de las pestañas para no duplicarlas, fijarlas y recargarlas.
- `alarms`: un segundo intento de carga por si la sesión se restaura tarde.

## Desarrollo

Los archivos se cargan tal cual. No hay paso de compilación.

```bash
node --test tests/logic.test.mjs
```

El comportamiento de arranque de las pestañas fijadas (`chrome.runtime.onStartup`) no se puede reproducir abriendo una ventana ya iniciada: hace falta cerrar el navegador por completo y volver a abrirlo con la extensión instalada.
