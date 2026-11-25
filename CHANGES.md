# Version 2.0 upgrade

The following inventory compares this release with the original university project archive. Six new tables support customer accounts, saved stones, saved estimates, versioned quotations, enquiry messages and read/unread notifications. The existing enquiry table gained sample, owner and staff-response fields. The original product and administrator records retain their identifiers. The added runtime dependencies are google-auth-library and nodemailer.

## Modified files

| Folder | Files |
| --- | --- |
| Project root | `.env.example`, `ASSETS.md`, `README.md`, `VIVA_GUIDE.md`, `package-lock.json`, `package.json`, `server.js` |
| `database` | `db.js`, `seed.js` |
| `public/admin` | `dashboard.html`, `enquiries.html`, `login.html`, `products.html` |
| `public` | `calculator.html`, `compare.html`, `contact.html`, `index.html`, `product-details.html`, `products.html`, `wishlist.html` |
| `public/css` | `admin.css`, `style.css` |
| `public/js` | `admin.js`, `calculator.js`, `enquiries.js`, `main.js`, `product-details.js`, `products.js` |
| `routes` | `admin.js`, `enquiries.js` |
| `tests` | `api.test.js` |

## New files

| Folder | Files |
| --- | --- |
| Project root | `CHANGES.md` |
| `database` | `migrate.js`, `upgrade.sql` |
| `public/admin` | `customers.html` |
| `public` | `before-after.html`, `brochure.html`, `care.html`, `dashboard.html`, `login.html`, `moodboard.html`, `quiz.html`, `sample.html`, `signup.html`, `visualizer.html` |
| `public/css` | `calculator.css`, `customer.css`, `material-guides.css`, `studio.css` |
| `public/fonts` | `Cormorant-Garamond-LICENSE.txt`, `Poppins-LICENSE.txt`, `cormorant-garamond-latin-wght-italic.woff2`, `cormorant-garamond-latin-wght-normal.woff2`, `poppins-latin-400-normal.woff2`, `poppins-latin-500-normal.woff2`, `poppins-latin-600-normal.woff2` |
| `public/icons` | `bell.svg`, `book-open.svg`, `chevron-down.svg`, `grid-2x2.svg`, `images.svg`, `layers.svg`, `panels-top-left.svg`, `ruler.svg`, `sparkles.svg`, `user-round.svg` |
| `public/images/rooms` | `bathroom.webp`, `bedroom.webp`, `kitchen.webp`, `living.webp`, `wall.webp` |
| `public/js` | `admin-crm.js`, `admin-quotation.js`, `brochure.js`, `care.js`, `customer-common.js`, `customer-dashboard.js`, `customer-login.js`, `customer-request.js`, `customer-settings.js`, `moodboard.js`, `quiz.js`, `rooms.js`, `stone-math.js`, `studio.js` |
| `routes` | `auth.js`, `crm.js`, `customer.js`, `projects.js` |
| `services` | `common.js`, `google.js`, `mail.js` |
| `tests` | `admin-ui.test.js`, `planning.test.js`, `upgrade.test.js` |

See README.md for the tested upgrade procedure, verification results and provider configuration.
