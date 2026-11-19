# AGENTS.md

Contexto para cualquier agente que trabaje en este repositorio. Léelo entero antes de tocar código.

## Qué estamos construyendo

**CivicPulse · «Vive más barato y pierde menos tiempo».** Un asistente para estudiantes (y particulares en general) que cruza datos abiertos oficiales para decirles cómo moverse y cuándo gastar energía de forma que les cueste lo mínimo, en euros y en minutos.

Es el MVP de la hackatón **2Campus1Code** (DAETSISI · DAETSIINF · Orange), que dura 6 horas en total repartidas en dos días y empezó el 2026-11-19. El enunciado completo está en `README.md`. Lo que exige y no puede romperse:

- Consumir al menos una fuente oficial de datos abiertos (API o CSV/JSON/GeoJSON).
- Tener frontend y backend con una arquitectura estructurada.
- Aportar valor más allá de mostrar datos: cruces de fuentes, recomendaciones, cálculos.
- Repositorio público con un historial de commits coherente.
- `AI_USAGE.md` actualizado y enlaces a cada fuente de datos (sección «Fuentes de datos abiertas» del `README.md`).
- El equipo tiene que poder explicar cualquier línea ante el jurado. Prima el código simple y legible sobre el ingenioso.

### Las tres secciones del producto

1. **Mi trayecto** (en curso). Navegación en coche, a pie y en bici desde un punto (el actual o uno del mapa) hasta otro (un campus o cualquier punto), comparada con el transporte público.
   - **Ruta:** Valhalla (motor local sobre OpenStreetMap): respeta sentidos únicos y zonas peatonales y da indicaciones en castellano. CartoCiudad queda como respaldo oficial (sin sentidos ni indicaciones). No hay seguimiento GPS: no es una app móvil.
   - **Coche:**
     - Esquiva los cortes totales de la DGT y suma un retraso estimado por sus avisos de tráfico lento. El tráfico en vivo del Ayuntamiento se añadirá cuando se pueda acceder.
     - Coste según la gasolinera más barata cerca de la ruta.
     - Cámaras a menos de 300 m de la ruta, con foto en directo.
     - Incidencias de la DGT y radares fijos.
     - Coste en € y CO₂ por viaje y por mes.
   - **Metro / Cercanías:** horarios del GTFS del CRTM, retraso real de Renfe (GTFS-RT) con sus avisos, y coste con el abono, que el usuario puede editar.
   - **Resultado:** € y minutos de cada opción al día y al mes, y CO₂ con los factores oficiales del MITECO.
2. **Mi casa** (sin empezar). Las horas más baratas de la luz hoy (PVPC) para poner la lavadora o cargar el coche, y cuánto se ahorra al mes.
3. **Mi barrio** (sin empezar). Qué parte de la renta de tu zona se va en moverte y en energía.
4. **Resumen final:** «Este mes puedes ahorrar X € y Y minutos si…».

Los campus de referencia son **Campus Sur** (ETSISI, UPM, `40.3896, -3.6283`) y **Montegancedo** (ETSIINF, UPM, `40.4055, -3.8399`).

## Prioridad actual: que todo funcione en local

El objetivo es que **todo funcione en la máquina de desarrollo**, incluidas las piezas pensadas para el edge. El despliegue remoto llegará después y ahora no hay que preocuparse de él.

- **Cloudflare Workers sí se usan.** Sirven para la ingesta en el edge de las capas que cambian poco (cámaras DGT, gasolineras), y se desarrollan y prueban en local con `wrangler dev` (Miniflare). No hace falta tenerlos funcionando en remoto.
- **API y Postgres corren en local** (Docker). Más adelante irán al VPS de empresa (6 vCPU, 12 GB).
- **Nada de configuración específica de producción** (VPS, reverse proxy, `wrangler deploy`, dominios) hasta que se pida. Existe `.github/workflows/ci.yml`, pero no es prioridad.

## Estado actual (2026-11-19)

**Hecho y verificado:**

