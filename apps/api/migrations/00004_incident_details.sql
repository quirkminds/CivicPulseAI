-- +goose Up
-- Detalle de las incidencias DGT que usa la navegación: cortes (para esquivarlos) y tráfico lento (retraso).
ALTER TABLE incidents
  ADD COLUMN management_type text NOT NULL DEFAULT '', -- roadClosed, carriagewayClosures, laneClosures…
  ADD COLUMN abnormal_type   text NOT NULL DEFAULT '', -- slowTraffic, stationaryTraffic…
  ADD COLUMN speed_limit     real,                     -- límite temporal tal cual lo publica la DGT
  ADD COLUMN direction       text NOT NULL DEFAULT ''; -- northBound, unknown…

-- +goose Down
ALTER TABLE incidents
  DROP COLUMN direction,
  DROP COLUMN speed_limit,
  DROP COLUMN abnormal_type,
  DROP COLUMN management_type;
