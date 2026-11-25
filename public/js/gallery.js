const photos = [
  ["hero", "Marble pavilion", "Interiors"],
  ["craft", "Scalloped marble bowl", "Objects"],
  ["marble", "Ivory veining", "Materials"],
  ["table", "Architectural table", "Objects"],
  ["interior", "Green stone vanity", "Interiors"],
  ["onyx", "Green onyx", "Materials"],
  ["bath", "Stone bathroom set", "Objects"],
  ["sculpture", "Carved marble sculpture", "Objects"],
  ["granite", "Dark granite", "Materials"],
  ["bookends", "Sculptural bookends", "Objects"],
];
let group = "All",
  visible = photos,
  index = 0;
function draw() {
  $("#chips").innerHTML = ["All", "Interiors", "Objects", "Materials"]
    .map((c) => '<button class="outline" aria-pressed="' + (group === c) + '">' + c + "</button>")
    .join("");
  $$("#chips button").forEach(
    (b) =>
      (b.onclick = () => {
        group = b.textContent;
        draw();
        $("#chips button[aria-pressed=true]").focus();
      }),
  );
  visible = photos.filter((p) => group === "All" || p[2] === group);
  $("#gallery").innerHTML = visible
    .map(
      ([img, label], i) =>
        '<button class="gallery-card" data-index="' +
        i +
        '"><img loading="lazy" alt="" src="/images/' +
        img +
        '.webp"><span>' +
        label +
        "</span></button>",
    )
    .join("");
  $$(".gallery-card").forEach(
    (b) =>
      (b.onclick = () => {
        index = Number(b.dataset.index);
        preview();
        $("#viewer").showModal();
      }),
  );
}
function preview() {
  const [img, label] = visible[index];
  $("#large").src = "/images/" + img + ".webp";
  $("#large").alt = label;
  $("#caption").textContent = label + " · " + (index + 1) + " / " + visible.length;
}
function advance(n) {
  index = (index + n + visible.length) % visible.length;
  preview();
}
$("#previous").onclick = () => advance(-1);
$("#following").onclick = () => advance(1);
$("#close").onclick = () => $("#viewer").close();
$("#viewer").onkeydown = (e) => {
  if (e.key === "ArrowLeft") advance(-1);
  if (e.key === "ArrowRight") advance(1);
};
draw();
const start = photos.findIndex((p) => p[0] === query.get("image"));
if (start >= 0) {
  index = start;
  preview();
  $("#viewer").showModal();
}
