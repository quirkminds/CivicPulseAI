<img width="3950" height="868" alt="2c1c-encadenados-logo-fondo-oscuro" src="https://github.com/user-attachments/assets/6c74e246-e94f-417c-8e98-ac9a276aa3a9" />

# 🚀 2Campus1Code - Hackatón DAETSISI-DAETSIINF-ORANGE

Desarrolla un MVP de una aplicación web que consuma al menos una fuente oficial de datos abiertos y la transforme en un servicio útil, visual e interactivo para la ciudadanía. Al acabar, presenta tu solución a los jueces.

## 🎯 Hitos mínimos

- 📊 Consumir datos abiertos de una fuente oficial (API o datasets CSV/JSON/GeoJSON).
- 🏗️ Disponer de frontend y backend (o funciones serverless) con una arquitectura estructurada.
- ✨ Aportar valor más allá de mostrar datos: filtrado, visualizaciones, recomendaciones, cruce de fuentes, etc.
- 🐙 Mantener el código en un repositorio público con un historial de commits coherente.

## 🤖 Uso de IA

Se permite y fomenta el uso de herramientas de IA para el desarrollo.

Durante la evaluación:

- 🧠 Debéis poder explicar cualquier parte del código o decisión técnica
- 📝 El repositorio debe incluir un archivo `AI_USAGE.md` describiendo brevemente las herramientas utilizadas y su contribución al desarrollo.


## ⏱️ Duración

6 horas de desarrollo en total, repartidas entre los dos días que dura la hackatón.

## 📦 Entregables

El repositorio final debe incluir:

- 💻 Código fuente completo y funcional.
- 📄 `AI_USAGE.md`.
- 🔗 Enlaces a las fuentes de datos abiertas utilizadas.

---

## 💸 Nuestro proyecto: Vive más barato y pierde menos tiempo

Un asistente para estudiantes y particulares que les dice cómo moverse y cuándo gastar energía para que les cueste lo mínimo, en euros y en minutos, con datos oficiales.

- **Mi trayecto:** coche o transporte público hasta el campus, con tiempo, coste, CO₂ y cámaras en la ruta.
- **Mi casa:** las horas más baratas de la luz.
- **Mi barrio:** qué parte de la renta de tu zona se va en moverte y en energía.

### Estructura

```
apps/
  web/   Vite + React + Tailwind + shadcn/ui + mapcn (MapLibre)
  api/   Go + chi + PostgreSQL/PostGIS: ingesta de fuentes y API (contrato en openapi.yaml)
```

### Arranque

```sh
bun install
bun run dev:web                                # http://localhost:5173 con datos de ejemplo
bun run --filter @civicpulse/api db:up         # Postgres 18 + PostGIS en Docker
cp apps/api/.env.example apps/api/.env.local
bun run dev:api                                # http://localhost:8080/healthz
```

Para que la web use la API, pon `VITE_API_URL=http://localhost:8080` en `apps/web/.env.local`.

### Cargar «Mi barrio»

Con PostGIS y la API arrancados, carga los originales oficiales en la base local. El primer arranque
de la API aplica la migración. El importador requiere uv, Docker Compose y curl.

```sh
bun run --filter @civicpulse/api db:import-neighborhood --cache "$PWD/.cache/ine"
```

La primera descarga ocupa alrededor de 900 MB y la importación tarda unos minutos. Las siguientes cargas aprovechan el caché.
Abre «Mi barrio» con `VITE_API_URL` configurada. Selecciona una zona en el mapa o en la lista
y pulsa «Ver…» para bajar al siguiente nivel territorial.

### 🔗 Fuentes de datos abiertas

| Fuente | Uso |
| --- | --- |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) (© OpenStreetMap contributors, ODbL), [extracto de Madrid de Geofabrik](https://download.geofabrik.de/europe/spain/madrid.html), con el motor [Valhalla](https://github.com/valhalla/valhalla) | Rutas en coche, a pie y en bici con indicaciones |
| [CartoCiudad (IGN/CNIG), API de rutas](https://www.cartociudad.es/services/api/route?orig=40.4168,-3.7038&dest=40.3896,-3.6283&locale=es&vehicle=CAR) | Ruta de respaldo en coche y a pie |
| [DGT, incidencias de tráfico (DATEX II)](https://nap.dgt.es/en/dataset/incidencias-dgt-datex2-v3-7) | Cortes que la ruta esquiva, tráfico lento e incidencias |
| [Ayuntamiento de Madrid, cámaras de tráfico (CCTV.kml)](https://informo.madrid.es/informo/tmadrid/CCTV.kml) | Cámaras de la ruta con foto en directo |
| © OpenStreetMap contributors · © CARTO | Mapa base |
| [INE · Atlas de Distribución de Renta de los Hogares](https://ine.es/dyngs/INEbase/es/operacion.htm?c=Estadistica_C&cid=1254736177088&idp=1254735976608&menu=resultados) | Renta y demografía por zona |
| [INE · Cartografía de secciones censales](https://www.ine.es/dyngs/DAB/es/index.htm?cid=1389) | Límites del atlas territorial |
