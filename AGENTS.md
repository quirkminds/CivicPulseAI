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

1. **Mi trayecto** (en curso). Compara coche y transporte público desde casa hasta el campus.
   - **Coche:**
     - Ruta y tiempo de CartoCiudad, que usa velocidades fijas: sin tráfico y sin sentido de las calles. Ese tiempo se ajusta con el tráfico en vivo del Ayuntamiento.
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
- `apps/api/openapi.yaml` describe `/healthz`, `/v1/route` y `/v1/cameras`. Pasa `lint:openapi` sin avisos.
- `apps/api/sources`: un parser por fuente oficial (CartoCiudad, cámaras Ayto./DGT, incidencias DGT, carburantes, Renfe GTFS/GTFS-RT, REE PVPC), con tests sobre fragmentos de respuestas reales. Los usarán la ingesta y los handlers.
- `bun run probe` (`apps/api/probe.go`): comprueba que cada fuente responde y que sus datos se cruzan sobre las rutas a los campus. Hoy 9 de 10 dan OK; solo falla el Ayuntamiento (bloqueo).
- Web: selector de mapa base (Callejero CARTO · IGN · Satélite PNOA) en `lib/basemaps.ts`. El estilo del IGN se parchea (`patchIgnStyle`) porque sin `maxzoom` se queda en blanco por encima de z17 y no declara atribución.
- Pasan `typecheck`, `lint`, `lint:openapi`, `test` y `build`.

**Pendiente, en orden:**

1. `GET /v1/route` en Go sobre `sources.Route` (validar `vehicle`, devolver el esquema `Route` de `openapi.yaml`).
2. Ingesta a PostGIS (migración con tablas e índices GiST) de gasolineras, cámaras DGT e incidencias DGT. Endpoints que devuelvan lo que hay cerca de una ruta con `ST_DWithin`.
3. Origen editable con el geocodificador de CartoCiudad (desde el navegador, filtrando por Madrid).
4. Coste del coche: gasolinera más barata a ≤1 km de la ruta, € por viaje y por mes, y CO₂ (factores MITECO por confirmar).
5. Cercanías: horarios del GTFS de Renfe + retrasos GTFS-RT (`route_id` `10T*`). Metro cuando haya API key del NAP.
6. «Mi casa» con REE PVPC (REData). «Mi barrio» con INE ADRH.
7. Tráfico en vivo y cámaras del Ayuntamiento cuando se resuelva el bloqueo. Hasta entonces, fixtures.

**Nada está commiteado todavía.** No hagas commit ni push salvo que te lo pidan.

## Arranque en local

```sh
bun install
bun run dev:web                                  # http://localhost:5173, con datos de ejemplo
bun run --filter @civicpulse/api db:up           # Postgres 18 + PostGIS 3.7 en Docker (Colima)
cp apps/api/.env.example apps/api/.env.local     # si no existe
bun run dev:api                                  # http://localhost:8080/healthz
bun run probe                                    # comprueba y cruza todas las fuentes oficiales en vivo
```

- **Conectar la web a la API:** añade `VITE_API_URL=http://localhost:8080` en `apps/web/.env.local`. Sin esa variable, la web usa `apps/web/src/mocks/` y muestra el badge «Datos de ejemplo».
- **Base de datos:** escucha en `127.0.0.1:5434`, porque el 5432 lo usa ambar y el 5433 otro proyecto. La imagen oficial `postgis/postgis` solo existe para amd64; en Apple Silicon corre con Rosetta (`platform: linux/amd64` en `compose.yaml`).
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
    probe.go               `api probe`: consulta y cruza todas las fuentes (bun run probe)
    sources/               un fichero por fuente oficial: descarga + parseo a tipos propios, con tests
    geo/                   distancia punto-punto y punto-polilínea (para el probe y tests; en producción, PostGIS)
    migrations/            SQL embebido, aplicado al arrancar
    openapi.yaml           contrato con la web: se actualiza ANTES de escribir el endpoint
    compose.yaml           base de datos de desarrollo
```

Cada sección nueva del producto va en su carpeta: `features/casa/`, `features/barrio/`. No hay `packages/`: el proyecto no es multiplataforma, y lo que comparten web y API es el contrato OpenAPI, no código.

## Fuentes de datos

**El inventario completo está en `docs/fuentes-de-datos.md`.** Incluye organismo, acceso, CORS, licencia, dónde se consume y el estado verificado de cada fuente. Actualízalo en el mismo cambio que toque una fuente.

- **Comprobación:** `bun run probe` consulta todas las fuentes en vivo y cruza sus datos con las rutas a los campus. Ejecútalo antes de dar por buena una fuente o tras cambiar un parser.
- **Verificadas:** CartoCiudad (rutas y geocodificador), mapas base IGN (vectorial y PNOA), carburantes (Ministerio), DGT (cámaras e incidencias, DATEX II), Renfe Cercanías (GTFS y GTFS-RT, que casan al 100 %) y REE PVPC (REData, sin token).
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
- **Galería `/dev`:** cada componente nuevo o cambio de estilo se enseña ahí, en claro y en oscuro (`BothSurfaces`). Una sección nueva es una entrada en `src/dev/sections.ts` y su página en `src/dev/pages/`, registrada en `dev-gallery.tsx`.
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
