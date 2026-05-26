-- +goose Up
CREATE TABLE users (
  user_id Utf8 NOT NULL,
  display_name Utf8,
  avatar_url Utf8,
  created_at Timestamp,
  updated_at Timestamp,
  last_login_at Timestamp,
  PRIMARY KEY (user_id)
);

CREATE TABLE telegram_accounts (
  telegram_sub Utf8 NOT NULL,
  user_id Utf8,
  telegram_user_id Utf8,
  username Utf8,
  name Utf8,
  picture_url Utf8,
  linked_at Timestamp,
  updated_at Timestamp,
  PRIMARY KEY (telegram_sub)
);

CREATE TABLE sessions (
  session_id_hash Utf8 NOT NULL,
  user_id Utf8,
  created_at Timestamp,
  last_seen_at Timestamp,
  expires_at Timestamp,
  revoked_at Timestamp,
  PRIMARY KEY (session_id_hash)
)
WITH (
  TTL = Interval("PT0S") ON expires_at
);

-- +goose Down
DROP TABLE sessions;
DROP TABLE telegram_accounts;
DROP TABLE users;
