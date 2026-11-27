-- Extend notification settings with deadline reminder choices and an optional daily schedule digest.
UPDATE site_settings
SET value = json_set(
  CASE WHEN json_valid(value) THEN value ELSE '{}' END,
  '$.deadline_reminders.tasks', json('[4320,1440,180,30]'),
  '$.deadline_reminders.submissions', json('[10080,4320,1440,180,30]'),
  '$.daily_schedule', json('{"enabled":false,"time":"08:00"}')
)
WHERE key = 'notification_settings';
