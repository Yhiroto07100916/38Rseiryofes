ALTER TABLE push_notification_deliveries
ADD COLUMN recipient_user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

UPDATE push_notification_deliveries
SET recipient_user_id = (
  SELECT user_id
  FROM push_subscriptions
  WHERE push_subscriptions.id = push_notification_deliveries.subscription_id
)
WHERE recipient_user_id IS NULL;
