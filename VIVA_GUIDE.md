# Viva guide · Jineshwar Stone Impex

## The 30-second introduction

“I built a stone catalogue that connects planning with the studio’s quotation process. Guests can estimate materials and track an enquiry using two codes. A customer account adds projects, a shared wishlist, itemised quotations and a conversation with the studio. Both dashboards read the same SQLite records through Express. I can trace a customer action from its HTML control to its API endpoint and SQL query.”

Hinglish memory cue: **Browser choice dikhata hai, Express rules check karta hai, SQLite record sambhalta hai.** For a viva answer, name the user action, its HTTP request and the SQL operation that gives the result.

## A practical eight-minute demonstration

Prepare two browser profiles or use an incognito window for the administrator. Role changes regenerate the session, so keeping different cookie jars makes it easy to switch between the customer and studio views.

| Time | Demonstration | What to explain |
| --- | --- | --- |
| 0:00–1:00 | As a guest, filter the catalogue, open two products, save them, compare, then take Find Your Perfect Stone. | Catalogue rows come from SQLite. Filtering, sorting, comparisons and recommendation scoring happen in JavaScript. |
| 1:00–2:00 | Register a synthetic customer. Open saved stones and refresh. In the calculator enter a 12 × 10 ft room, 10% waste, 12 × 12 inch tiles and ₹50 per tile. Save a named project. | The guest wishlist merges. Conversion yields 132 tiles costing ₹6,600. The server independently recalculates the result before saving. |
| 2:00–3:00 | Convert the project to an RFQ and send it. Copy the reference and code or download the receipt. View it in the customer dashboard. | The session supplies the owner ID; the public code is issued once. An estimate becomes a request only when submitted. |
| 3:00–4:00 | In the admin browser, open the request, reply to the thread and prepare a dated itemised quote. Use demonstration amounts. | Messages belong to an enquiry and every quotation is versioned. A notification links the customer to the new activity. |
| 4:00–5:00 | Refresh the customer view, open the notification, reply, then request a revision. Prepare a new version as admin; accept the current version as customer. | The server checks ownership, current revision, validity and decision before writing. |
| 5:00–6:00 | Submit a separate sample request as a guest. Claim it using both credentials from the customer dashboard. Open the claimed request by reference while signed in. | Knowledge of the submission email cannot claim a request. The original credentials still work for signed-out public tracking. |
| 6:00–7:00 | Switch room materials, drag the before/after slider, export a Canvas moodboard, and print a selected-product brochure to PDF. | These design views work in the browser; their illustrations do not establish physical appearance or price. |
| 7:00–8:00 | Edit a DEMO product’s finish as admin, reload its details, restart Node and log back in. | Staff CRUD and customer records persist. The session is held in process memory and expires on restart. |

For a five-minute viva, stop after the quotation decision. Keep the advanced design tools available for follow-up questions. Demonstrate real Google login and mailbox delivery only when your own services are configured.

## Study these files in order

