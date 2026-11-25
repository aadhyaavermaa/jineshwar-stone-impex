/* Studio pages use active catalogue records. Canvas exports require a same-origin image. */
const Studio = {
  status(text) {
    document.getElementById("studio-status").textContent = text;
  },
  option(value, label) {
    return new Option(label, value);
  },
  localImage(product) {
    try {
      const u = new URL(product.image_url, location.origin);
      return u.origin === location.origin && u.pathname.startsWith("/images/");
    } catch {
      return false;
    }
  },
  surfaces(products) {
    return products.filter(
      (p) =>
        Studio.localImage(p) &&
        /marble|granite|onyx|travertine|stone slab|limestone|quartz|sandstone|slate|basalt|quartzite/i.test(
          p.category,
        ),
    );
  },
  async image(url) {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  },
};
