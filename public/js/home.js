const slides = [
  ["hero", "ARCHITECTURAL STUDY　/　MARBLE PAVILION", "Sunlit marble pavilion"],
  ["interior", "INTERIOR STUDY　/　STONE VANITY", "Green stone vanity"],
  ["table", "FURNITURE STUDY　/　ARCHITECTURAL TABLE", "Architectural stone table"],
];
let position = 0;
function slide(by) {
  position = (position + by + slides.length) % slides.length;
  const [img, label, alt] = slides[position],
    photo = $("#hero-image");
  photo.src = "/images/" + img + ".webp";
  photo.alt = alt;
  photo.classList.remove("crossfade");
  void photo.offsetWidth;
  photo.classList.add("crossfade");
  $("#slide-caption").textContent = label;
}
$("#prev").onclick = () => slide(-1);
$("#next").onclick = () => slide(1);
api("/api/products?featured=true")
  .then((rows) => {
    $("#featured").innerHTML = rows.length
      ? rows.map(card).join("")
      : empty("No featured materials at present.");
    syncButtons();
  })
  .catch((e) => showError($("#featured"), e));