- Monorepo con workspaces de Bun y la misma organización que `quirkminds/ambar` (plantilla de la empresa), con solo dos apps.
- `apps/web`: pantalla de «Mi trayecto» funcionando con **datos de ejemplo**:
  - Mapa (mapcn/MapLibre) con la ruta Sol → Campus Sur y una franja de 300 m alrededor.
  - Cámaras del Ayuntamiento dentro de la franja, con foto en directo.
  - Panel lateral con distancia, tiempo sin tráfico, número de cámaras y lista ordenada por km. Al pulsar una cámara, el mapa vuela hasta ella.
  - Pestañas «Mi casa» y «Mi barrio» como marcadores de posición.
  - Selector de modo coche / transporte; el modo transporte enseña «Próximamente».
- `apps/api`:
  - Esqueleto Go con chi, que arranca y aplica la migración `00001_postgis.sql` (activa PostGIS).
  - `GET /healthz` hace ping a Postgres.
  - CORS por `ALLOWED_ORIGINS`, logs con slog y apagado limpio.
  - Tests de health, CORS y entorno.
- `apps/api/openapi.yaml` describe `/healthz`, `/v1/trip`, `/v1/electricity/now`, `/v1/electricity/today`, `/v1/transit/cercanias` y `/v1/neighborhood/zones`. Pasa `lint:openapi` sin avisos.
- `apps/api/sources`: un parser por fuente oficial (CartoCiudad, cámaras Ayto./DGT, incidencias DGT, carburantes, Renfe GTFS/GTFS-RT, REE PVPC), con tests sobre fragmentos de respuestas reales. Los usarán la ingesta y los handlers.
- **API con datos reales** (`/v1`, contrato en `openapi.yaml`):
  - `GET /v1/trip?mode=car|walk|bike`: ruta de Valhalla con indicaciones (respaldo: CartoCiudad), cruzada en PostGIS (`ST_DWithin`) con incidencias a ≤500 m y, en coche, gasolineras a ≤1 km, cámaras a ≤300 m y coste € por trayecto y por mes con la gasolinera más barata. En coche esquiva los cortes totales de la DGT (`exclude_polygons`) y estima el retraso por tráfico lento (`store/traffic.go`). 0,1–0,4 s.
  - `GET /v1/electricity/today`: PVPC por horas en €/kWh y franja más barata de 1, 2 y 3 h (caché de 15 min).
  - `GET /v1/transit/cercanias`: trenes, retrasos y avisos por línea de Cercanías Madrid (GTFS en memoria + GTFS-RT con caché de 30 s).
- **Ingesta** (`apps/api/ingest`): al arrancar y luego periódicamente carga en PostGIS gasolineras (30 min), incidencias DGT (5 min), cámaras DGT (6 h) y del Ayuntamiento (24 h). Cada intento queda en `ingest_runs`. Si el Ayuntamiento no responde y la tabla está vacía, carga el fixture `ingest/fallback/cameras-madrid.json`.
- La web usa `/v1/trip`: modos coche, a pie y bici; origen y destino con el buscador de CartoCiudad desde el navegador (`lib/geocoder.ts`, `features/trayecto/place-search.tsx`), «Mi ubicación», los atajos de campus o arrastrando los marcadores (que se nombran con `reverseGeocode`); cámaras siempre visibles sobre la ruta; indicaciones paso a paso; avisos DGT; coste, gasolineras, incidencias y cámaras. Sin API, sirve `mocks/trip-{car,walk,bike}-sol-campus-sur.json` (respuestas reales guardadas).
- `bun run probe` (`apps/api/probe.go`): comprueba que cada fuente responde y que sus datos se cruzan sobre las rutas a los campus. Hoy 9 de 10 dan OK; solo falla el Ayuntamiento (bloqueo).
- Web: selector de mapa base (Callejero CARTO · IGN · Satélite PNOA) en `lib/basemaps.ts`. El estilo del IGN se parchea (`patchIgnStyle`) porque sin `maxzoom` se queda en blanco por encima de z17 y no declara atribución.
- Pasan `typecheck`, `lint`, `lint:openapi`, `test` y `build`.

**Pendiente, en orden:**

