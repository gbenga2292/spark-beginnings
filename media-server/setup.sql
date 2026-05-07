-- Run this in phpMyAdmin > htdavies_dailylogfile database > SQL tab
CREATE TABLE IF NOT EXISTS site_media (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id          VARCHAR(100)  NOT NULL,
  site_name        VARCHAR(255)  NOT NULL,
  asset_id         VARCHAR(100)  NOT NULL DEFAULT 'JOURNAL',
  asset_name       VARCHAR(255)  NOT NULL DEFAULT 'Daily Journal',
  log_date         DATE          NOT NULL,
  file_name        VARCHAR(255)  NOT NULL,
  file_type        ENUM('image','video') NOT NULL,
  file_path        VARCHAR(500)  NOT NULL,
  url              VARCHAR(700)  NOT NULL,
  uploaded_by      VARCHAR(100)  DEFAULT '',
  uploaded_by_name VARCHAR(255)  DEFAULT '',
  created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_site_date (site_id, log_date),
  INDEX idx_asset     (asset_id, log_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
