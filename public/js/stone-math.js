// Shared by the live estimator and the Express save route. The server always recalculates totals.
const StoneMath = (() => {
  const lengthUnits = { feet: 0.3048, inches: 0.0254, metres: 1, centimetres: 0.01 };
  const areaUnits = { "sq ft": 0.3048 ** 2, "sq m": 1 };

  function choice(value, allowed, label) {
    if (!allowed.includes(value)) throw Error("Choose a valid " + label + ".");
    return value;
  }

  function amount(value, label, minimum, maximum) {
    if (typeof value !== "number" && (typeof value !== "string" || !value.trim()))
      throw Error("Enter " + label + ".");
    const number = Number(value);
    if (!Number.isFinite(number) || number < minimum || number > maximum)
      throw Error("Check " + label + " (" + minimum + " to " + maximum + ").");
    return number;
  }

  function calculate(type, raw = {}) {
    choice(type, ["surface", "tile", "slab"], "calculation mode");
    const inputs = {
      source: choice(raw.source, ["dimensions", "area"], "area input method"),
      areaUnit: choice(raw.areaUnit, Object.keys(areaUnits), "area unit"),
      waste: amount(raw.waste, "wastage percentage", 0, 100),
      rate:
        raw.rate == null || raw.rate === ""
          ? null
          : amount(raw.rate, "material rate", 0, 100000000),
    };
    let surfaceArea;
    if (inputs.source === "dimensions") {
      inputs.length = amount(raw.length, "surface length", 0.0001, 100000);
      inputs.width = amount(raw.width, "surface width or wall height", 0.0001, 100000);
      inputs.unit = choice(raw.unit, Object.keys(lengthUnits), "length unit");
      surfaceArea =
        (inputs.length * inputs.width * lengthUnits[inputs.unit] ** 2) / areaUnits[inputs.areaUnit];
    } else {
      inputs.area = amount(raw.area, "surface area", 0.000001, 1e9);
      surfaceArea = inputs.area;
    }

    const wastageArea = (surfaceArea * inputs.waste) / 100;
    const requiredArea = surfaceArea + wastageArea;
    let pieceArea = null;
    // Remove binary floating-point noise before rounding. Exactly 12 tiles should remain 12.
    let quantity = Number(requiredArea.toPrecision(15));
    if (type !== "surface") {
      inputs.pieceLength = amount(raw.pieceLength, type + " length", 0.0001, 100000);
      inputs.pieceWidth = amount(raw.pieceWidth, type + " width", 0.0001, 100000);
      inputs.pieceUnit = choice(raw.pieceUnit, Object.keys(lengthUnits), type + " unit");
      pieceArea =
        (inputs.pieceLength * inputs.pieceWidth * lengthUnits[inputs.pieceUnit] ** 2) /
        areaUnits[inputs.areaUnit];
      quantity = Math.ceil(Number((requiredArea / pieceArea).toPrecision(15)));
    } else {
      // Match the six-decimal RFQ input precision and never round material down.
      quantity = Math.ceil(Number((quantity * 1e6).toPrecision(15))) / 1e6;
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9 || requiredArea > 1e9)
      throw Error(
        "This project exceeds the supported area or quantity. Check your dimensions and units.",
      );
    const cost = inputs.rate === null ? null : Math.round(quantity * inputs.rate * 100) / 100;
    if (cost !== null && !Number.isSafeInteger(Math.round(cost * 100)))
      throw Error("This cost exceeds the supported range. Check your dimensions and rate.");
    return {
      inputs,
      surfaceArea,
      wastageArea,
      requiredArea,
      pieceArea,
      quantity,
      quantityUnit: type === "surface" ? inputs.areaUnit : "pieces",
      cost,
    };
  }

  function quotationURL(type, result, productId, projectName) {
    const p = new URLSearchParams({ quantity: String(result.quantity), unit: result.quantityUnit });
    if (productId) p.set("product", productId);
    const i = result.inputs;
    const size =
      i.source === "area" ? i.area + " " + i.areaUnit : i.length + " × " + i.width + " " + i.unit;
    const piece =
      type === "surface"
        ? ""
        : " Each " +
          type +
          " measures " +
          i.pieceLength +
          " × " +
          i.pieceWidth +
          " " +
          i.pieceUnit +
          ".";
    p.set(
      "message",
      (projectName ? projectName + ". " : "") +
        "Planning estimate for " +
        size +
        " with " +
        i.waste +
        "% wastage." +
        piece,
    );
    return "/quotation.html?" + p.toString();
  }

  return { calculate, quotationURL };
})();
if (typeof module !== "undefined" && module.exports) module.exports = StoneMath;