1. Modo transporte en la web con `/v1/transit/cercanias` (estado por línea). Después, trayecto en Cercanías con horarios (`stop_times`, 270 MB: ingerir solo Madrid). Metro cuando haya API key del NAP.
2. «Mi casa» en la web con `/v1/electricity/today`.
3. CO₂ con los factores MITECO (por confirmar los valores) y combustible/consumo editables en la web (la API ya acepta `fuel`, `consumption` y `days`).
4. «Mi barrio» con INE ADRH.
5. Tráfico en vivo y cámaras del Ayuntamiento cuando se resuelva el bloqueo. Hasta entonces, fixture.

No hagas commit ni push salvo que te lo pidan.

## Arranque en local

```sh
bun install
bun run dev:web                                  # http://localhost:5173, con datos de ejemplo
bun run --filter @civicpulse/api routing:download # mapa OSM de Madrid para Valhalla (86 MB, una vez)
bun run --filter @civicpulse/api db:up           # Postgres 18 + PostGIS 3.7 y Valhalla en Docker (Colima)
cp apps/api/.env.example apps/api/.env.local     # si no existe
bun run dev:api                                  # http://localhost:8080/healthz
bun run probe                                    # comprueba y cruza todas las fuentes oficiales en vivo
```

- **Conectar la web a la API:** añade `VITE_API_URL=/` en `apps/web/.env.local` y arranca las dos con `bun run dev`. Vite reenvía `/v1` y `/healthz` a la API (`API_PROXY_TARGET`, por defecto `http://localhost:8080`), así que toda la app se ve en http://localhost:5173. Sin esa variable, la web usa `apps/web/src/mocks/` y muestra el badge «Datos de ejemplo».
- **Base de datos:** escucha en `127.0.0.1:5434`, porque el 5432 lo usa ambar y el 5433 otro proyecto. La imagen oficial `postgis/postgis` solo existe para amd64; en Apple Silicon corre con Rosetta (`platform: linux/amd64` en `compose.yaml`).
- **Motor de rutas:** Valhalla en `127.0.0.1:8002` (`VALHALLA_URL` en `apps/api/.env.local`). La primera vez construye las teselas (~1 min; `routing:logs` para seguirlo). Con 2 GB en Colima se construye sin fronteras administrativas y con un hilo (ver `compose.yaml`); si aun así se queda sin memoria, para la base de datos mientras construye. Sin Valhalla, la API usa CartoCiudad (sin bici).
- **Apagar:** `bun run --filter @civicpulse/api db:down`.

## Estructura

```
apps/
  web/  @civicpulse/web: Vite + React 19 + TS + Tailwind v4 + shadcn/ui (Radix, preset Nova) + mapcn
    src/
      components/ui/       shadcn + mapcn (map.tsx). Generado por CLI; parches mínimos marcados «CivicPulse:»
      features/trayecto/   use-trayecto.ts (datos), trayecto-map.tsx (mapa), trayecto-panel.tsx (panel)
      dev/                 galería del design system en /dev (solo `vite dev`, fuera del build): sections.ts,
                           dev-gallery.tsx, pages/<sección>.tsx, components/specimen.tsx (Specimen, Surface)
      lib/                 api.ts (cliente + mocks), geo.ts (Turf), basemaps.ts (CARTO/IGN/PNOA), types.ts, format.ts, campus.ts
      mocks/               GeoJSON reales: route-sol-campus-sur.json, cameras-madrid.json (357 cámaras)
      env.ts, api-url.ts   variables públicas validadas con Valibot (también en vite.config.ts)
  api/  @civicpulse/api: Go + chi + pgx + goose
    main.go                entorno (solo aquí), arranque y apagado
    routes.go              todas las rutas, health, writeJSON / writeProblem
    middleware.go          logs por petición y CORS
    trip.go, electricity.go, transit.go   un handler por endpoint de /v1, con su cálculo puro testeado
    cache.go               caché en memoria por clave y TTL para fuentes que se piden bajo demanda
    probe.go               `api probe`: consulta y cruza todas las fuentes (bun run probe)
    sources/               un fichero por fuente oficial: descarga + parseo a tipos propios, con tests
    routing/               cliente de Valhalla (rutas, indicaciones, exclusión de cortes), con respuesta real en testdata/
    store/                 todo el SQL: escritura de capas y cruces con la ruta en PostGIS
    ingest/                carga periódica de capas a PostGIS (+ fixture de respaldo del Ayuntamiento)
    geo/                   distancia punto-punto y punto-polilínea, decodificador de polilíneas (precisión 5 y 6)
    migrations/            SQL embebido, aplicado al arrancar
    openapi.yaml           contrato con la web: se actualiza ANTES de escribir el endpoint
    compose.yaml           base de datos y motor de rutas (Valhalla) de desarrollo
```

