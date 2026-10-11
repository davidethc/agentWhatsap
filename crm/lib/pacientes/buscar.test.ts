import { describe, expect, it } from "vitest"

import { filtrarPacientes } from "./buscar"

const p = (id: number, nombre: string, telefono: string | null) => ({ id, nombre, telefono })
const lista = [
  p(1, "Ana Prueba", "593990000001"),
  p(2, "Úrsula Muestra", "593990000020"),
  p(3, "Bruno Ficticio", null),
]

describe("filtrarPacientes", () => {
  it("sin texto devuelve todos", () => {
    expect(filtrarPacientes(lista, "  ")).toEqual(lista)
  })
  it("busca por nombre sin importar mayúsculas ni tildes", () => {
    expect(filtrarPacientes(lista, "ursula").map((x) => x.id)).toEqual([2])
    expect(filtrarPacientes(lista, "ANA").map((x) => x.id)).toEqual([1])
  })
  it("busca por parte del teléfono, con o sin formato", () => {
    expect(filtrarPacientes(lista, "0020").map((x) => x.id)).toEqual([2])
    expect(filtrarPacientes(lista, "+593 99 000 0001").map((x) => x.id)).toEqual([1])
    expect(filtrarPacientes(lista, "099000").map((x) => x.id)).toEqual([1, 2])
  })
  it("un texto sin dígitos no coincide con teléfonos y sin coincidencias da lista vacía", () => {
    expect(filtrarPacientes(lista, "zzz")).toEqual([])
  })
})
