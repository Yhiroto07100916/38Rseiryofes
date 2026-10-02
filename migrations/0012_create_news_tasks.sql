CREATE TABLE IF NOT EXISTS news_tasks (
  news_id TEXT NOT NULL,
  task_id TEXT NOT NULL,

  PRIMARY KEY (news_id, task_id),

  FOREIGN KEY (news_id)
    REFERENCES news(id)
    ON DELETE CASCADE,

  FOREIGN KEY (task_id)
    REFERENCES tasks(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_news_tasks_news_id
  ON news_tasks(news_id);

CREATE INDEX IF NOT EXISTS idx_news_tasks_task_id
  ON news_tasks(task_id);
