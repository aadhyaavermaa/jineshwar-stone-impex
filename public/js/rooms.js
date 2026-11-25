// Polygons trace only the application surface in each 500 × 333 reference frame.
// The same room pixels serve both sides of a comparison, keeping the camera aligned.
const roomStudies = {
  living: {
    title: "Living room flooring",
    surface: "floor",
    balance: 150,
    points: [
      [0, 209],
      [63, 188],
      [110, 186],
      [117, 189],
      [147, 189],
      [150, 193],
      [378, 193],
      [380, 187],
      [392, 187],
      [394, 190],
      [428, 189],
      [430, 184],
      [459, 184],
      [483, 180],
      [484, 204],
      [500, 210],
      [500, 333],
      [0, 333],
    ],
  },
  kitchen: {
    title: "Kitchen countertop",
    surface: "worktop",
    balance: 180,
    points: [
      [50, 200],
      [87, 179],
      [416, 179],
      [453, 200],
      [453, 204],
      [50, 204],
    ],
  },
  bathroom: {
    title: "Bathroom feature wall",
    surface: "wall",
    balance: 167,
    points: [
      [95, 22],
      [500, 22],
      [500, 279],
      [160, 279],
      [164, 253],
      [166, 225],
      [153, 221],
      [134, 221],
      [112, 224],
      [95, 226],
    ],
  },
  bedroom: {
    title: "Bedroom flooring",
    surface: "floor",
    balance: 142,
    points: [
      [0, 211],
      [45, 196],
      [96, 188],
      [141, 184],
      [138, 201],
      [150, 196],
      [150, 212],
      [375, 212],
      [380, 203],
      [378, 186],
      [410, 184],
      [437, 185],
      [500, 218],
      [500, 333],
      [0, 333],
    ],
  },
  wall: {
    title: "Foyer wall cladding",
    surface: "wall",
    balance: 126,
    points: [
      [108, 22],
      [500, 22],
      [500, 279],
      [108, 279],
    ],
  },
};

async function renderRoom(roomKey, product) {
  const study = roomStudies[roomKey];
  const [room, texture] = await Promise.all([
    Studio.image("/images/rooms/" + roomKey + ".webp"),
    Studio.image(product.image_url),
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = room.width;
  canvas.height = room.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(room, 0, 0);
  const lighting = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const surface = document.createElement("canvas");
  surface.width = canvas.width;
  surface.height = canvas.height;
  const overlay = surface.getContext("2d");
  const xs = study.points.map((p) => (p[0] * canvas.width) / 500);
  const ys = study.points.map((p) => (p[1] * canvas.height) / 333);
  const top = Math.floor(Math.min(...ys)),
    bottom = Math.ceil(Math.max(...ys));
  const left = Math.floor(Math.min(...xs)),
    right = Math.ceil(Math.max(...xs));
  overlay.beginPath();
  study.points.forEach((p, i) =>
    i ? overlay.lineTo(xs[i], ys[i]) : overlay.moveTo(xs[i], ys[i]),
  );
  overlay.closePath();
  overlay.clip();
  // Foreshorten horizontal surfaces; retain shadows and window light from the room.
  overlay.drawImage(texture, left, top, right - left, bottom - top);
  const patch = overlay.getImageData(left, top, right - left, bottom - top);
  for (let y = 0; y < patch.height; y++) {
    for (let x = 0; x < patch.width; x++) {
      const i = (y * patch.width + x) * 4;
      if (!patch.data[i + 3]) continue;
      const j = ((top + y) * canvas.width + left + x) * 4;
      const luminance =
        0.21 * lighting.data[j] +
        0.72 * lighting.data[j + 1] +
        0.07 * lighting.data[j + 2];
      const shade = Math.max(0.24, Math.min(1.38, luminance / study.balance));
      for (let c = 0; c < 3; c++) patch.data[i + c] = patch.data[i + c] * shade;
    }
  }
  overlay.putImageData(patch, left, top);
  ctx.drawImage(surface, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.88);
}

async function startRoomStudy() {
  const select = $("#room"),
    tray = $("#textures"),
    info = $("#material-info");
  const products = Studio.surfaces(await api("/api/products"));
  if (!products.length) {
    select.disabled = true;
    if ($("#reset-preview")) $("#reset-preview").disabled = true;
    return Studio.status(
      "No local catalogue stone textures are available for this study.",
    );
  }
  let selected = products[0],
    revision = 0;
  Object.entries(roomStudies).forEach(([key, room]) =>
    select.add(Studio.option(key, room.title)),
  );
  async function repaint() {
    const rev = ++revision;
    Studio.status("Rendering material preview…");
    const key = select.value;
    const id = Number(selected.id);
    info.innerHTML =
      "<h3>" +
      escapeHTML(selected.name) +
      "</h3><p>" +
      escapeHTML(
        [selected.category, selected.finish, selected.colour]
          .filter(Boolean)
          .join(" · "),
      ) +
      "</p><p>" +
      escapeHTML(selected.description) +
      '</p><div class="actions"><button class="outline" data-save="wish" data-id="' +
      id +
      '">Save stone</button><a class="outline" href="/product-details.html?id=' +
      id +
      '">View product</a><a class="btn" href="/quotation.html?product=' +
      id +
      '">Request a quote</a></div>';
    syncButtons();
    Array.from(tray.children).forEach((b) =>
      b.setAttribute("aria-pressed", String(Number(b.dataset.id) === id)),
    );
    try {
      const src = await renderRoom(key, selected);
      if (rev !== revision) return;
      if ($("#before")) $("#before").src = "/images/rooms/" + key + ".webp";
      const image = $("#room-result") || $("#after");
      image.src = src;
      image.alt = roomStudies[key].title + " rendered with " + selected.name;
      Studio.status(roomStudies[key].title + " · " + selected.name);
    } catch {
      if (rev === revision)
        Studio.status(
          "This material image could not be rendered. Select another finish or refresh.",
        );
    }
  }
  products.forEach((p) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.id = p.id;
    button.title = p.name + " · " + p.finish;
    button.setAttribute("aria-label", button.title);
    const img = document.createElement("img");
    img.alt = "";
    img.src = p.image_url;
    button.append(img);
    button.onclick = () => {
      selected = p;
      repaint();
    };
    tray.append(button);
  });
  select.addEventListener("change", repaint);
  const reset = $("#reset-preview");
  if (reset)
    reset.onclick = () => {
      select.value = "living";
      selected = products[0];
      repaint();
    };
  const divider = $("#divider");
  if (divider)
    divider.oninput = () => {
      divider.parentElement.style.setProperty("--split", divider.value + "%");
      divider.setAttribute(
        "aria-valuetext",
        divider.value + " percent original surface",
      );
    };
  await repaint();
}
startRoomStudy().catch((e) => Studio.status(e.message));
