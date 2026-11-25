-- Migrate the original three-table catalogue inside one transaction.
-- migrate.js takes the backup and checks row counts and foreign keys before commit.

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  profile_picture_url TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  CHECK(password_hash IS NOT NULL OR google_sub IS NOT NULL)
);
CREATE TABLE enquiries_v2 (
 id INTEGER PRIMARY KEY, reference_number TEXT NOT NULL UNIQUE, tracking_token_hash TEXT NOT NULL,
 product_id INTEGER REFERENCES products(id), customer_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
 enquiry_type TEXT NOT NULL CHECK(enquiry_type IN ('quotation','consultancy','contact','sample_request')),
 quantity REAL, quantity_unit TEXT, project_type TEXT, delivery_location TEXT, budget TEXT,
 preferred_date TEXT, required_service TEXT, preferred_material TEXT, message TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'Submitted' CHECK(status IN ('Submitted','Under Review','Quotation Prepared','Completed','Accepted','Declined','Revision Requested','Approved','Dispatched')),
 created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
 user_id INTEGER REFERENCES users(id),city TEXT,postal_code TEXT,application TEXT,admin_response TEXT NOT NULL DEFAULT ''
);
INSERT INTO enquiries_v2(id,reference_number,tracking_token_hash,product_id,customer_name,email,phone,enquiry_type,quantity,quantity_unit,project_type,delivery_location,budget,preferred_date,required_service,preferred_material,message,status,created_at,updated_at)
 SELECT id,reference_number,tracking_token_hash,product_id,customer_name,email,phone,enquiry_type,quantity,quantity_unit,project_type,delivery_location,budget,preferred_date,required_service,preferred_material,message,status,created_at,updated_at FROM enquiries;
DROP TABLE enquiries;
ALTER TABLE enquiries_v2 RENAME TO enquiries;
CREATE INDEX idx_enquiry_owner ON enquiries(user_id,id);

CREATE TABLE wishlists (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id,product_id)
);

CREATE TABLE saved_projects (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER REFERENCES products(id),
  project_name TEXT NOT NULL,
  calculation_type TEXT NOT NULL,
  inputs TEXT NOT NULL,
  estimated_quantity REAL NOT NULL,
  estimated_cost REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_project_owner ON saved_projects(user_id,id);

CREATE TABLE enquiry_messages (
  id INTEGER PRIMARY KEY,
  enquiry_id INTEGER NOT NULL REFERENCES enquiries(id),
  sender_type TEXT NOT NULL CHECK(sender_type IN ('customer','admin')),
  sender_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_thread ON enquiry_messages(enquiry_id,id);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  enquiry_id INTEGER NOT NULL REFERENCES enquiries(id),
  notification_type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_notification_owner ON notifications(user_id,id);

CREATE TABLE quotations (
  id INTEGER PRIMARY KEY,
  enquiry_id INTEGER NOT NULL REFERENCES enquiries(id),
  version INTEGER NOT NULL,
  reference_number TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  quantity REAL NOT NULL,
  quantity_unit TEXT NOT NULL,
  rate REAL NOT NULL,
  subtotal REAL NOT NULL,
  transport REAL NOT NULL,
  additional REAL NOT NULL,
  tax_percent REAL NOT NULL,
  tax_amount REAL NOT NULL,
  total REAL NOT NULL,
  valid_until TEXT NOT NULL,
  terms TEXT NOT NULL,
  admin_response TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT 'Pending',
  revision_reason TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  decided_at TEXT,
  UNIQUE(enquiry_id,version)
);
