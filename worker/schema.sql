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
