# Uso de IA

| Herramienta | Contribución |
| --- | --- |
| Claude Code (Claude Opus 5.5) | Estructura del monorepo (workspaces de Bun, `apps/web` y `apps/api`, CI, lint), montaje del frontend (Vite, Tailwind, shadcn, mapcn), esqueleto de la API en Go (chi, PostGIS, goose, OpenAPI), investigación y clasificación de las fuentes oficiales, parsers de cada fuente y la comprobación `bun run probe`, conversión de las fuentes (polilínea de CartoCiudad y KML de cámaras) a GeoJSON de prueba, utilidades geoespaciales con Turf, tests y primera pantalla de «Mi trayecto». Navegación de «Mi trayecto»: motor de rutas Valhalla en local sobre OpenStreetMap (coche, a pie y bici, indicaciones en castellano), esquive de cortes y retraso estimado con las incidencias de la DGT en PostGIS, y origen y destino arrastrables en el mapa. El equipo revisa y valida todo el código. |
| Codex | Investigación y verificación de las descargas del INE. Ingesta versionada del Atlas en PostGIS, contrato y consulta en Go y mapa interactivo de «Mi barrio». |
