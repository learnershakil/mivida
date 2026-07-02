-- Contact "source": where you met / got the details (free-text), mirrors the device `contacts.source`
-- column 1:1 so the sync mapper carries it through. Additive + nullable — safe/reversible.
ALTER TABLE "Contact" ADD COLUMN "source" TEXT;
