# /// script
# requires-python = ">=3.9"
# dependencies = ["pyshp==2.3.1"]
# ///
"""Importa la edición del Atlas y el seccionado al PostGIS de Docker Compose."""
import argparse
import csv
import hashlib
import json
import shutil
from pathlib import Path
import subprocess
import tempfile
import zipfile
from decimal import Decimal

import shapefile

YEAR = "2024"
GEOGRAPHY_DATE = "2025-01-01"
TABLES = {
    "atlas-renta-nacional.csv": 53689,
    "atlas-demografia-nacional.csv": 53776,
    "atlas-renta-territorial.csv": 30824,
    "atlas-demografia-territorial.csv": 30832,
}
ARCHIVE = "seccionado-2025.zip"
SOURCE_URLS = {
    filename: f"https://www.ine.es/jaxiT3/files/t/csv_bdsc/{table}.csv"
    for filename, table in TABLES.items()
}
SOURCE_URLS[ARCHIVE] = "https://www.ine.es/prodyser/cartografia/seccionado_2025.zip"

# Las tablas de ámbito nacional exportan nombres sin código.
COMMUNITIES = [
    "Andalucía", "Aragón", "Asturias, Principado de", "Balears, Illes",
    "Canarias", "Cantabria", "Castilla y León", "Castilla - La Mancha",
    "Cataluña", "Comunitat Valenciana", "Extremadura", "Galicia",
    "Madrid, Comunidad de", "Murcia, Región de", "Navarra, Comunidad Foral de",
    "País Vasco", "Rioja, La", "Ceuta", "Melilla",
]
PROVINCES = [
    "Araba/Álava", "Albacete", "Alicante/Alacant", "Almería", "Ávila", "Badajoz",
    "Balears, Illes", "Barcelona", "Burgos", "Cáceres", "Cádiz", "Castellón/Castelló",
    "Ciudad Real", "Córdoba", "Coruña, A", "Cuenca", "Girona", "Granada", "Guadalajara",
    "Gipuzkoa", "Huelva", "Huesca", "Jaén", "León", "Lleida", "Rioja, La", "Lugo",
    "Madrid", "Málaga", "Murcia", "Navarra", "Ourense", "Asturias", "Palencia",
    "Palmas, Las", "Pontevedra", "Salamanca", "Santa Cruz de Tenerife", "Cantabria",
    "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo", "Valencia/València",
    "Valladolid", "Bizkaia", "Zamora", "Zaragoza", "Ceuta", "Melilla",
]
COMMUNITY_CODES = {name: f"{code:02}" for code, name in enumerate(COMMUNITIES, 1)}
PROVINCE_CODES = {name: f"{code:02}" for code, name in enumerate(PROVINCES, 1)}
METRICS = {
    "Renta neta media por persona": "income",
    "Población": "population",
    "Edad media de la población": "mean_age",
    "Porcentaje de hogares unipersonales": "single_person_households",
}
PSQL = ["docker", "compose", "exec", "-T", "postgres"] + ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "civicpulse_dev", "-d", "civicpulse_dev"]


def download(cache):
    cache.mkdir(parents=True, exist_ok=True)
    sources = {}
    for filename, url in SOURCE_URLS.items():
        path = cache / filename
        if not path.exists():
            with tempfile.TemporaryDirectory(dir=cache) as directory:
                temporary = Path(directory) / filename
                subprocess.run(["curl", "-fLsS", "--retry", "2", "--max-time", "300",
                                "-o", str(temporary), url], check=True)
                temporary.replace(path)
        digest = hashlib.sha256()
        with path.open("rb") as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b""):
                digest.update(chunk)
        sources[filename] = {"url": url, "sha256": digest.hexdigest()}
    return sources


