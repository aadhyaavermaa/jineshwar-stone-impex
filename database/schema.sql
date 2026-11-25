PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY, product_code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 category TEXT NOT NULL, description TEXT NOT NULL, colour TEXT NOT NULL, finish TEXT NOT NULL,
 origin TEXT NOT NULL, dimensions TEXT NOT NULL, applications TEXT NOT NULL, image_url TEXT NOT NULL,
 availability TEXT NOT NULL CHECK(availability IN ('Available','Made to order','On request')),
 is_featured INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS enquiries (
 id INTEGER PRIMARY KEY, reference_number TEXT NOT NULL UNIQUE, tracking_token_hash TEXT NOT NULL,
 product_id INTEGER REFERENCES products(id), customer_name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL,
 enquiry_type TEXT NOT NULL CHECK(enquiry_type IN ('quotation','consultancy','contact')),
 quantity REAL, quantity_unit TEXT, project_type TEXT, delivery_location TEXT, budget TEXT,
 preferred_date TEXT, required_service TEXT, preferred_material TEXT, message TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'Submitted' CHECK(status IN ('Submitted','Under Review','Quotation Prepared','Completed')),
 created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admins (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
