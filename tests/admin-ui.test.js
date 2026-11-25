// Pure presentation rules can run in Node's built-in test runner without a browser
// dependency. The full staff workflow is also exercised against the HTTP API.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = (name) => fs.readFileSync(path.join(__dirname, "../public/js", name), "utf8");

function loadDesk() {
  const context = vm.createContext({
    Intl,
    h: (value) =>
      String(value ?? "").replace(
        /[&<>"]/g,
        (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch],
      ),
    rowDate: (value) => String(value ?? "").slice(0, 16),
  });
  vm.runInContext(source("admin-crm.js"), context);
  vm.runInContext(source("admin-quotation.js"), context);
  return context;
}

test("Staff status menu keeps customer decisions and issued quotations intact", () => {
  const { staffAllowedStatuses } = loadDesk();
  const menu = (row) => Array.from(staffAllowedStatuses(row));
  assert.deepEqual(menu({ enquiry_type: "sample_request", status: "Approved" }), [
    "Submitted",
    "Under Review",
    "Approved",
    "Dispatched",
    "Completed",
    "Declined",
  ]);
  assert.deepEqual(
    menu({
      enquiry_type: "quotation",
      status: "Quotation Prepared",
      quotations: [{ decision: "Pending" }],
    }),
    ["Quotation Prepared"],
  );
  assert.deepEqual(
    menu({
      enquiry_type: "quotation",
      status: "Revision Requested",
      quotations: [{ decision: "Revision Requested" }],
    }),
    ["Revision Requested"],
  );
  assert.deepEqual(
    menu({ enquiry_type: "quotation", status: "Accepted", quotations: [{ decision: "Accepted" }] }),
    ["Accepted", "Completed"],
  );
  assert.deepEqual(
    menu({
      enquiry_type: "quotation",
      status: "Completed",
      quotations: [{ decision: "Accepted" }],
    }),
    ["Completed"],
  );
});

test("Staff thread and quote revision history render untrusted text as text", () => {
  const desk = loadDesk();
  const content = '<img src="unknown">';
  const thread = desk.conversationBody([
    { sender_type: "customer", message: content, created_at: "2026-11-24 10:10:00" },
  ]);
  const quote = desk.staffQuoteSnapshot({ terms: content, quantity: 12, total: 420.15 });
  for (const rendered of [thread, quote]) {
    assert.ok(rendered.includes("&lt;img"));
    assert.ok(!rendered.includes("<img"));
  }
  assert.ok(thread.includes("Customer"));
  assert.ok(quote.includes("₹420.15"));
});
