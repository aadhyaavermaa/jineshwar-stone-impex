const db = require("./db");
const bcrypt = require("bcrypt");
const examples = [
  ["Bianco Marble", "Marble", "Ivory", "Honed", "Flooring, Wall cladding", "marble"],
  ["Graphite Granite", "Granite", "Grey", "Polished", "Countertops, Flooring", "granite"],
  ["Verde Onyx", "Onyx", "Green", "Polished", "Feature walls, Table tops", "onyx"],
  ["Carved Marble Bowl", "Handicrafts", "Ivory", "Honed", "Tableware, Décor", "craft"],
  ["Ivory Marble Tile", "Marble", "Ivory", "Polished", "Wall cladding, Flooring", "marble"],
  ["Onyx Accent Panel", "Onyx", "Green", "Honed", "Feature walls, Décor", "onyx"],
  ["Architectural Stone Table", "Furniture", "Ivory", "Honed", "Dining, Interiors", "table"],
  [
    "Stone Bathroom Set",
    "Handicrafts",
    "Beige",
    "Honed",
    "Bathroom accessories, Interiors",
    "bath",
  ],
  ["Carved Marble Sculpture", "Handicrafts", "Ivory", "Honed", "Décor, Interiors", "sculpture"],
  ["Sculptural Bookends", "Handicrafts", "Beige", "Honed", "Décor, Shelving", "bookends"],
];
const captions = [
  "Soft gold-grey veins cross an ivory ground. A honed finish keeps the surface quiet under changing light.",
  "Fine mineral flecks give this dark grey surface depth. Shown polished for a crisp, reflective finish.",
  "Olive bands and cream seams run across the face of this translucent green material.",
  "A shallow marble bowl with a scalloped rim and a softly finished interior.",
  "An ivory tile study for spaces where a continuous, polished surface is part of the brief.",
  "A honed onyx panel with layered green bands for a wall or furniture insert.",
  "An oval stone top rests on broad slab legs, giving the table a low architectural profile.",
  "A coordinated set of pale veined stone accessories for a bathroom countertop.",
  "A twisting carved form explores the contrast between a smooth surface and deep shadow.",
  "A pair of wedge-shaped stone bookends frames a shelf with bands of natural colour.",
];
async function seed() {
  const insert = db.prepare(
    `INSERT INTO products(product_code,name,category,description,colour,finish,origin,dimensions,applications,image_url,availability,is_featured) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(product_code) DO NOTHING`,
  );
  examples.forEach(([name, category, colour, finish, applications, image], index) => {
    const size =
      image === "craft"
        ? "Ø 24 × 8 cm"
        : category === "Furniture" || category === "Handicrafts"
          ? "Custom dimensions"
          : "20 mm";
    insert.run(
      "DEMO-" + (101 + index),
      name,
      category,
      captions[index],
      colour,
      finish,
      "Confirm with studio",
      size,
      applications,
      "/images/" + image + ".webp",
      index % 3 === 0 ? "Made to order" : "Available",
      Number(index < 4),
    );
  });
  const { ADMIN_USERNAME: user, ADMIN_PASSWORD: password } = process.env;
  if (!user || !password) {
    console.log("Sample products ready. Set administrator variables and rerun to enable login.");
    return;
  }
  if (user.length > 80 || password.length < 12 || Buffer.byteLength(password) > 72)
    throw Error("Use a username up to 80 characters and a password of 12–72 bytes.");
  const hash = await bcrypt.hash(password, 12);
  db.prepare(
    "INSERT INTO admins(username,password_hash) VALUES(?,?) ON CONFLICT(username) DO NOTHING",
  ).run(user, hash);
  console.log("Sample products and administrator ready.");
}
seed().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
