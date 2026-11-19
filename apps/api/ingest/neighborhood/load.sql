INSERT INTO neighborhood_editions (year, geography_date, sources)
VALUES (:'year', :'geography_date', :'sources'::jsonb)
RETURNING id AS edition_id \gset

-- Los límites siguen la misma edición territorial en todos los niveles.
CREATE TEMP TABLE sections AS
SELECT cusec, cudis, cumun, cpro, cca, nmun, npro, nca,
       ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(shape), 25830), 4326)), 3)) AS geom
FROM ine_sections
WHERE shape IS NOT NULL;

CREATE TEMP TABLE districts AS
SELECT cudis, cumun, ST_Union(geom) AS geom
FROM sections GROUP BY cudis, cumun;

CREATE TEMP TABLE municipalities AS
SELECT d.cumun, min(s.cpro) AS cpro, min(s.nmun) AS name, d.geom
FROM (
  SELECT cumun, ST_Union(geom) AS geom FROM districts GROUP BY cumun
) d
JOIN (SELECT DISTINCT cumun, cpro, nmun FROM sections) s USING (cumun)
GROUP BY d.cumun, d.geom;

CREATE TEMP TABLE provinces AS
SELECT m.cpro, s.cca, s.npro AS name, ST_Union(m.geom) AS geom
FROM municipalities m
JOIN (SELECT DISTINCT cpro, cca, npro FROM sections) s USING (cpro)
GROUP BY m.cpro, s.cca, s.npro;

CREATE TEMP TABLE communities AS
SELECT p.cca, s.nca AS name, ST_Union(p.geom) AS geom
FROM provinces p
JOIN (SELECT DISTINCT cca, nca FROM sections) s USING (cca)
GROUP BY p.cca, s.nca;

-- Simplifica por nivel. Douglas–Peucker evita el coste de recalcular la topología
-- de una comunidad completa; se reparan los polígonos simplificados antes de publicarlos.
CREATE TEMP TABLE zone_geometry AS
SELECT 'community-' || cca AS id, NULL::text AS parent_id, 'community' AS level,
       name, geom, 0.008 AS tolerance FROM communities
UNION ALL
SELECT 'province-' || cpro, 'community-' || cca, 'province',
       name, geom, 0.004 FROM provinces
UNION ALL
SELECT 'municipality-' || cumun, 'province-' || cpro, 'municipality',
       name, geom, 0.001 FROM municipalities
UNION ALL
SELECT 'district-' || cudis, 'municipality-' || cumun, 'district',
       'Distrito ' || right(cudis, 2), geom, 0.00025 FROM districts
UNION ALL
SELECT 'section-' || cusec, 'district-' || cudis, 'section',
       'Sección ' || right(cusec, 3), geom, 0.00008 FROM sections;

INSERT INTO neighborhood_zones (edition_id, id, parent_id, level, name, geom, map_geom)
SELECT :'edition_id', id, parent_id, level, name, ST_Multi(geom),
       COALESCE(NULLIF(ST_Multi(ST_CollectionExtract(ST_MakeValid(simplified), 3)),
                       ST_GeomFromText('MULTIPOLYGON EMPTY', 4326)),
                ST_Multi(geom))
FROM (
  SELECT *, ST_Simplify(geom, tolerance, true) AS simplified
  FROM zone_geometry
) zones;

INSERT INTO neighborhood_indicators (edition_id, zone_id, income, population, mean_age, single_person_households)
SELECT z.edition_id, z.id, a.income, a.population, a.mean_age, a.single_person_households
FROM neighborhood_zones z
JOIN atlas_stats a ON a.id = z.id
WHERE z.edition_id = :'edition_id';

-- Comprueba el alcance antes de hacer visible la edición.
CREATE TEMP TABLE coverage AS
SELECT z.level, count(*) AS zones, count(i.income) AS income, count(i.population) AS population
FROM neighborhood_zones z
LEFT JOIN neighborhood_indicators i ON i.edition_id = z.edition_id AND i.zone_id = z.id
WHERE z.edition_id = :'edition_id'
GROUP BY z.level;

TABLE coverage;
DO $$
BEGIN
  IF (SELECT count(*) FROM coverage) <> 5
     OR EXISTS (SELECT FROM coverage WHERE income < zones * 0.9 OR population < zones * 0.9)
     OR (SELECT zones FROM coverage WHERE level = 'community') <> 19
     OR (SELECT zones FROM coverage WHERE level = 'province') <> 52 THEN
    RAISE EXCEPTION 'Cobertura incompleta del Atlas o del seccionado';
  END IF;
END $$;
