// All object positions are stored in canvas coordinates. CSS may shrink the board,
// so pointer coordinates are converted back from the displayed size before hit testing.
async function startMoodboard() {
  const products = Studio.surfaces(await api("/api/products"));
  const samples = new Map(products.map((p) => [p.id, p]));
  const images = new Map(),
    loading = new Set();
  const key = "jsi-material-board-v1";
  const canvas = $("#board"),
    ctx = canvas.getContext("2d");
  const title = $("#board-title"),
    palette = $("#board-colour"),
    chooser = $("#board-material");
  const layers = $("#layers"),
    size = $("#layer-size");
  const clamp = (n, min, max) => Math.max(min, Math.min(n, max));
  const fresh = () => ({
    title: "My material study",
    colour: "#f5efe3",
    layers: [],
  });
  const colours = Array.from(palette.options, (o) => o.value);
  let board = fresh(),
    active = -1,
    drag = null,
    hasStorage = true;
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    if (stored && Array.isArray(stored.layers)) {
      board.title = String(stored.title ?? "").slice(0, 55);
      board.colour = colours.includes(stored.colour)
        ? stored.colour
        : colours[0];
      board.layers = stored.layers
        .filter(
          (item) =>
            item &&
            [item.x, item.y, item.w].every(Number.isFinite) &&
            (item.type === "sample"
              ? samples.has(item.id)
              : item.type === "note" && typeof item.text === "string"),
        )
        .slice(0, 40);
      board.layers.forEach((item) => {
        if (item.type === "note") item.text = item.text.slice(0, 55);
        bound(item);
      });
      active = board.layers.length - 1;
    }
  } catch {
    /* With invalid or unavailable local storage, start with a fresh board. */
  }
  function persist() {
    try {
      localStorage.setItem(key, JSON.stringify(board));
    } catch {
      if (hasStorage)
        message(
          "Changes cannot be saved to this browser. Download your board to keep a copy.",
        );
      hasStorage = false;
    }
  }
  function sourceImage(item) {
    if (item.type !== "sample") return;
    const path = samples.get(item.id).image_url;
    if (images.has(path) || loading.has(path)) return;
    loading.add(path);
    Studio.image(path)
      .then((img) => images.set(path, img))
      .catch(() => images.set(path, null))
      .finally(() => {
        loading.delete(path);
        draw();
        $("#export-board").disabled = !!loading.size;
      });
  }
  function label(item) {
    return item.type === "sample" ? samples.get(item.id).name : item.text;
  }
  function height(item) {
    return item.type === "sample" ? Math.round(item.w * 0.69) + 48 : 90;
  }
  function bound(item) {
    item.w = clamp(item.w, 120, 700);
    item.x = clamp(item.x, 10, canvas.width - item.w - 10);
    item.y = clamp(item.y, 125, canvas.height - height(item) - 38);
  }
  function draw(selection = true) {
    const w = canvas.width,
      h = canvas.height;
    ctx.fillStyle = board.colour;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#344236";
    ctx.font = "500 17px sans-serif";
    ctx.fillText("JINESHWAR  /  STONE IMPEX", 35, 34);
    ctx.font = "44px Georgia,serif";
    ctx.fillText(board.title || "Material study", 35, 93, w - 70);
    ctx.fillRect(35, 112, w - 70, 1);
    board.layers.forEach((item, i) => {
      const { x, y, w } = item,
        h = height(item);
      ctx.fillStyle = item.type === "sample" ? "#fffdf8" : "#f8f5ed";
      ctx.fillRect(x, y, w, h);
      if (item.type === "sample") {
        const img = images.get(samples.get(item.id).image_url),
          imageH = h - 48;
        if (img) {
          // Cover-crop the photo, preserving its aspect ratio at every sample size.
          const scale = Math.max(w / img.width, imageH / img.height);
          const sw = w / scale,
            sh = imageH / scale;
          ctx.drawImage(
            img,
            (img.width - sw) / 2,
            (img.height - sh) / 2,
            sw,
            sh,
            x,
            y,
            w,
            imageH,
          );
        } else {
          ctx.fillStyle = "#ded8ca";
          ctx.fillRect(x, y, w, imageH);
          ctx.fillStyle = "#383d32";
          ctx.font = "16px sans-serif";
          ctx.fillText(
            loading.size ? "Loading image…" : "Image unavailable",
            x + 8,
            y + 24,
            w - 16,
          );
        }
        ctx.fillStyle = "#263026";
        ctx.font = "22px Georgia,serif";
        ctx.fillText(label(item), x + 12, y + h - 16, w - 24);
      } else {
        ctx.fillStyle = "#364437";
        ctx.font = "italic 23px Georgia,serif";
        const words = item.text.split(/\s+/);
        let lines = [""];
        for (const word of words) {
          const i = lines.length - 1,
            expanded = (lines[i] + " " + word).trim();
          if (
            lines[i] &&
            ctx.measureText(expanded).width > w - 24 &&
            lines.length < 2
          )
            lines.push(word);
          else lines[i] = expanded;
        }
        lines.forEach((line, i) =>
          ctx.fillText(line, x + 12, y + 35 + i * 26, w - 24),
        );
      }
      if (selection && i === active) {
        ctx.strokeStyle = "#344c37";
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 1.5, y - 1.5, w + 3, h + 3);
        ctx.fillStyle = "#344c37";
        ctx.fillRect(x + w - 11, y + h - 11, 18, 18);
      }
    });
    ctx.fillStyle = "#455044";
    ctx.font = "16px sans-serif";
    ctx.fillText("DESIGN STUDIO   /   MATERIAL MOODBOARD", 35, h - 14);
  }
  function sync() {
    title.value = board.title;
    palette.value = board.colour;
    layers.replaceChildren();
    board.layers.forEach((item, i) =>
      layers.add(Studio.option(i, label(item))),
    );
    if (!board.layers.length)
      layers.add(Studio.option("", "Add a material or note"));
    layers.disabled = !board.layers.length;
    if (active >= 0) layers.value = String(active);
    const selected = board.layers[active];
    size.disabled = !selected;
    $("#remove-layer").disabled = !selected;
    if (selected) size.value = String(selected.w);
    const details = $("#open-layer");
    details.hidden = selected?.type !== "sample";
    if (!details.hidden)
      details.href = "/product-details.html?id=" + selected.id;
    board.layers.forEach(sourceImage);
    $("#export-board").disabled = !!loading.size;
    Studio.status(
      board.layers.length +
        " layer" +
        (board.layers.length === 1 ? "" : "s") +
        " · " +
        (hasStorage ? "Saved on this browser" : "Browser storage unavailable") +
        (products.length ? "" : ". No catalogue textures available") +
        ".",
    );
    draw();
  }
  function add(item) {
    if (board.layers.length >= 40)
      return message("A board holds up to 40 layers. Remove a layer first.");
    const i = board.layers.length;
    item.x = 40 + (i % 3) * 280;
    item.y = 150 + (Math.floor(i / 3) % 2) * 245;
    item.w = item.type === "sample" ? 270 : 340;
    bound(item);
    board.layers.push(item);
    active = i;
    sync();
    persist();
  }
  products.forEach((p) =>
    chooser.add(Studio.option(p.id, p.name + " · " + p.finish)),
  );
  $("#add-sample").disabled = !products.length;
  $("#add-sample").onclick = () =>
    add({ type: "sample", id: Number(chooser.value) });
  $("#add-note").onclick = () => {
    const input = $("#board-note"),
      text = input.value.trim();
    if (!text) {
      input.focus();
      return message("Enter a short note first.");
    }
    add({ type: "note", text });
    input.value = "";
  };
  title.oninput = () => {
    board.title = title.value;
    draw();
    persist();
  };
  palette.onchange = () => {
    board.colour = palette.value;
    draw();
    persist();
  };
  layers.onchange = () => {
    active = Number(layers.value);
    sync();
  };
  size.oninput = () => {
    const item = board.layers[active];
    if (item) {
      item.w = Number(size.value);
      bound(item);
      draw();
      persist();
    }
  };
  $("#remove-layer").onclick = () => {
    if (active < 0) return;
    board.layers.splice(active, 1);
    active = Math.min(active, board.layers.length - 1);
    sync();
    persist();
  };
  const reset = $("#board-reset-dialog");
  $("#reset-board").onclick = () => reset.showModal();
  $("#cancel-reset").onclick = () => reset.close();
  $("#confirm-reset").onclick = () => {
    board = fresh();
    active = -1;
    sync();
    persist();
    reset.close();
  };
  function position(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * canvas.width) / rect.width,
      y: ((e.clientY - rect.top) * canvas.height) / rect.height,
    };
  }
  canvas.onpointerdown = (e) => {
    if (e.button !== 0 || !e.isPrimary) return;
    const p = position(e);
    for (let i = board.layers.length - 1; i >= 0; i--) {
      const item = board.layers[i],
        endX = item.x + item.w,
        endY = item.y + height(item);
      if (
        p.x >= item.x - 4 &&
        p.x <= endX + 12 &&
        p.y >= item.y - 4 &&
        p.y <= endY + 12
      ) {
        const resize =
          i === active &&
          Math.abs(endX - p.x) < 25 &&
          Math.abs(endY - p.y) < 25;
        active = i;
        drag = { resize, dx: p.x - item.x, dy: p.y - item.y };
        canvas.setPointerCapture(e.pointerId);
        canvas.focus({ preventScroll: true });
        sync();
        return;
      }
    }
    active = -1;
    sync();
    layers.selectedIndex = -1;
  };
  canvas.onpointermove = (e) => {
    if (!drag || !e.isPrimary) return;
    const item = board.layers[active],
      p = position(e);
    if (drag.resize) item.w = p.x - item.x;
    else {
      item.x = p.x - drag.dx;
      item.y = p.y - drag.dy;
    }
    bound(item);
    size.value = Math.round(item.w);
    draw();
  };
  canvas.onlostpointercapture = () => {
    drag = null;
    persist();
  };
  canvas.onkeydown = (e) => {
    const offsets = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    if (active < 0 || !offsets[e.key]) return;
    e.preventDefault();
    const item = board.layers[active],
      step = e.shiftKey ? 24 : 6;
    item.x += offsets[e.key][0] * step;
    item.y += offsets[e.key][1] * step;
    bound(item);
    draw();
    persist();
  };
  $("#export-board").onclick = () => {
    // Selection outlines belong to the editor, never to the exported PNG.
    draw(false);
    canvas.toBlob((blob) => {
      if (!blob) return message("PNG export could not finish.");
      const a = document.createElement("a"),
        url = URL.createObjectURL(blob);
      a.download =
        (board.title.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 60) ||
          "material-moodboard") + ".png";
      a.href = url;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, "image/png");
    draw();
  };
  sync();
}
startMoodboard().catch((e) => Studio.status(e.message));
