# Fuentes de datos

Registro de todo lo que consume CivicPulse. Cada fuente se clasifica con los mismos ejes para decidir **dónde** se consume (navegador, API, ingesta en PostGIS o Worker en el edge). Una fuente solo pasa a «Verificada» cuando alguien la ha descargado y ha comprobado su formato real.

## Inventario (comprobado el 2026-11-19)

`bun run probe` consulta cada fuente y cruza sus datos sobre rutas reales a los campus (ver «Comprobación automática» al final).

| Fuente | Organismo | Acceso | Cambia | CORS | Dónde se consume | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| CartoCiudad: rutas | Estatal (IGN/CNIG) | API bajo demanda | Por petición | No | API Go (`/v1/route`) | ✅ Verificada |
| CartoCiudad: geocodificador | Estatal (IGN/CNIG) | API bajo demanda | Por petición | Sí | Navegador | ✅ Verificada |
| Mapas base IGN (vectorial, PNOA) | Estatal (IGN/CNIG) | Teselas | Estática | Sí | mapcn (`styles`) | ✅ Verificada (con parche, ver abajo) |
| Precios de carburantes | Estatal (Ministerio) | API bajo demanda | Diaria (varias veces al día) | Sí | Ingesta en PostGIS o Worker | ✅ Verificada |
| DGT: cámaras | Estatal (DGT) | Fichero DATEX II | Diaria | No | Worker o ingesta en PostGIS | ✅ Verificada |
| DGT: incidencias | Estatal (DGT) | Feed DATEX II | Minutos | No | Ingesta periódica en PostGIS | ✅ Verificada |
| Renfe: GTFS Cercanías | Estatal (Renfe) | Fichero ZIP | Diaria | No | Ingesta en PostGIS | ✅ Verificada |
| Renfe: GTFS-RT (retrasos y avisos) | Estatal (Renfe) | Feed en vivo | Segundos | No | API Go (proxy con caché corta) | ✅ Verificada |
| REE: PVPC por horas (REData) | Estatal (REE) | API bajo demanda | Diaria | Sí | API Go o navegador | ✅ Verificada |
| Ayto. Madrid: cámaras (`CCTV.kml`) | Municipal | Fichero KML | Estática | No | Ingesta en PostGIS | ⚠️ Bloqueada desde nuestra IP |
| Ayto. Madrid: tráfico en vivo (`pm.xml`) | Municipal | Feed XML | 5 min | No | Ingesta periódica en PostGIS | ⚠️ Bloqueada, formato sin ver |
| Ayto. Madrid: radares fijos y móviles | Municipal | CSV/XLSX | Estática | — | Ingesta en PostGIS | ⚠️ URL localizada, bloqueada |
| CRTM: GTFS Metro | Autonómico (CRTM) | Fichero ZIP | Mensual | Sí | Ingesta en PostGIS | ❌ El feed público caducó el 27/05/2026 |
| INE: renta por sección censal (ADRH) | Estatal (INE) | API JSON | Anual | — | Ingesta en PostGIS | 🔎 API localizada, falta la tabla de Madrid |
| MITECO: factores de emisión de CO₂ | Estatal (MITECO) | PDF/XLS | Anual | — | Constantes en código, con cita | 🔎 Por confirmar los valores |

## Cómo se clasifica una fuente

| Eje | Valores | Para qué sirve |
| --- | --- | --- |
| Organismo | Estatal · Autonómico · Municipal | Atribución y narrativa de «datos oficiales» |
| Acceso | API bajo demanda · Fichero descargable · Feed en vivo · Teselas de mapa | Cómo se pide |
| Frecuencia de cambio | Estática · Diaria · Minutos · Por petición | Cada cuánto hay que volver a pedirla |
| CORS | Sí (`*`) · No | Si el navegador puede llamarla directamente |
| Licencia | CC BY 4.0, etc. | Texto de atribución obligatorio |
| Estado | Verificada · Sin probar · Por confirmar | Qué sabemos de verdad |

**Dónde se consume**, según lo anterior:

