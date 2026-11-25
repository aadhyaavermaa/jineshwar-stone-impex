// All material notes are editorial examples. Changing this study never edits catalogue data.
const stoneStudyNotes = [
  {
    label: "Veining",
    detail:
      "Follow the lines across the face. Matching neighbouring slabs can carry a vein across a joint.",
    left: 27,
    top: 37,
  },
  {
    label: "Mineral grain",
    detail:
      "Small changes in grain give a surface its texture. Check several areas of a slab before choosing a piece.",
    left: 62,
    top: 29,
  },
  {
    label: "Origin",
    detail:
      "Ask for the quarry and lot details of the actual slab. Similar-looking stones can come from different sources.",
    left: 43,
    top: 73,
  },
  {
    label: "Finish",
    detail:
      "Polishing brings out reflections. Honing produces a softer sheen. Compare physical finish samples in the light of your space.",
    left: 74,
    top: 63,
  },
];

function initialiseStoneStudy(section) {
  section.classList.add("stone-study");
  section.innerHTML = `
    <div class="stone-study__copy">
      <p class="stone-study__label">Material study</p>
      <h2>From slab to space.</h2>
      <p>Look closely at the surface, then see how stone reads at the scale of a room.</p>
      <div class="stone-study__modes" role="group" aria-label="Study view">
        <button type="button" data-view="slab" aria-pressed="true">Raw stone</button>
        <button type="button" data-view="room" aria-pressed="false">In architecture</button>
      </div>
      <div class="stone-study__note" aria-live="polite" aria-atomic="true">
        <h3></h3><p></p>
      </div>
    </div>
    <figure class="stone-study__figure">
      <div class="stone-study__frame">
        <div class="stone-study__canvas">
          <img src="/images/marble.webp" alt="Illustrative marble surface with natural veining" loading="lazy" draggable="false">
          <div class="stone-study__points" role="group" aria-label="Material notes"></div>
        </div>
        <img class="stone-study__room" src="/images/interior.webp" alt="Architectural interior used as a stone design reference" loading="lazy" hidden>
      </div>
      <figcaption>
        <span class="stone-study__caption">Select a point to explore the surface.</span>
        <button type="button" class="stone-study__zoom" aria-pressed="false">Magnify</button>
      </figcaption>
    </figure>`;

  const frame = section.querySelector(".stone-study__frame");
  const canvas = section.querySelector(".stone-study__canvas");
  const points = section.querySelector(".stone-study__points");
  const room = section.querySelector(".stone-study__room");
  const caption = section.querySelector(".stone-study__caption");
  const zoom = section.querySelector(".stone-study__zoom");
  const notesHeading = section.querySelector(".stone-study__note h3");
  const notesBody = section.querySelector(".stone-study__note p");
  let selectedNote = 0;
  let magnified = false;
  let offset = { x: 0, y: 0 };
  let drag = null;
  const zoomScale = 1.6;

  function selectNote(index) {
    selectedNote = index;
    const note = stoneStudyNotes[index];
    notesHeading.textContent = note.label;
    notesBody.textContent = note.detail;
    Array.from(points.children).forEach((point, i) => {
      point.setAttribute("aria-pressed", String(i === index));
    });
  }

  stoneStudyNotes.forEach((note, index) => {
    const point = document.createElement("button");
    point.type = "button";
    point.textContent = String(index + 1);
    point.setAttribute("aria-label", "Explore " + note.label.toLowerCase());
    point.style.left = note.left + "%";
    point.style.top = note.top + "%";
    point.addEventListener("click", () => selectNote(index));
    points.append(point);
  });

  // Keep the scaled image inside its frame, including after a viewport resize.
  function pan(x, y) {
    const range = magnified ? (zoomScale - 1) / 2 : 0;
    const clamp = (value, max) => Math.max(-max, Math.min(max, value));
    offset = { x: clamp(x, frame.clientWidth * range), y: clamp(y, frame.clientHeight * range) };
    canvas.style.transform =
      "translate(" +
      offset.x +
      "px, " +
      offset.y +
      "px) scale(" +
      (magnified ? zoomScale : 1) +
      ")";
  }

  function setMagnification(value) {
    magnified = value;
    drag = null;
    frame.classList.toggle("is-magnified", value);
    frame.tabIndex = value ? 0 : -1;
    frame.setAttribute(
      "aria-label",
      value ? "Magnified stone surface. Use the arrow keys to pan." : "Stone study image",
    );
    frame.setAttribute("role", "group");
    zoom.setAttribute("aria-pressed", String(value));
    zoom.textContent = value ? "Reset view" : "Magnify";
    caption.textContent = value
      ? "Drag or use arrow keys on the image to pan."
      : "Select a point to explore the surface.";
    pan(0, 0);
  }

  section.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      const showRoom = button.dataset.view === "room";
      setMagnification(false);
      canvas.hidden = showRoom;
      zoom.hidden = showRoom;
      room.hidden = !showRoom;
      section.querySelectorAll("[data-view]").forEach((mode) => {
        mode.setAttribute("aria-pressed", String(mode === button));
      });
      if (showRoom) {
        notesHeading.textContent = "Stone at room scale";
        notesBody.textContent =
          "Consider sightlines, joints and daylight together. A dramatic vein on a small sample can become the focal point of a wall or counter.";
        caption.textContent = "Architectural illustration for material planning.";
      } else {
        selectNote(selectedNote);
      }
    });
  });

  zoom.addEventListener("click", () => {
    setMagnification(!magnified);
    if (magnified) frame.focus({ preventScroll: true });
  });
  frame.addEventListener("pointerdown", (event) => {
    if (!magnified || event.target.closest("button") || !event.isPrimary || event.button !== 0)
      return;
    drag = { x: event.clientX - offset.x, y: event.clientY - offset.y };
    frame.setPointerCapture(event.pointerId);
  });
  frame.addEventListener("pointermove", (event) => {
    if (drag && event.isPrimary) pan(event.clientX - drag.x, event.clientY - drag.y);
  });
  frame.addEventListener("lostpointercapture", () => {
    drag = null;
  });
  frame.addEventListener("keydown", (event) => {
    if (!magnified) return;
    const delta = {
      ArrowLeft: [-24, 0],
      ArrowRight: [24, 0],
      ArrowUp: [0, -24],
      ArrowDown: [0, 24],
    }[event.key];
    if (delta) {
      event.preventDefault();
      pan(offset.x + delta[0], offset.y + delta[1]);
    }
  });
  window.addEventListener("resize", () => {
    if (magnified) pan(offset.x, offset.y);
  });
  selectNote(0);
  setMagnification(false);
}

document.querySelectorAll("[data-stone-study]").forEach(initialiseStoneStudy);
