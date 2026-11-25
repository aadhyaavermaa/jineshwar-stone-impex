-- SQLite's existing timestamp defaults generate UTC. Normalize inserted values
-- and backfill timestamp columns once, preserving date-only business fields.

UPDATE products SET created_at = COALESCE(datetime(created_at, '+330 minutes') || '+05:30', created_at), updated_at = COALESCE(datetime(updated_at, '+330 minutes') || '+05:30', updated_at);
UPDATE enquiries SET created_at = COALESCE(datetime(created_at, '+330 minutes') || '+05:30', created_at), updated_at = COALESCE(datetime(updated_at, '+330 minutes') || '+05:30', updated_at);
UPDATE admins SET created_at = COALESCE(datetime(created_at, '+330 minutes') || '+05:30', created_at);
UPDATE users SET created_at = COALESCE(datetime(created_at, '+330 minutes') || '+05:30', created_at), updated_at = COALESCE(datetime(updated_at, '+330 minutes') || '+05:30', updated_at);
UPDATE wishlists SET created_at = COALESCE(datetime(created_at, '+330 minutes') || '+05:30', created_at);
UPDATE saved_projects SET created_at = COALESCE(datetime(created_at, '+330 minutes') || '+05:30', created_at), updated_at = COALESCE(datetime(updated_at, '+330 minutes') || '+05:30', updated_at);
UPDATE enquiry_messages SET created_at = COALESCE(datetime(created_at, '+330 minutes') || '+05:30', created_at);
UPDATE notifications SET created_at = COALESCE(datetime(created_at, '+330 minutes') || '+05:30', created_at);
UPDATE quotations SET created_at = COALESCE(datetime(created_at, '+330 minutes') || '+05:30', created_at), decided_at = COALESCE(datetime(decided_at, '+330 minutes') || '+05:30', decided_at);

CREATE TRIGGER products_insert_ist AFTER INSERT ON products
BEGIN
  UPDATE products SET created_at = COALESCE(datetime(NEW.created_at, '+330 minutes') || '+05:30', NEW.created_at), updated_at = COALESCE(datetime(NEW.updated_at, '+330 minutes') || '+05:30', NEW.updated_at) WHERE id = NEW.id;
END;

CREATE TRIGGER enquiries_insert_ist AFTER INSERT ON enquiries
BEGIN
  UPDATE enquiries SET created_at = COALESCE(datetime(NEW.created_at, '+330 minutes') || '+05:30', NEW.created_at), updated_at = COALESCE(datetime(NEW.updated_at, '+330 minutes') || '+05:30', NEW.updated_at) WHERE id = NEW.id;
END;

CREATE TRIGGER admins_insert_ist AFTER INSERT ON admins
BEGIN
  UPDATE admins SET created_at = COALESCE(datetime(NEW.created_at, '+330 minutes') || '+05:30', NEW.created_at) WHERE id = NEW.id;
END;

CREATE TRIGGER users_insert_ist AFTER INSERT ON users
BEGIN
  UPDATE users SET created_at = COALESCE(datetime(NEW.created_at, '+330 minutes') || '+05:30', NEW.created_at), updated_at = COALESCE(datetime(NEW.updated_at, '+330 minutes') || '+05:30', NEW.updated_at) WHERE id = NEW.id;
END;

CREATE TRIGGER wishlists_insert_ist AFTER INSERT ON wishlists
BEGIN
  UPDATE wishlists SET created_at = COALESCE(datetime(NEW.created_at, '+330 minutes') || '+05:30', NEW.created_at) WHERE id = NEW.id;
END;

CREATE TRIGGER saved_projects_insert_ist AFTER INSERT ON saved_projects
BEGIN
  UPDATE saved_projects SET created_at = COALESCE(datetime(NEW.created_at, '+330 minutes') || '+05:30', NEW.created_at), updated_at = COALESCE(datetime(NEW.updated_at, '+330 minutes') || '+05:30', NEW.updated_at) WHERE id = NEW.id;
END;

CREATE TRIGGER enquiry_messages_insert_ist AFTER INSERT ON enquiry_messages
BEGIN
  UPDATE enquiry_messages SET created_at = COALESCE(datetime(NEW.created_at, '+330 minutes') || '+05:30', NEW.created_at) WHERE id = NEW.id;
END;

CREATE TRIGGER notifications_insert_ist AFTER INSERT ON notifications
BEGIN
  UPDATE notifications SET created_at = COALESCE(datetime(NEW.created_at, '+330 minutes') || '+05:30', NEW.created_at) WHERE id = NEW.id;
END;

CREATE TRIGGER quotations_insert_ist AFTER INSERT ON quotations
BEGIN
  UPDATE quotations SET created_at = COALESCE(datetime(NEW.created_at, '+330 minutes') || '+05:30', NEW.created_at) WHERE id = NEW.id;
END;
