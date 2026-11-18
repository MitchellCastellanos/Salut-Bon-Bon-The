import { expect, it } from "vitest";
import { salesTax } from "../src/pickup-policy";

const GST = 5000;   // 5 %, in thousandths of one percent
const QST = 9975;   // 9.975 %

it("computes GST and QST separately on the pre-tax subtotal and rounds to the cent", () => {
  expect(salesTax(1000, [GST, QST])).toBe(50 + 100);       // 99.75¢ rounds to 100¢
  expect(salesTax(675, [GST, QST])).toBe(34 + 67);         // 33.75→34, 67.33→67
  expect(salesTax(1, [GST, QST])).toBe(0);
  expect(salesTax(1000, [])).toBe(0);                      // tax-exempt configuration
  expect(salesTax(1000, [GST])).toBe(50);                  // GST-only configuration
});

it("never produces a fractional or negative amount", () => {
  for (const subtotal of [1, 99, 650, 725, 1999, 123457]) {
    const tax = salesTax(subtotal, [GST, QST]);
    expect(Number.isInteger(tax) && tax >= 0).toBe(true);
  }
});
