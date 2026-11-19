-- +goose Up
-- Capas que se ingieren periódicamente desde fuentes oficiales y se cruzan con las rutas (ST_DWithin).
-- geography(…, 4326): distancias en metros sin reproyectar.

CREATE TABLE fuel_stations (
  id            text PRIMARY KEY,                  -- IDEESS del Ministerio
  brand         text NOT NULL,
  address       text NOT NULL,
  town          text NOT NULL,
  schedule      text NOT NULL,
  price_g95     numeric(5, 3),                     -- €/l; NULL = no lo vende
  price_diesel  numeric(5, 3),
  geom          geography(Point, 4326) NOT NULL,
  source_date   text NOT NULL                      -- "Fecha" que publica el Ministerio
);
CREATE INDEX fuel_stations_geom_idx ON fuel_stations USING gist (geom);

CREATE TABLE cameras (
  id         text PRIMARY KEY,                     -- "madrid-06303", "dgt-176130"
  source     text NOT NULL CHECK (source IN ('madrid', 'dgt')),
  name       text NOT NULL,
  image_url  text,
  geom       geography(Point, 4326) NOT NULL
);
CREATE INDEX cameras_geom_idx ON cameras USING gist (geom);

CREATE TABLE incidents (
  id        text PRIMARY KEY,                      -- id del situationRecord DATEX II
  kind      text NOT NULL,
  cause     text NOT NULL,
  road      text NOT NULL,
  province  text NOT NULL,
  geom      geography(Geometry, 4326) NOT NULL     -- tramo (LineString) o punto
);
CREATE INDEX incidents_geom_idx ON incidents USING gist (geom);

-- Última ingesta de cada capa: para responder «actualizado hace…» y depurar fuentes caídas.
CREATE TABLE ingest_runs (
  layer        text PRIMARY KEY,
  ok_at        timestamptz,
  rows         integer,
  attempted_at timestamptz NOT NULL,
  error        text
);

-- +goose Down
DROP TABLE ingest_runs;
DROP TABLE incidents;
DROP TABLE cameras;
DROP TABLE fuel_stations;