| Caso | Dónde |
| --- | --- |
| Bajo demanda, con CORS y sin secretos | **Navegador** directamente |
| Bajo demanda, sin CORS, o con respuesta que hay que transformar | **API Go** como proxy (`/v1/...`) |
| Datos que se cruzan espacialmente (cerca de una ruta, dentro de un barrio) | **Ingesta periódica en PostGIS** (API Go) |
| Capa que cambia poco y se sirve tal cual | **Worker** en el edge (`wrangler dev` en local) |
| Teselas de mapa base | **mapcn/MapLibre** directamente (prop `styles`) |

---

## CartoCiudad (IGN / CNIG): verificada

Es el servicio cartográfico estatal: callejero, portales, puntos kilométricos y red viaria de toda España. Lo mantienen el Instituto Geográfico Nacional y el Centro Nacional de Información Geográfica.

- **Portal:** https://www.cartociudad.es/web/portal/inicio
- **Guía técnica oficial** («Servicios web de CartoCiudad», CNIG, 04-08-2026, 55 páginas): https://www.idee.es/resources/documentos/Cartociudad/CartoCiudad_ServiciosWeb.pdf
- **Código y documentación del geocodificador:** https://github.com/IDEESpain/Cartociudad
- **Licencia:** **CC BY 4.0** (SCNE). Su uso es libre y gratuito, también comercial, siempre que se cite el origen.
  - Atribución: `CartoCiudad © IGN-CNIG, CC BY 4.0 (www.scne.es)`.
  - Fuentes: el FAQ (https://www.cartociudad.es/web/portal/faq) y la guía técnica (§ licencia: http://www.ign.es/resources/licencia/Condiciones_licenciaUso_IGN.pdf).
  - No hay API key ni cuotas publicadas.

### Endpoints

Todos los probamos el 2026-11-19 con `Origin: http://localhost:5173`.

| Endpoint | Para qué | CORS | Dónde lo consumimos |
| --- | --- | --- | --- |
| `GET /geocoder/api/geocoder/candidates?q=&limit=` | Autocompletar direcciones (origen del usuario) | **Sí** (`*`) | **Navegador** (o la API, si queremos caché) |
| `GET /geocoder/api/geocoder/find?q=` · `?id=&type=` | Resolver un candidato a coordenadas; `outputformat=geojson` opcional | **Sí** | Navegador |
| `GET /geocoder/api/geocoder/reverseGeocode?lon=&lat=` | Coordenadas → dirección (botón «mi ubicación»); portal más cercano en 350 m | **Sí** | Navegador |
| `GET /services/api/route?orig=lat,lng&dest=lat,lng&locale=es&vehicle=CAR\|WALK` | Ruta en coche o a pie | **No** | **API Go** (`/v1/route`) |
| `GET /services/api/serviceArea?lon=&lat=&dist=` | Polígono alcanzable en `dist` metros por la red viaria | **No** | API Go, si lo usamos |
| `POST /geocoder/api/geocoder/unifiedcsvgeocoding` | Geocodificación masiva por CSV (hasta 60 000 filas) | — | Ingesta, si una fuente trae direcciones sin coordenadas |

**Geocodificador.** Devuelve `lat`, `lng` (WGS84), `address`, `postalCode`, `muni`, `type` (`portal`, `callejero`, `municipio`, `toponimo`…) y `refCatastral`. Acepta filtros (`municipio_filter`, `provincia_filter`, `cod_postal_filter`…) y `no_process` para excluir tipos. Para el origen del usuario conviene filtrar por la Comunidad de Madrid: sin filtro, «calle alcalá 100» también devuelve Alcalá de Guadaíra (Sevilla).

**Rutas.** Lo que dice la guía técnica (§ 2.2.2) y lo que hemos comprobado:

- **Formato:** `geom` es una *encoded polyline* de Google (precisión 5, orden lat,lng). `distance` va en metros, `time` en milisegundos y `instructionsData` trae las maniobras («Gire a la izquierda por…»). Todos los números llegan **como strings**.
- **Solo hay dos vehículos**, `CAR` y `WALK`.
  - ⚠️ Cualquier otro valor (por ejemplo `BUS`) **responde 200 con la ruta a pie**, sin error. La API Go debe validar `vehicle`.
- **`CAR` usa velocidades fijas:** vía urbana 30 km/h, autopista y autovía 100 km/h, carretera convencional 60 km/h y resto 20 km/h.
- **No tiene en cuenta el sentido de las calles** y es una distancia «Manhattan» sobre la red viaria. La propia guía dice que `time` «no es fiable para coches».
  - **Esto justifica nuestro valor añadido:** ajustar el tiempo con el tráfico en vivo del Ayuntamiento (`pm.xml`).
- **Ejemplos reales** desde Sol:
  - A Campus Sur: 8,2 km en coche, 11,7 min sin tráfico; 8,1 km a pie.
  - A Montegancedo: 20,9 km en coche.
  - Respuestas en 0,1–0,4 s.

### Mapas base del IGN (teselas): verificados

Todos responden con `Access-Control-Allow-Origin: *`, así que MapLibre (y por tanto mapcn) puede cargarlos directamente.

| Servicio | URL | Tipo |
| --- | --- | --- |
| **Mapa base vectorial IGN** | `https://vt-mapabase.idee.es/files/styles/mapaBase_scn_color1_CNIG.json` | Style JSON de MapLibre v8, que incluye teselas `.pbf`, sprites, fuentes y relieve |
| IGN Base ráster (TMS) | `https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg` | Ráster |
| IGN Base (WMTS) | `https://www.ign.es/wmts/ign-base` (capa `IGNBaseTodo`, `GoogleMapsCompatible`) | Ráster |
| Ortofoto PNOA (WMTS) | `https://www.ign.es/wmts/pnoa-ma` (capa `OI.OrthoimageCoverage`) | Ráster (foto aérea) |

- **Solo hay una variante vectorial pública**, la clara (`color1`). Las variantes `gris`, `color2` y `noche` responden 403, así que el IGN **no tiene estilo oscuro**.
- **El estilo pesa 385 KB y tiene 589 capas.** Pasa el validador oficial (`gl-style-validate` de `@maplibre/maplibre-gl-style-spec`), y sus 4 fuentes tipográficas y sus sprites responden con CORS.
- ⚠️ **Hay que parchearlo.**
  - Declara `maxZoom`/`minZoom` en camelCase, que MapLibre ignora, y el IGN **solo sirve teselas hasta z17** (z18 → 403). Sin parche, el mapa se queda en blanco al acercar.
  - **No declara atribución**, y CC BY 4.0 la exige.
  - `patchIgnStyle()` en `apps/web/src/lib/basemaps.ts` corrige ambas cosas (con test).
- **La ortofoto PNOA** sirve teselas hasta z20.

### Otros servicios de CartoCiudad que no necesitamos

WMS de direcciones (`https://www.cartociudad.es/wms-inspire/direcciones-ccpp`), WFS (`/wfs-inspire/direcciones`), OGC API Features de direcciones (`https://api-features.idee.es/collections/address`), WPS (`/wps/WebProcessingService`) y la descarga por provincia en GeoPackage del Centro de Descargas del CNIG.

---

## Precios de carburantes (Ministerio): verificada

- **Ayuda de la API:** https://energia.serviciosmin.gob.es/ServiciosRestCarburantes/PreciosCarburantes/help
- **Endpoint que usamos:** `GET …/PreciosCarburantes/EstacionesTerrestres/FiltroProvincia/28` (Madrid). Hay filtros por comunidad, municipio y producto, además del histórico (`EstacionesTerrestresHist/{FECHA}/…`).
- **Formato:** JSON (`ListaEESSPrecio`). **Los números llevan coma decimal** (`"1,499"`, `"40,528778"`) y un precio vacío significa «no vende ese producto». Cada estación trae `IDEESS`, `Rótulo`, dirección, horario, coordenadas WGS84 y unos 25 productos.
- **Datos de Madrid (19/11/2026):** 895 gasolineras, todas con coordenadas; 858 con gasolina 95 E5 y 863 con gasóleo A. Respuesta de ~1 MB en 0,3 s. CORS `*`.
- **Uso:** gasolinera más barata a ≤1 km de la ruta y coste por viaje. Va al Worker o a PostGIS porque cambia pocas veces al día.

## DGT: cámaras e incidencias (DATEX II v3.7): verificadas

- **Cámaras:** `https://nap.dgt.es/datex2/v3/dgt/DevicePublication/camaras_datex2_v37.xml` (3,7 MB).
  - 1 980 cámaras en España, 411 a menos de 60 km de Sol.
  - La foto está en `fse:deviceUrl` → `https://etraffic.dgt.es/camarasEtraffic/<id>.jpg`, que responde con un JPEG.
  - **No traen provincia**: se filtran por distancia.
- **Incidencias:** `https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml` (7 MB).
  - Unas 1 550 activas en España y ~150 en la provincia de Madrid.
  - Tipos: obras, tráfico anómalo, obstrucciones, gestión de velocidad…
  - Cada una trae tramo `from`/`to` (o un punto), carretera, PK, municipio y provincia.
- **Catálogo:** https://nap.dgt.es/en/dataset/incidencias-dgt-datex2-v3-7. Cubre España salvo el País Vasco y Cataluña.
- **Sin CORS.** El XML usa varios espacios de nombres; `encoding/xml` empareja por nombre local (ver `apps/api/sources`).

## Renfe Cercanías: GTFS estático y tiempo real: verificadas

- **GTFS estático:** `https://ssl.renfe.com/ftransit/Fichero_CER_FOMENTO/fomento_transit.zip`.
  - Pesa 16 MB y `stop_times.txt` ocupa 270 MB descomprimido.
  - Incluye 131 000 viajes y 1 167 paradas, con calendario vigente hasta el 18/12/2026.
  - **Todos los campos vienen rellenos con espacios**: hay que recortarlos.
- **Tiempo real (GTFS-RT en JSON):**
  - Retrasos: `https://gtfsrt.renfe.com/trip_updates.json`
  - Avisos: `https://gtfsrt.renfe.com/alerts.json`
  - También existen las variantes `.pb`.
- **Cruce verificado:** el **100 %** de los `tripId` en vivo existen en el GTFS estático. El feed cubre toda España, así que el núcleo de Madrid se filtra por `route_id` que empieza por **`10T`** (`10T0007C3` = C3).
  - Ejemplo: 123 trenes de Madrid en vivo, 68 con retraso ≥1 min y 5 avisos activos.

## REE: precio de la luz (PVPC): verificada

- **REData, sin token y con CORS `*`:** `https://apidatos.ree.es/es/datos/mercados/precios-mercados-tiempo-real?start_date=…T00:00&end_date=…T23:59&time_trunc=hour`.
  - El bloque `included[type=PVPC]` trae 24 valores en €/MWh con hora local (`+01:00`).
- **ESIOS** (`https://api.esios.ree.es`, indicador 1001 = PVPC 2.0TD) pide el token que ya tiene el equipo. De momento no hace falta: REData cubre «Mi casa». Si se usa, el token irá solo en `apps/api/.env.local`.

## Ayuntamiento de Madrid (informo.madrid.es, datos.madrid.es): bloqueadas

- **El problema:**
  - El 19/11/2026 a mediodía `CCTV.kml` respondía bien (357 cámaras; hay un fixture en `apps/web/src/mocks`).
  - Desde las 14:30 **todo `*.madrid.es` corta la conexión TLS** (Akamai, «connection reset by peer»), con cualquier User-Agent y también por HTTP/1.1. Parece un bloqueo por IP tras varias peticiones seguidas.
  - **Hay que comprobarlo desde un navegador o desde otra red** (la del VPS).
- **Consecuencia de diseño:** estas fuentes **nunca se piden en cada consulta**. Se cargan en PostGIS con poca frecuencia, se reintentan con *backoff* y la web sirve lo último que se guardó. Los fixtures quedan como respaldo para la demo.
- **Recursos:**
  - Cámaras: `https://informo.madrid.es/informo/tmadrid/CCTV.kml`
  - Tráfico en vivo: `https://informo.madrid.es/informo/tmadrid/pm.xml`. Formato sin ver todavía. Su estructura está documentada en https://datos.madrid.es/FWProjects/egob/Catalogo/Transporte/Trafico/ficheros/PuntosMedidaTraficoMdrid.pdf
  - Radares fijos y móviles: `https://datos.madrid.es/dataset/300049-0-radares-fijos-moviles/resource/300049-1-radares-fijos-moviles-csv/download/300049-1-radares-fijos-moviles-csv.csv` (actualizado el 22/10/2026, según datos.gob.es).

## CRTM: Metro de Madrid: caducada

- **El feed público** (`http://crtm.maps.arcgis.com/sharing/rest/content/items/5c7f2951962540d69ffe8f640d94c246/data`) descarga bien, pero **su calendario terminó el 27/05/2026**. Además, el Metro va por `frequencies.txt` (frecuencias, no horas exactas).
- **El feed vigente** está en el Punto de Acceso Nacional de Transportes: `https://nap.transportes.gob.es/api/Fichero/download/1134`. **Pide una API key** (el registro es gratuito). Acción: que alguien del equipo se registre.
- **Licencia CRTM:** hay que citar al CRTM como fuente y compartir los derivados con la misma licencia (https://www.crtm.es/licencia-de-uso/).

## INE: renta por zona (ADRH): API localizada

- **API JSON de INEbase:** `https://servicios.ine.es/wstempus/js/ES/TABLAS_OPERACION/353` lista las 540 tablas del Atlas de Distribución de Renta de los Hogares. Hay una tabla «Indicadores de renta media y mediana» por provincia (54).
- **Pendiente:** identificar el Id de la tabla de Madrid (los nombres de tabla no incluyen la provincia) y conseguir los contornos de secciones censales del INE para pintar la coropleta.

## MITECO: factores de emisión: por confirmar

- Se publican en el Registro de Huella de Carbono (https://www.miteco.gob.es/es/cambio-climatico/temas/registro-huella.html), con factores 2007–2025.
- Son pocos valores (kg CO₂ por litro de gasolina y de gasóleo y por kWh), así que irán como **constantes en el código citando el documento y el año**. Falta descargar el documento y copiar los valores exactos.

---

## mapcn: qué es y qué trae

mapcn (https://www.mapcn.dev/docs) **no es una dependencia de npm**. Es un registro de shadcn: `shadcn add @mapcn/map` copia `apps/web/src/components/ui/map.tsx` (unas 2 800 líneas) en nuestro repo, así que el código es nuestro y lo podemos tocar.

**Por debajo:**

- **MapLibre GL JS 6.19**, de código abierto y renderizado con WebGL.
  - Se carga de forma diferida con `import("maplibre-gl")`.
  - ⚠️ **El worker de MapLibre se descarga de unpkg.com** al cargar el mapa.
- **Mapa base por defecto:** estilos de **CARTO** (`positron` claro y `dark-matter` oscuro), que dibujan datos de OpenStreetMap.
  - **CARTO es una empresa privada y no tiene nada que ver con CartoCiudad.**
  - Sus condiciones de uso están **por verificar**.
- **Tema:** detecta claro u oscuro por la clase `.dark` del documento o por `prefers-color-scheme`.
- **Componentes:** React + Tailwind + tokens de shadcn, con el mismo aspecto que el resto de la UI.

**Componentes nativos que nos sirven para una interfaz centrada en el mapa:**

| Componente | Uso en CivicPulse |
| --- | --- |
| `Map` (`styles`, `theme`, `viewport` controlado, `ref` → instancia de MapLibre) | Lienzo principal |
| `MapControls` (zoom, brújula, localizar, pantalla completa) | `onLocate` + `reverseGeocode` de CartoCiudad = «usar mi ubicación» como origen |
| `MapRoute` + `RouteProgress` + `RouteMarker` | Ruta en coche o a pie; comparar alternativas con `active` |
| `MapMarker` + `MarkerContent` / `MarkerLabel` / `MarkerPopup` / `MarkerTooltip` | Origen, campus, cámaras con foto, gasolineras con precio |
| `MapClusterLayer` | Cientos de puntos (todas las gasolineras, todas las cámaras) |
| `MapGeoJSON` (relleno, borde, hover) | Franja de la ruta, barrios y coropletas de renta |
| `MapPopup` | Popups sin marcador (clic en un tramo con tráfico) |
| `MapArc` | No lo necesitamos |
| `useMap()` | Capas propias de MapLibre (p. ej. tramos de tráfico coloreados por velocidad) |

**Bloques** (plantillas completas que se copian al repo):

| Bloque | Uso en CivicPulse |
| --- | --- |
| `@mapcn/store-locator` | Lista de gasolineras sincronizada con el mapa |
| `@mapcn/choropleth` | «Mi barrio» |
| `@mapcn/delivery-tracker` | Seguimiento de un trayecto |
| `@mapcn/heatmap` | Densidad de incidencias |

mapcn **no trae análisis geoespacial**: el cálculo lo hacen Turf (en el cliente) y PostGIS.

### ¿Choca CartoCiudad con mapcn?

**No.** Trabajan en capas distintas y encajan sin adaptadores:

- **CartoCiudad da datos:** coordenadas, rutas y polígonos.
  - La ruta llega como *polyline*; la API la decodifica a GeoJSON `[lng, lat]`, que es justo lo que espera `MapRoute`.
  - `serviceArea` y el geocodificador devuelven GeoJSON o lat/lng, que `MapGeoJSON` y `MapMarker` consumen directamente.
- **mapcn pinta.** Su prop `styles` acepta cualquier style JSON de MapLibre, así que podemos poner el **mapa base oficial del IGN** en lugar de CARTO:
  ```tsx
  <Map styles={{ light: IGN_MAPA_BASE, dark: CARTO_DARK_MATTER }} />
  ```

### Riesgos y recomendaciones

1. **Mapa base.** El mapa tiene un selector Callejero (CARTO) · IGN · Satélite (PNOA) para compararlos a simple vista. Recomendado: el IGN en modo claro, que es oficial, CC BY 4.0 y encaja con el discurso de datos públicos, con CARTO dark-matter en oscuro, porque el IGN no tiene estilo oscuro. Cambiar de mapa base no rompe nada de mapcn: `setStyle` recarga el estilo y la ruta y los marcadores se vuelven a montar solos.
2. **El worker desde unpkg.** Si la wifi de la hackatón falla, el mapa no carga. Conviene servirlo nosotros mismos: copiar `maplibre-gl-worker.mjs` a `public/` y cambiar `setWorkerUrl` en `map.tsx`, como indica la propia documentación de mapcn.
3. **Atribución.** Hay que mostrar «CartoCiudad © IGN-CNIG, CC BY 4.0» y, si se usa CARTO, «© OpenStreetMap contributors © CARTO». El `attributionControl` de MapLibre ya lo muestra si el estilo lo declara; si no, se añade a mano.

---

## Comprobación automática: `bun run probe`

`apps/api/probe.go` usa los mismos parsers que la ingesta (`apps/api/sources`) y cruza los datos con las rutas Sol → Campus Sur y Sol → Montegancedo. Resultado del 2026-11-19:

```
FUENTES (20.0s)
  OK     CartoCiudad ruta → Campus Sur (ETSISI) 8.2 km · 12 min sin tráfico · 192 vértices
  OK     CartoCiudad ruta → Montegancedo (ETSIINF) 20.9 km · 19 min sin tráfico · 493 vértices
  FALLO  Ayto. Madrid cámaras (CCTV.kml)    source unavailable: … context deadline exceeded
  OK     DGT cámaras (DATEX II)             1980 en España · 411 a <60 km de Sol
  OK     DGT incidencias (DATEX II)         1535 en España · 152 en la provincia de Madrid
  OK     Ministerio carburantes (prov. 28)  895 gasolineras · 858 con G95 · 863 con gasóleo A
  OK     Renfe GTFS estático                131208 viajes · 1167 paradas · calendario hasta 20261218
  OK     Renfe GTFS-RT retrasos             464 trenes · 100% casan con el GTFS · 123 en Madrid (68 con retraso ≥1 min)
  OK     Renfe GTFS-RT avisos               81 avisos · 5 afectan a Cercanías Madrid
  OK     REE PVPC (REData, sin token)       24 horas · más barata 01:00 (91 €/MWh) · más cara 20:00 (328 €/MWh)

CRUCES SOBRE LA RUTA EN COCHE (origen: Puerta del Sol)
  Campus Sur (ETSISI) (8.2 km)
    cámaras DGT a ≤300 m: 2 · incidencias DGT a ≤500 m: 2 · gasolineras (G95) a ≤1 km: 17 (más barata 1,359 €/l)
  Montegancedo (ETSIINF) (20.9 km)
    cámaras DGT a ≤300 m: 9 · incidencias DGT a ≤500 m: 6 · gasolineras (G95) a ≤1 km: 25 (más barata 1,499 €/l)
```

**Conclusión:** para «Mi trayecto» en coche hay datos de sobra que cruzar sin depender del Ayuntamiento: ruta, gasolineras, cámaras DGT e incidencias. Para Cercanías, el tiempo real casa al 100 % con los horarios. Lo que falta: Metro (API key del NAP), tráfico en vivo y cámaras municipales (bloqueo), y renta del INE (identificar la tabla).