Cada sección nueva del producto va en su carpeta: `features/casa/`, `features/barrio/`. No hay `packages/`: el proyecto no es multiplataforma, y lo que comparten web y API es el contrato OpenAPI, no código.

## Fuentes de datos

**El inventario completo está en `docs/fuentes-de-datos.md`.** Incluye organismo, acceso, CORS, licencia, dónde se consume y el estado verificado de cada fuente. Actualízalo en el mismo cambio que toque una fuente.

- **Comprobación:** `bun run probe` consulta todas las fuentes en vivo y cruza sus datos con las rutas a los campus. Ejecútalo antes de dar por buena una fuente o tras cambiar un parser.
- **Verificadas:** OpenStreetMap + Valhalla (rutas), CartoCiudad (rutas de respaldo y geocodificador), mapas base IGN (vectorial y PNOA), carburantes (Ministerio), DGT (cámaras e incidencias, DATEX II), Renfe Cercanías (GTFS y GTFS-RT, que casan al 100 %) y REE PVPC (REData, sin token).
- **Bloqueadas o pendientes:**
  - Ayuntamiento de Madrid (`*.madrid.es` corta la conexión desde nuestra IP; usa los fixtures).
  - Metro del CRTM: el feed público caducó; el vigente está en el NAP y pide API key.
  - INE ADRH: falta la tabla de Madrid.
  - MITECO: faltan los valores de CO₂.
- **CORS:** las rutas de CartoCiudad, DGT, Renfe e informo.madrid.es **no** tienen CORS y pasan por la API. El geocodificador de CartoCiudad, las teselas del IGN, carburantes y REData **sí**.
- **No supongas el esquema de una fuente:** descárgala y compruébala antes.

## Decisiones ya tomadas (no las reabras)

- **Bun** como gestor de paquetes, runtime y test runner. Prohibidos npm, pnpm y yarn. Usa `bun add` dentro de la app y `bunx --bun`, y mantén un solo `bun.lock` en la raíz. Reinicia el dev server tras cambiar dependencias.
- **El frontend es React + Vite.** El mapa es **mapcn**: primero lo que trae de serie.
  - `MapRoute` para rutas.
  - `MapMarker` con `MarkerPopup`/`MarkerTooltip` para puntos.
  - `MapClusterLayer` para cientos de puntos.
  - `MapGeoJSON` para zonas y coropletas; el bloque `@mapcn/choropleth` sirve para «Mi barrio».
  - `useMap()` para la instancia de MapLibre.
  - El mapa base es CARTO, sin API key.
- **Reparto del trabajo geoespacial:**
  - El cálculo pesado va en **PostGIS** (`ST_DWithin` sobre `geography` con índice GiST).
  - **Turf** se usa en el cliente solo para lo interactivo y ligero: la franja, el km a lo largo de la ruta y el respaldo con mocks.
  - Importa los paquetes sueltos (`@turf/buffer`, `@turf/nearest-point-on-line`…), nunca `@turf/turf`.
- **Tipografía:** Inter para títulos (`font-heading`, aplicada a h1–h6) y Figtree para el texto (`font-sans`). Se cargan desde el propio proyecto con `@fontsource-variable`.
- **Iconos:** lucide.
- **Backend:** Go + chi + pgx + goose + godotenv, con Postgres 18 y PostGIS.
- **Organización:** la de `quirkminds/ambar`, sin `packages/`. Si se añade un Worker, va en su propia app (`apps/<nombre>`, con su `package.json` y su `wrangler.toml`).

## Convenciones

### Web

