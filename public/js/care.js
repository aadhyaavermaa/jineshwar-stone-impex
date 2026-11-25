(() => {
  const guides = {
    Marble: {
      image: "marble", intro: "Acids can mark marble by reacting with its carbonate minerals. A dull spot may be an etch even after the spill is gone.",
      clean: "For a marble counter, move countertop items aside and use a soft damp cloth with a cleaner labelled for marble. Rinse away residue and dry.",
      avoid: "Keep vinegar, lemon cleaners and abrasive creams off marble. Ask a stone professional about persistent dull patches.",
      setting: "For exterior marble or wet flooring, have the supplier confirm weather exposure, finish and footing for the installation."
    },
    Granite: {
      image: "granite", intro: "A stone sold as granite can contain several minerals. Its finish and any factory treatment affect the cleaning and sealing instructions.",
      clean: "Clear crumbs and grit before wiping a granite counter. Use a neutral stone cleaner and a soft cloth. Place hot cookware on a trivet.",
      avoid: "Avoid acidic rust removers and abrasive pads. Use a chopping board to keep food preparation off the stone itself.",
      setting: "For outdoor counters, confirm that the slab, sealer, support and joints suit the local climate."
    },
    Onyx: {
      image: "onyx", intro: "Architectural onyx is commonly a banded carbonate stone. Treat its surface gently, especially on decorative panels and objects.",
      clean: "Dust with a clean soft cloth and use a supplier-approved neutral cleaner. On backed or assembled objects, ask how the joins and backing should be cleaned.",
      avoid: "Keep acidic liquids away. Lift decorative items to avoid dragging a hard edge across the finish.",
      setting: "Ask the fabricator before choosing an exposed or frequently wet location, particularly for a thin or translucent panel."
    },
    Travertine: {
      image: "interior", intro: "Travertine can have open pores or filled areas. Identify the surface treatment before choosing a cleaner.",
      clean: "Remove loose dirt gently. Use a neutral cleaner approved for the finish and take care around filled areas.",
      avoid: "Skip acidic descalers and abrasive scrubbing. Consult the installer about loose or damaged filler.",
      setting: "For exterior paving, confirm how the finish, drainage and chosen filler perform in local conditions."
    },
    Sandstone: {
      image: "interior", intro: "Sandstone varies in grain, cement and absorption. Ask the supplier to identify the finish and any existing treatment.",
      clean: "Use a soft brush for loose grit, then a neutral stone-safe cleaner compatible with the installation.",
      avoid: "Avoid harsh acids, wire brushes and aggressive pressure cleaning. Ask the installer how to treat an existing stain.",
      setting: "For garden paving, keep drainage paths clear and confirm a suitable method for the local stone before treating growth."
    },
    "Other or unknown stone": {
      image: "interior", intro: "A commercial name or photograph may give too little information to identify a material. Check the invoice, fabrication notes or supplier record.",
      clean: "Start with a dry soft cloth for loose dust. Ask the supplier about water, cleaner and treatment compatibility.",
      avoid: "Wait for positive identification before applying acidic, abrasive or specialist products.",
      setting: "Ask for material-specific advice on exterior exposure, wet areas and foot traffic."
    }
  };
  const select = document.getElementById("care-material");
  const image = document.getElementById("care-image");
  function render() {
    const name = select.value;
    const guide = guides[name];
    document.getElementById("material-title").textContent = name;
    document.getElementById("material-note").textContent = guide.intro;
    image.src = "/images/" + guide.image + ".webp";
    image.alt = guide.image === "interior" ? "Illustrative architectural stone interior" : "Illustrative " + name.toLowerCase() + " surface";
    const topics = [
      ["Routine cleaning and suitable products", guide.clean],
      ["Products and methods to avoid", guide.avoid],
      ["Spills and stain prevention", "Blot a spill promptly with an absorbent cloth. Use coasters beneath drinks and protect surfaces where oil or cosmetics may collect."],
      ["Sealing considerations", "Ask whether this particular stone needs a sealer. Follow its label and the installer’s instructions for reapplication. A treatment may improve stain resistance; spills still need attention."],
      ["Grit and scratch prevention", "Clean entrance mats and remove grit before it is walked across a floor. Use soft pads under moveable objects."],
      ["Indoor and outdoor precautions", guide.setting]
    ];
    const container = document.getElementById("care-accordions");
    container.replaceChildren();
    topics.forEach(([title, text], i) => {
      const detail = document.createElement("details");
      const summary = document.createElement("summary");
      const body = document.createElement("p");
      summary.textContent = title;
      body.textContent = text;
      detail.open = i === 0;
      detail.append(summary, body);
      container.append(detail);
    });
  }
  // An unrecognised category (e.g. Furniture) should never imply a specific mineral.
  const requested = new URLSearchParams(location.search).get("material");
  if (requested) {
    select.value = Object.keys(guides).find(name => new RegExp("\\b" + name + "\\b", "i").test(requested)) || "Other or unknown stone";
  }
  select.addEventListener("change", render);
  render();
})();
