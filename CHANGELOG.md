# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versiones según [SemVer](https://semver.org/lang/es/).

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
