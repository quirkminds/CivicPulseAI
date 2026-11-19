-- +goose Up
-- PostGIS: geometrías, índices GiST y ST_DWithin para cruzar rutas con cámaras, gasolineras y radares.
CREATE EXTENSION IF NOT EXISTS postgis;

-- +goose Down
DROP EXTENSION IF EXISTS postgis;