def statistics(cache, target):
    values = {}
    for filename in TABLES:
        national = filename.endswith("-nacional.csv")
        with (cache / filename).open(encoding="utf-8-sig", newline="") as file:
            reader = csv.reader(file, delimiter=";")
            header = next(reader)
            expected = (["Total Nacional", "Comunidades y Ciudades Autónomas", "Provincias", "Islas"]
                        if national else ["Municipios", "Distritos", "Secciones"])
            if header[:-3] != expected or header[-2:] != ["Periodo", "Total"]:
                raise ValueError(f"Columnas inesperadas en {filename}: {header}")
            for row in reader:
                if len(row) != len(header):
                    raise ValueError(f"Fila inválida en {filename}, línea {reader.line_num}")
                geography, label, year, raw = row[:-3], *row[-3:]
                metric = METRICS.get(label)
                if year != YEAR or metric is None or raw in ("", ".", ".."):
                    continue
                if national:
                    _, community, province, island = geography
                    if island or not (province or community):
                        continue
                    zone = f"province-{PROVINCE_CODES[province]}" if province else f"community-{COMMUNITY_CODES[community]}"
                else:
                    index = max(i for i, name in enumerate(geography) if name)
                    code = geography[index].split()[0]
                    level, width = [("municipality", 5), ("district", 7), ("section", 10)][index]
                    if len(code) != width or not code.isascii() or not code.isdecimal():
                        raise ValueError(f"Código inválido en {filename}: {code}")
                    zone = f"{level}-{code}"
                number = Decimal(raw.replace(".", "").replace(",", "."))
                if not number.is_finite() or number < 0 or (metric == "population" and number % 1):
                    raise ValueError(f"Valor inválido en {filename}: {raw}")
                indicators = values.setdefault(zone, {})
                if indicators.setdefault(metric, number) != number:
                    raise ValueError(f"Datos contradictorios en {filename}: {zone} {metric}")

    with target.open("w", encoding="utf-8", newline="") as file:
        output = csv.writer(file, lineterminator="\n")
        for zone, indicators in values.items():
            output.writerow([zone, *(indicators.get(metric) for metric in METRICS.values())])


def geometry(cache, target):
    with zipfile.ZipFile(cache / ARCHIVE) as archive:
        paths = {Path(name).suffix.lower(): name for name in archive.namelist()
                 if Path(name).stem == "SECC_CE_20250101"}
        encoding = f"cp{archive.read(paths['.cpg']).decode().strip()}"
        with archive.open(paths[".shp"]) as shp, archive.open(paths[".dbf"]) as dbf, \
                shapefile.Reader(shp=shp, dbf=dbf, encoding=encoding) as reader, \
                target.open("w", encoding="utf-8", newline="") as file:
            fields = ["CUSEC", "CUDIS", "CUMUN", "CPRO", "CCA", "NMUN", "NPRO", "NCA"]
            output = csv.writer(file, lineterminator="\n")
            for item in reader.iterShapeRecords(fields=fields):
                properties = item.record.as_dict()
                output.writerow([*(properties[key] for key in fields),
                                 json.dumps(item.shape.__geo_interface__, separators=(",", ":"))])


def import_edition(cache, sources, work):
    params = ["-v", f"year={YEAR}", "-v", f"geography_date={GEOGRAPHY_DATE}",
              "-v", f"sources={json.dumps(sources)}"]
    existing = subprocess.check_output(PSQL + params + ["-At"], input=(
        "SELECT EXISTS (SELECT 1 FROM neighborhood_editions WHERE sources = :'sources'::jsonb);\n"
    ), text=True).strip()
    if existing == "t":
        print("Edición ya importada.")
        return

    shapes = work / "sections.csv"
    indicators = work / "indicators.csv"
    statistics(cache, indicators)
    geometry(cache, shapes)

    with subprocess.Popen(PSQL + params, stdin=subprocess.PIPE) as process:
        sink = process.stdin
        sink.write(b"BEGIN;\nSELECT pg_advisory_xact_lock(1141043);\n")
        sink.write(b"SELECT EXISTS (SELECT 1 FROM neighborhood_editions WHERE sources = :'sources'::jsonb) AS imported \\gset\n")
        sink.write(b"CREATE TEMP TABLE ine_sections (cusec text, cudis text, cumun text, cpro text, cca text, nmun text, npro text, nca text, shape text);\n")
        sink.write(b"CREATE TEMP TABLE atlas_stats (id text PRIMARY KEY, income numeric, population bigint, mean_age numeric, single_person_households numeric);\n")
        for table, path in [("ine_sections", shapes), ("atlas_stats", indicators)]:
            sink.write(f"COPY {table} FROM STDIN WITH (FORMAT csv);\n".encode())
            with path.open("rb") as source:
                shutil.copyfileobj(source, sink)
            sink.write(b"\\.\n")
        sink.write(b"\\if :imported\n\\echo Edicion ya importada.\n\\else\n")
        sink.write(Path(__file__).with_name("load.sql").read_bytes())
        sink.write(b"\n\\endif\nCOMMIT;\n")
        sink.close()
        if process.wait():
            raise RuntimeError("Postgres rechazó la edición")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True)
    args = parser.parse_args()
    sources = download(args.cache)
    with tempfile.TemporaryDirectory(prefix="civicpulse-ine-") as directory:
        import_edition(args.cache, sources, Path(directory))


if __name__ == "__main__":
    main()