1. **database/schema.sql**, **database/upgrade.sql** and **database/migrate.js** show the original three tables, six added tables, upgraded enquiry columns and versioned migration.
2. **server.js**, **middleware/auth.js** and **services/common.js** set up request parsing, sessions, authorization, CSRF checks, transaction boundaries and public-file serving.
3. **routes/products.js**, **public/js/main.js**, **products.js** and **product-details.js** show a small read-only request from URL parameter to database row and UI.
4. **routes/enquiries.js** creates guest tracking credentials and stores submissions. **routes/customer.js** limits self-service reads and updates to the authenticated owner. **routes/crm.js** handles the connected quotation and messaging workflows.
5. **routes/auth.js**, **services/google.js**, **public/js/customer-common.js** and **customer-settings.js** show local sign-in, nonce verification, sensitive account changes and linking.
6. **public/js/stone-math.js**, **public/js/calculator.js** and **routes/projects.js** demonstrate how shared calculations let the API verify browser results.
7. **public/js/quiz.js**, **care.js**, **rooms.js**, **moodboard.js** and **brochure.js** show the lightweight browser tools. **services/mail.js** is the boundary between SQLite writes and optional delivery.
8. **routes/admin.js**, **public/js/admin.js**, **admin-crm.js** and **admin-quotation.js** connect staff controls to data; the **tests/** folder gives executable examples. Compare SQL output with the browser Network tab.

## Three concepts to explain on the board

**A database relationship.** If product 7 is an architectural table, several RFQs can hold product_id 7. Each RFQ still has its own quantity, delivery city and status. A contact message can leave product_id null. A LEFT JOIN allows the admin to open both kinds of record.

**Two different kinds of persistence.** A guest wishlist belongs to one browser. A signed-in wishlist belongs to an internal user ID in SQLite and can follow the user to another device. A customer request is stored on the server regardless of whether the customer signs in.

**A secret, a reference and a session.** The reference helps identify an enquiry. Guests use a private tracking code to authorize public status lookup. Signed-in customers use the reference and server-side session ownership, or open details in My Requests. An administrator signs in through a separate login route. The signed cookie refers to a server-side session carrying the administrator ID. A customer can track a request without an admin account.

The system architecture, entity relationship, customer enquiry, authentication and product management diagrams are in [README.md](README.md).

## Viva questions and answers

| # | Question | Answer |
| --- | --- | --- |
| 1 | What makes this full stack? | A browser interface sends real HTTP requests to Express. Express reads and writes a persistent relational database. |
| 2 | Why use SQLite for this project? | The data has clear relationships and a modest write workload. SQLite provides SQL, constraints, joins and persistence in one file without operating a separate database service. |
| 3 | Why use an enquiry model? | Quantity, destination, finish and custom work affect a stone quotation. A request lets the studio review those details before giving an official price. |
| 4 | What is an API endpoint? | A method and path with a defined purpose. GET /api/products returns the current active catalogue as JSON. |
| 5 | Why does the frontend use Fetch? | It requests data asynchronously. The page can update the result grid or confirmation area after the server responds. |
| 6 | What does async/await do here? | await pauses that async function until its Promise settles. An error goes into catch, which lets the UI show a readable failure. |
| 7 | How does one details page serve many products? | URLSearchParams reads the id after the question mark. The page fetches that ID, then fills the same layout with the returned row. |
| 8 | How does a search change the results? | An input event runs filter on the fetched array. Lowercasing the search and product text makes includes case-insensitive. |
| 9 | Why are multiple filters combined with AND? | Selecting Marble and Honed means both conditions must hold. Empty filter values impose no condition. |
| 10 | What does a primary key do? | It identifies a row uniquely. products.id is the stable internal identifier used by RFQs. |
| 11 | How does a unique product code differ from an ID? | The code is a human-facing identifier that the admin enters. SQLite enforces uniqueness for the code, while the numeric primary key identifies relationships. |
| 12 | Why make the foreign key nullable? | A consultancy or message may concern a project generally. An RFQ does need an active product, so the quotation validator enforces that rule. |
| 13 | Why use one enquiries table? | All four request types share identity, contact details, status and timestamps. enquiry_type selects additional fields and the correct admin view. |
| 14 | What is a prepared statement? | SQL is written with placeholders. Binding the values separately makes the database treat input as data. |
| 15 | What is CRUD in your implementation? | An admin inserts a product, reads a list or single row, updates specifications and archives the product through DELETE. |
| 16 | Why archive rather than erase the product? | The public list filters is_active. The database retains the ID for historical enquiries and the admin can reactivate it later. |
| 17 | How does the wishlist survive refresh? | For guests, JSON.stringify stores IDs in localStorage and JSON.parse reads them. For customers, the account wishlist comes from SQLite. |
| 18 | What happens if a saved product is archived? | Wishlist and comparison match saved IDs against the active catalogue and prune unavailable IDs when those pages load. |
| 19 | Why limit product comparison to three? | The table stays readable. Before adding an ID, the browser checks whether three selections are already present. Removing a selected product remains possible. |
| 20 | How do units affect the calculator? | Multiply each length by metres per unit before calculating area. For a square-foot rate, divide square metres by 0.3048 squared. Apply the rate to the final area in the matching unit. |
| 21 | Why add wastage before calculating cost? | Material purchased includes the cutting allowance. Required area equals base area times one plus wastage divided by 100. |
| 22 | Why validate twice? | Browser validation gives immediate feedback. Server validation applies the rules to every API caller before it can write a row. |
| 23 | What is the purpose of bcrypt? | Its salted, deliberately expensive password hash supports verification without storing the customer’s or administrator’s original password. |
| 24 | Why use SHA-256 for tracking codes? | The server generates a high-entropy random code. A deterministic hash allows lookup without storing recoverable codes. Human-chosen passwords have different properties and use bcrypt. |
| 25 | How does a session work? | After login, the browser holds a signed session identifier in an HTTP-only cookie. The server stores adminId in the matching session. |
| 26 | Why regenerate the session at login? | An authenticated session should receive a fresh identifier when the user’s privilege changes. |
| 27 | What is middleware? | A function between request arrival and the route handler. It can reject a request or call next to pass control onwards. |
| 28 | How does CSRF protection work here? | An authenticated write must include the current session’s random token in a custom request header. A normal cross-site form cannot supply it. |
| 29 | How does the UI handle dynamic text safely? | Database values inserted in HTML templates are escaped. Other values use textContent or native Option objects. New product image paths are checked by the server. |
| 30 | What does rate limiting do? | It counts attempts per IP within a ten-minute window. Excess login, submission or tracking attempts get HTTP 429 and a retry interval. |
| 31 | What information does tracking reveal? | Guests with a matching reference and code receive the current status. Signed-in customers receive a status and detail link only for requests owned by their session. The public tracker omits names, email, quote details and private discussion. |
| 32 | How is the dashboard chart built? | SQLite groups enquiries by calendar month and counts the rows. JavaScript fills missing months with zero before passing labels and counts to Chart.js. |
| 33 | What is the difference between available and active? | Active controls catalogue visibility. Availability describes whether the studio lists the item as available, made to order or on request. |
| 34 | What does HTTP 409 mean here? | The requested change conflicts with a uniqueness constraint, such as another product already having the same code. |
| 35 | What happens when the server restarts? | SQLite reopens its file and preserves the catalogue, admin account and enquiries. The in-memory session store and rate counters start fresh. |
| 36 | How did you verify persistence? | The integration test writes records, stops the Node process, launches a fresh process pointing at the same temporary database and reads them again. |
| 37 | How does the interface support keyboard users? | Native links, buttons, labelled fields and dialogs support keyboard input. Focus indicators show the active control. The gallery supports arrow keys and Escape. |
| 38 | What does IntersectionObserver do? | It detects a section entering the viewport and applies a short reveal animation. Reduced-motion CSS disables animation when requested. |
| 39 | Is a preferred consultation date a booking? | It records a preference. The studio must confirm the arrangement manually. |
| 40 | Where would you improve this for larger production use? | Add server-side pagination, persistent session storage, backups and retention controls, then measure the database workload before changing the storage engine. |

## When something goes wrong during the demo

| Symptom | What to check |
| --- | --- |
| Node cannot load node:sqlite | Run node -v and use Node 24 or newer. |
| Server asks for a secret | Put a generated SESSION_SECRET of at least 32 characters in .env inside the project folder. |
| Catalogue is empty | Run npm run seed against the same DB_PATH and check that products are active. |
| Login fails after a password change | Check which account and database are in use. The upgrade seed preserves the existing admin hash; a changed .env password cannot reset it. |
| A write fails after the server restarts | Sign in again to obtain the new session and CSRF token. |
| A form appears but data never loads | Open localhost through the running server. Opening an HTML file directly from disk cannot reach the application's APIs. |
| Tracking says no match | Guests can copy the reference and code individually from the same confirmation. Signed-in customers can open owned requests in My Requests. The administrator can follow up through the contact details stored with the request. |

## Identity, customer records and planning · questions 41–78

| # | Question | Answer |
| --- | --- | --- |
| 41 | How are customers and administrators separated? | They authenticate through different routes and tables. Customer handlers require a customer session; staff handlers require an administrator session. Hiding links alone would offer no protection. |
| 42 | What happens after Google’s account chooser returns? | The browser sends the signed ID credential and CSRF proof to Express. The server verifies the credential, looks up Google’s subject, and issues an ordinary local customer session. |
| 43 | Which Google claims are checked? | The official library verifies the signature, issuer, audience and expiry. The app also checks the verified-email flag, subject and this browser session’s nonce. |
| 44 | What is a nonce? | A fresh, short-lived challenge from the server. Google includes it in the credential signed for this login. A token with another browser’s nonce fails verification. |
| 45 | Why use Google sub? | It identifies the Google account consistently even if profile information changes. A local user ID still owns enquiries, projects and wishes. |
| 46 | Why not merge accounts that share an email? | A matching address does not prove an intention to connect sign-in methods. The existing owner logs in, recently reauthenticates, chooses Google and explicitly confirms the link. |
| 47 | How does a Google-only user set a password? | They verify their connected Google identity recently. The server accepts a new password for the account that currently lacks one and stores its bcrypt hash. |
| 48 | What prevents locking someone out on unlink? | The server permits unlinking only when the customer has another sign-in method, such as a stored local password, and has recently proved identity. |
| 49 | Why is the Google client ID visible? | It identifies the intended web application. The app can validate Google’s signed ID tokens using public keys. No OAuth client secret or inbox permission is used for this popup flow. |
| 50 | How do you handle missing Google configuration? | The app omits the Google sign-in control and keeps password-based signup/login available. |
| 51 | How do customer enquiries get their owner? | Express reads the internal user ID from the server session. A guest submission leaves the owner field null. A client-supplied account ID cannot assign ownership. |
| 52 | How is a pre-existing enquiry claimed? | The customer supplies its reference and private code. The server verifies the digest and assigns its owner only while the row is unclaimed. Knowing an email address is insufficient. |
| 53 | What happens to a guest code after a claim? | It can still be used for public status tracking while signed out. A second claim fails because ownership is already assigned. |
| 54 | What is an ownership check in SQL? | For a project, the query includes both its ID and the session’s user ID. A guessed project ID owned by someone else produces no accessible record. |
| 55 | How is a database wishlist merged? | Sign-in supplies guest product IDs. The server adds valid active products for that owner and ignores duplicates under the unique user/product pair constraint. |
| 56 | What happens when two related writes must succeed together? | A transaction commits them as one unit. If a step fails, rollback restores the previous state. This applies to migrations and quote, message and notification updates that must stay consistent. |
| 57 | What problem does the migration solve? | The old enquiries table restricts request types and statuses using CHECK constraints. The upgrade builds an expanded table, copies original IDs and data, checks integrity, and commits the new version. |
| 58 | How can an upgrade run twice? | SQLite's user_version identifies the completed schema. Running the migration again recognises that version and skips the structural change. |
| 59 | How is a database backup created? | The backup command uses VACUUM INTO to create a consistent, separate SQLite file. An additional offline copy of the old folder and configuration enables rollback. |
| 60 | How do notifications stay read after refreshing? | Each notification row records the user and read state. A protected endpoint updates one owned row or all of that user’s rows. |
| 61 | How can messages work without WebSockets? | A POST inserts the message, and GET retrieves the ordered thread. Reading the enquiry again fetches current messages. The app does not need a persistent socket connection. |
| 62 | What distinguishes a quotation from an estimate? | A planning estimate uses customer-entered dimensions, assumed waste and an optional rate. An official quotation is prepared by the studio with commercial terms, line values and validity. |
| 63 | Why store quotation versions separately? | A revision can alter the rates or terms. Versioned records preserve the earlier offer and decision while allowing the customer to act on the current version. |
| 64 | How should the server handle a repeated quote decision? | It checks owner, version, expiry and current decision before changing state, so repeated or stale actions cannot replace the valid decision. |
| 65 | How do quote totals differ from tile counts? | Money is rounded to currency precision. Pieces must be purchased in whole units, so the calculator rounds the required tile or slab count up. |
| 66 | Why recalculate saved projects in Express? | A browser result can be stale or altered. The server uses the same unit-conversion formulas and validates the saved inputs before recording totals. |
| 67 | What is the purpose of saved project JSON? | Surface, slab and tile modes have different inputs. A validated JSON field keeps these together while user and product IDs remain relational columns. |
| 68 | How can a paid material have an empty estimated cost? | A user may leave the optional rate empty. The application calculates the quantity and leaves cost unknown instead of assigning a made-up price. |
| 69 | How does the quiz produce recommendations? | An application filter narrows eligible active rows. Matching colour and finish each add two points. Products are sorted by score with an alphabetical tie-break, and up to three are shown. |
| 70 | What do budget, durability and care choices do in the quiz? | They generate questions tailored to the brief. The available catalogue has no verified price or wear ratings, so those preferences cannot reliably rank physical performance. |
| 71 | How does the stone care guide work? | A material selection indexes a small local object. Each entry supplies cleaning and precaution guidance, displayed in keyboard-operable native details elements. An unrecognised material falls back to identification advice. |
| 72 | How do the visualizer and before/after slider differ? | The visualizer applies a selected texture inside a fixed room’s surface polygon and preserves the room’s lighting. The slider reveals more of one aligned view or the other by changing a percentage. |
| 73 | What does Canvas do for a moodboard? | It draws positioned material swatches and notes in layer order. Each edit updates the layer state, redraws the image, and makes the current arrangement available for local export. |
| 74 | Why use local images for exportable previews? | Canvas can become unreadable when it draws remote pixels lacking permission for cross-origin use. Keeping selected preview images on the same origin allows a reliable export. |
| 75 | How does a customised brochure become a PDF? | The browser gathers the selected active products and their specifications into a print stylesheet layout. The user selects Save as PDF in their browser’s print dialog. |
| 76 | Who actually delivers a notification email? | The Express server uses Nodemailer to submit to the configured SMTP server. That provider handles onward mail delivery; successful SMTP submission does not guarantee inbox placement. |
| 77 | What happens if SMTP is offline? | The database write happens first. The site can retain the enquiry and show its receipt even when the optional email attempt fails. A manual mailto action opens the user's email application separately. |
| 78 | What is the difference between testing Google verification and testing Google sign-in live? | Automated tests can exercise local rejection and account-handling paths. A real end-to-end sign-in requires your Google Web client ID, a permitted test account, connectivity and the live account chooser. |

**Hinglish cues**

- **Google pehchaan verify karta hai, Express session chalata hai.** Google proves the identity at sign-in. The local session authorises later actions.
- **Reference se record milta hai, code se guest ka access milta hai.** The public identifier and the private tracking proof serve different purposes.
- **Estimate customer ki planning hai, quotation studio ka offer hai.** Estimates remain editable inputs. Quotations have terms, validity, a version and a decision.
- **Pehle database save, phir email.** The primary customer record survives an optional mail-delivery failure.
- **SQLite mein owner check, browser mein design preview.** Keep private shared data on the server. Keep reversible visual exploration lightweight on the device.
