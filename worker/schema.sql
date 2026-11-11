-- Best result per user and challenge. user_code is a derived code, never an account name or e-mail.
CREATE TABLE IF NOT EXISTS scores (
  user_code  TEXT    NOT NULL,
  challenge  TEXT    NOT NULL,
  keys       INTEGER NOT NULL,
  ms         INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_code, challenge)
);
CREATE INDEX IF NOT EXISTS scores_board ON scores (challenge, keys, ms);

-- Anonymous usage counters (see worker/src/analytics.ts). Nothing here identifies a person.
-- Page views per day and page.
CREATE TABLE IF NOT EXISTS hits (
  day   TEXT    NOT NULL,
  path  TEXT    NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, path)
);
-- One row per visitor per day: a hash that includes the day, so it cannot be followed to another day. Dropped after 90 days.
CREATE TABLE IF NOT EXISTS visitors (
  day     TEXT NOT NULL,
  visitor TEXT NOT NULL,
  PRIMARY KEY (day, visitor)
);
-- Challenges started and finished on the site per day.
CREATE TABLE IF NOT EXISTS plays (
  day       TEXT    NOT NULL,
  challenge TEXT    NOT NULL,
  started   INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, challenge)
);
