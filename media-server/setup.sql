-- MySQL Database Setup for Media Storage Catalog
CREATE DATABASE IF NOT EXISTS dcel_media;
USE dcel_media;

CREATE TABLE IF NOT EXISTS media_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    site_id VARCHAR(255) NOT NULL,
    site_name VARCHAR(255) NOT NULL,
    asset_id VARCHAR(255) NOT NULL,
    asset_name VARCHAR(255) NOT NULL,
    log_date DATE NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type ENUM('image', 'video') NOT NULL,
    uploaded_by VARCHAR(255) NOT NULL,
    uploaded_by_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (site_id),
    INDEX (asset_id),
    INDEX (log_date)
);
