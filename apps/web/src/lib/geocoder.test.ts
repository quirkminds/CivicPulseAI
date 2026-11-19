import { describe, expect, test } from "bun:test";
import { parseCandidates, parseFind, parseReverse, prettify } from "./geocoder";

// Fragmentos reales de https://www.cartociudad.es/geocoder/api/geocoder (19/11/2026), recortados a los campos
// que usamos. Las calles (callejero) llegan con lat/lng a 0: sus coordenadas se piden a /find.
const candidates = [
  {
    id: "13.PV.MUN_280790087391",
    type: "portal",
    address: "CALLE ALCALA 100, Madrid",
    muni: "Madrid",
    postalCode: "28009",
    lat: 40.425067513547695,
    lng: -3.6746686294123125,
  },
  {
    id: "280790006247",
    type: "callejero",
    address: "CALLE GRAN VIA, Madrid",
    muni: "Madrid",
    postalCode: "28008 28013 28014",
    lat: 0.0,
    lng: 0.0,
  },
  // «calle alcala»: CartoCiudad devuelve dos tramos de la misma calle con el mismo nombre.
  { id: "281660000003", type: "callejero", address: "CALLE ALCALA, Valverde de Alcalá", muni: "Valverde de Alcalá", postalCode: "28812", lat: 0.0, lng: 0.0 },
  { id: "281660000015", type: "callejero", address: "CALLE ALCALA, Valverde de Alcalá", muni: "Valverde de Alcalá", postalCode: "28812", lat: 0.0, lng: 0.0 },
  {
    id: "BTN_3222217",
    type: "toponimo",
    address: "Estación de Atocha, Madrid",
    muni: "Madrid",
    postalCode: "28045",
    lat: 40.40690103920502,
    lng: -3.691274910728851,
  },
  { id: "SEIG_E_615", type: "punto_recarga_electrica", address: "Punto de recarga eléctrica [Estacion Atocha,0], Madrid", muni: "Madrid", lat: 40.403851999996085, lng: -3.6855999999999813 },
  { id: "28012", type: "Codpost", address: "28012", muni: null, lat: 0.0, lng: 0.0 },
];

describe("parseCandidates", () => {
  const places = parseCandidates(candidates);

  test("pasa a [lng, lat] y separa la vía del municipio", () => {
    expect(places[0]).toEqual({
      id: "13.PV.MUN_280790087391",
      type: "portal",
      name: "Calle Alcala 100",
      detail: "28009 Madrid · Dirección",
      coords: [-3.6746686294123125, 40.425067513547695],
    });
  });

  test("quita ruido y duplicados", () => {
    expect(places.map((p) => p.name)).toEqual(["Calle Alcala 100", "Calle Gran Via", "Calle Alcala", "Estación de Atocha"]);
  });

  test("las calles quedan sin coordenadas (0,0) y sin la lista de códigos postales", () => {
    expect(places[1]).toMatchObject({ coords: null, detail: "Madrid · Calle" });
  });

  test("respuesta inesperada → lista vacía", () => {
    expect(parseCandidates(null)).toEqual([]);
  });
});

test("prettify respeta lo que no viene en mayúsculas", () => {
  expect(prettify("PASEO DE LA CASTELLANA")).toBe("Paseo de la Castellana");
  expect(prettify("Estación de Atocha")).toBe("Estación de Atocha");
});

test("parseReverse arma la dirección del portal más cercano", () => {
  // Respuesta real de reverseGeocode?lon=-3.7038&lat=40.4168
  expect(
    parseReverse({ type: "portal", address: "PUERTA DEL SOL", tip_via: "PLAZA", portalNumber: 7, muni: "Madrid" }),
  ).toBe("Plaza Puerta del Sol 7, Madrid");
  expect(parseReverse(null)).toBeNull();
});

test("parseFind da las coordenadas de una calle", () => {
  // Respuesta real de /find?id=280790006247&type=callejero (Gran Vía)
  expect(parseFind({ id: "280790006247", type: "callejero", lat: 40.42095570812921, lng: -3.7050937122503633 })).toEqual([
    -3.7050937122503633, 40.42095570812921,
  ]);
  expect(parseFind({ lat: 0, lng: 0 })).toBeNull();
});
