import { describe, expect, it } from "vitest";
import { foldText, matchesClient } from "./search";

const dania = { name: "Dania Peña", phone: "6142708576" };

describe("matchesClient", () => {
  it.each(["Dania", "dania peña", "Dania Pena", "pena", "PEÑA", "pena dania", "dan pe", "2708576", "614 270 8576"])(
    "encuentra a Dania con %j",
    (term) => expect(matchesClient(dania, term)).toBe(true)
  );

  it("ignora acentos en ambos sentidos", () => {
    expect(matchesClient({ name: "Sofía Chávez", phone: "6141428871" }, "sofia chavez")).toBe(true);
    expect(matchesClient({ name: "Maria Lopez", phone: "6140000000" }, "María López")).toBe(true);
  });

  it.each(["Daniela", "Lucero", "12", "xyz"])("no confunde con %j", (term) => {
    expect(matchesClient(dania, term)).toBe(false);
  });
});

it("foldText normaliza mayúsculas, acentos y espacios", () => {
  expect(foldText("  Dania   PEÑA ")).toBe("dania pena");
});
