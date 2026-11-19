-- +goose Up
CREATE TABLE neighborhood_editions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  year integer NOT NULL,
  geography_date date NOT NULL,
  sources jsonb NOT NULL UNIQUE,
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE neighborhood_zones (
  edition_id bigint NOT NULL REFERENCES neighborhood_editions(id),
  id text NOT NULL,
  parent_id text,
  level text NOT NULL CHECK (level IN ('community', 'province', 'municipality', 'district', 'section')),
  name text NOT NULL,
  geom geometry(MultiPolygon, 4326) NOT NULL,
  map_geom geometry(MultiPolygon, 4326) NOT NULL,
  PRIMARY KEY (edition_id, id),
  FOREIGN KEY (edition_id, parent_id) REFERENCES neighborhood_zones(edition_id, id)
);
CREATE INDEX neighborhood_zones_parent_idx ON neighborhood_zones (edition_id, parent_id, name);
CREATE INDEX neighborhood_zones_geom_idx ON neighborhood_zones USING gist (geom);

CREATE TABLE neighborhood_indicators (
  edition_id bigint NOT NULL,
  zone_id text NOT NULL,
  income numeric,
  population bigint,
  mean_age numeric,
  single_person_households numeric,
  PRIMARY KEY (edition_id, zone_id),
  FOREIGN KEY (edition_id, zone_id) REFERENCES neighborhood_zones(edition_id, id)
);

-- +goose Down
DROP TABLE neighborhood_indicators;
DROP TABLE neighborhood_zones;
DROP TABLE neighborhood_editions;