- **Componentes de shadcn:** `bunx --bun shadcn@latest add <componente> -c apps/web`. Bloques de mapcn: `@mapcn/<bloque>`.
- **Galería `/dev`:** cada componente nuevo o cambio de estilo se enseña ahí en modo oscuro (`Surface`). Una sección nueva es una entrada en `src/dev/sections.ts` y su página en `src/dev/pages/`, registrada en `dev-gallery.tsx`.
- **Tema:** toda la interfaz (app, `/dev` y mapa) es modo oscuro fijo (`<html class="dark">` y tokens únicos en `:root` de `src/index.css`).
- **`cn`:** en esta versión de shadcn, `cn` es un paquete npm real, reexportado en `src/lib/utils.ts`. No lo quites.
- **Estilos:** todo con Tailwind. `src/index.css` es el único CSS global; solo se toca para tokens, variables de shadcn y fuentes.
- **Datos:** todo pasa por `src/lib/api.ts`. Los tipos de dominio están en `src/lib/types.ts` y siguen `openapi.yaml`.
- **Coordenadas:** siempre `[lng, lat]` (GeoJSON y MapLibre). CartoCiudad recibe `lat,lng` en la query; la conversión vive en `api.ts` y en la API.
- **TypeScript:** es estricto (`noUncheckedIndexedAccess`). Usa guardas reales; no recurras a `!` ni a `as` sin justificar. `pointLngLat()` de `lib/geo.ts` extrae las coordenadas de un punto.
- **Efectos:** el lint impone `react-hooks/exhaustive-deps`. Nada de `eslint-disable`: deriva el estado, o usa `useEffectEvent` para leer los últimos valores.
- **Tests:** `bun:test`, junto al fichero (`*.test.ts`). La lógica pura va en `lib/` y se testea.

### API

- **Estructura:** `package main` plano. Crea un paquete solo cuando haya código que separar, con el nombre de lo que hace (`cartociudad`, `ingest`, `store`), nunca `utils` ni `common`. Sin carpetas «para luego».
- **Contrato primero:** describe el endpoint en `openapi.yaml` y pasa `bun run lint:openapi`. Después impleméntalo bajo `/v1`, en `routes.go`.
- **Llamadas salientes:**
  - Cada una con su límite de tiempo.
  - Solo se reintentan peticiones idempotentes y fallos transitorios (red, 5xx, 429), con backoff.
  - Los errores del proveedor se traducen a los nuestros, sin copiar su texto.
- **Errores:** RFC 9457 vía `writeProblem`, con un `code` estable en kebab-case.
- **Logs:** `slog` con nombres de OpenTelemetry. Se registra el patrón de la ruta, nunca la query: lleva coordenadas del usuario.
- **Entorno:** se lee solo en `main.go` y cada variable se documenta en `.env.example`.
- **Migraciones:** nuevas en `migrations/NNNNN_nombre.sql` (goose). No edites una migración ya aplicada.
- **Tests:** `go test -race ./...`, y `gofmt` + `go vet` deben quedar limpios.

### Entorno

- **`.env.example`:** uno por app, versionado. Los valores locales van en `.env.local`, que está ignorado.
- **Secretos:** solo en `apps/api`. Las variables `VITE_` acaban en JavaScript público.

## Reglas para agentes

- **Antes de cambiar código**, lee los ficheros afectados y respeta lo que ya hay. No cambies la estructura ni el stack.
- **Mantente en tu tarea.** Si ves algo fuera de alcance, apúntalo en tu informe en lugar de arreglarlo.
- **No hagas commit, push ni despliegue remoto** (incluido `wrangler deploy`) salvo que te lo pidan explícitamente.
- **No metas datos personales** del equipo en el código, en las peticiones a servicios externos ni en los fixtures.
- **Al terminar**, informa de qué cambiaste, qué verificaste (con la salida real) y qué queda pendiente. Si un check falla, dilo.

## Pendiente de decidir

- **Idioma del código.** Ahora la interfaz, la documentación y los comentarios están en español, y los identificadores mezclan inglés con nombres de sección en español (`trayecto`). Ambar obliga a usar solo inglés; aquí no se ha decidido. Sigue lo que haya en el fichero que toques.

## Antes de terminar

```sh
bun run typecheck
bun run lint
bun run lint:openapi
bun run test
bun run build
```
