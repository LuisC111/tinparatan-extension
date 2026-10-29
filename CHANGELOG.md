# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones según [SemVer](https://semver.org/lang/es/).

## [1.3.0] - 2026-10-28

### Añadido

- Saludo según la hora antes del nombre: Buena madrugada, Buenos días, Buen mediodía, Buenas tardes o Buenas noches. Se actualiza solo, sin recargar. Opción de **Saludo fijo** para escribir el tuyo.
- **Degradado según la hora** en el saludo (activado por defecto): siete fases (madrugada, amanecer, mañana, mediodía, tarde, atardecer, noche) con un movimiento lento y transición suave entre fases. Quieto con `prefers-reduced-motion` o Animaciones desactivadas.
- **Ubicación del saludo**: sobre el logo, entre logo y wordmark (por defecto), debajo del wordmark o debajo de la búsqueda.
- Sección **Reloj y fecha** en los ajustes, con vista previa en vivo. Cada uno por separado: tamaño, fuente (las del nombre o la del tema), grosor, efecto (Del tema, Sólido, Degradado, Neón, Caricatura, Pop, Gomita, Prism o **Según la hora**), colores, espaciado entre letras y opacidad.
- Reloj: 24 h o 12 h, segundos e indicador a. m./p. m. completo («p. m.»), corto («pm») u oculto.
- Fecha: formatos «Miércoles, 28 De Octubre», «miércoles 28 de octubre», con año, «28/10/2026» y «Mié 28 Oct», y mayúsculas (Cada Palabra, Solo la primera, minúsculas, MAYÚSCULAS).
- **Alineación del texto** de la búsqueda: izquierda (por defecto), centro o derecha.

### Cambiado

- El saludo es más grande: un 74 % del tamaño del nombre, alineado a la misma línea base.
- Se quitó el widget de saludo de arriba. El reloj y la fecha siguen igual. Ajustes en versión 3: el nombre del widget viejo pasa al perfil.
- Con el texto centrado o a la derecha no se muestra el completado en gris (Tab lo sigue aceptando).
- Todos los controles de la búsqueda (sugerencias y la «x» para borrar) usan el cursor de mano.

## [1.2.1] - 2026-10-28

### Corregido

- La vista previa de los ajustes se ajusta con `ResizeObserver` sin bucles.

## [1.2.0] - 2026-10-28

### Añadido

- Sugerencias de búsqueda mientras escribes, con Google (por defecto), DuckDuckGo o Brave. Espera de 120 ms entre teclas y cancelación de las peticiones viejas.
- Ajuste **Motor de sugerencias** en Búsqueda: Google, DuckDuckGo, Brave o Desactivado.
- Los accesos directos que coinciden se mezclan con las sugerencias. El historial es opcional y se lee en local con el permiso `history`, que se pide al activarlo.
- Lista desplegable con efecto cristal y animación, iconos por tipo (búsqueda, dirección, acceso, historial), coincidencia resaltada y completado en gris dentro de la barra.
- Teclado: ↑/↓, Intro, Tab o → para aceptar, Esc para cerrar. También funciona con el ratón.
- Nombre de usuario al estilo Discord encima de `>tinparatan_` («Hola, Lucho»).
- Sección **Nombre de usuario** en los ajustes: nombre, tamaño, saludo, 12 fuentes, 7 efectos (Sólido, Degradado, Neón, Caricatura, Pop, Gomita, Prism), colores, degradados prediseñados, tarjeta de perfil en vivo y botón **Sorpréndeme**.
- 11 fuentes nuevas bajo SIL OFL: Montserrat, Playfair Display, UnifrakturMaguntia, Pacifico, Caveat, Fredoka, Bebas Neue, Press Start 2P, Bangers, Orbitron y Lobster.
- `CHANGELOG.md`.

### Cambiado

- Ajustes en versión 2. El nombre del widget de saludo pasa al perfil, sin perder nada.
- Permisos de host solo para las tres direcciones de sugerencias.
- Las animaciones del nombre respetan `prefers-reduced-motion` y el ajuste Animaciones.

## [1.1.0]

### Añadido

- Sección **Tema del navegador**, con un generador de temas desde el preset y el tema Noir.
- Icono del sitio por defecto en los accesos directos.

### Corregido

- Selector de icono en los accesos directos.

## [1.0.0]

- Primera versión: nueva pestaña con logotipo, wordmark y búsqueda, ajustes con vista previa, fondos, presets, widgets, pestañas fijadas al arrancar, popup y tema del marco.
