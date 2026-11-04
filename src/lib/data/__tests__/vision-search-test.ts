import { photoIntent } from "../vision-search";

describe("photoIntent", () => {
  it("keeps the type, event, and one color, and drops style words and an every-size guess", () => {
    const intent = photoIntent({
      categories: ["Dresses"],
      events: ["Formal"],
      sizes: ["XS", "S", "M", "L", "XL"],
      words: ["black", "polka dot", "button", "fitted", "elegant"],
    });
    expect(intent).toEqual({
      categories: ["Dresses"],
      events: ["Formal"],
      sizes: [],
      maxPrice: null,
      words: ["black"],
    });
  });

  it("keeps a confident size and ignores values outside the allowed lists", () => {
    const intent = photoIntent({
      categories: ["Gowns"],
      sizes: ["S"],
      words: ["Fitted"],
    });
    expect(intent).toEqual({
      categories: [],
      events: [],
      sizes: ["S"],
      maxPrice: null,
      words: [],
    });
  });
});
