-- Migration: add action scoping to email_verifications and create used_action_tokens table
-- Addresses security findings from PR #353:
--   1. OTPs must be scoped to the action they were issued for.
--   2. Action tokens must be single-use (JTI stored after first use).

-- 1. Add the `action` column to email_verifications.
--    NULL = general-purpose OTP (e.g. email verification at signup).
--    Non-null = privileged-action OTP scoped to a specific ActionType.
ALTER TABLE email_verifications
  ADD COLUMN IF NOT EXISTS action TEXT;

-- Composite index to speed up the scoped OTP lookup in action-otp/verify.
CREATE INDEX IF NOT EXISTS ev_user_action_idx
  ON email_verifications (user_id, action);

-- 2. Create the used_action_tokens table for single-use JTI enforcement.
CREATE TABLE IF NOT EXISTS used_action_tokens (
  jti        TEXT        NOT NULL PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS uat_expires_at_idx
  ON used_action_tokens (expires_at);
