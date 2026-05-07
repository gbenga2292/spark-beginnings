<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$env_file = __DIR__ . '/.env';
if (!file_exists($env_file)) {
    http_response_code(500);
    echo json_encode(['error' => '.env file not found']); exit;
}
$env = parse_ini_file($env_file);
$base_url = rtrim($env['BASE_URL'], '/');
$upload_dir = rtrim($env['UPLOAD_DIR'], '/');

try {
    $pdo = new PDO(
        "mysql:host={$env['DB_HOST']};dbname={$env['DB_NAME']};charset=utf8mb4",
        $env['DB_USER'], $env['DB_PASS'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB connection failed: ' . $e->getMessage()]); exit;
}

$site_id    = trim($_POST['site_id'] ?? '');
$journal_id = trim($_POST['journal_id'] ?? ''); 
$site_name  = trim($_POST['site_name'] ?? '');
$asset_id   = trim($_POST['asset_id'] ?? 'JOURNAL');
$log_date   = trim($_POST['log_date'] ?? date('Y-m-d'));
$user_id    = trim($_POST['uploaded_by'] ?? '');
$user_name  = trim($_POST['uploaded_by_name'] ?? '');

if (!$site_id || !isset($_FILES['media'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing site_id or file']);
    exit;
}

$file = $_FILES['media'];
$mime = mime_content_type($file['tmp_name']);
$file_type = (strpos($mime, 'video/') === 0) ? 'video' : 'image';

$ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
$filename = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($file['name'], PATHINFO_FILENAME)) . '_' . time() . '.' . $ext;

$dir = $upload_dir . '/' . $site_id . '/' . $log_date;
if (!is_dir($dir)) mkdir($dir, 0755, true);

$dest = $dir . '/' . $filename;
if (!move_uploaded_file($file['tmp_name'], $dest)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file to ' . $dest]); exit;
}

$url = $base_url . '/' . $site_id . '/' . $log_date . '/' . $filename;

try {
    // Check if journal_id column exists
    $column_check = $pdo->query("SHOW COLUMNS FROM site_media LIKE 'journal_id'")->fetch();
    
    if ($column_check) {
        $stmt = $pdo->prepare("INSERT INTO site_media
            (site_id, journal_id, site_name, asset_id, asset_name, log_date, file_name, file_type, file_path, url, uploaded_by, uploaded_by_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$site_id, $journal_id, $site_name, $asset_id, 'Daily Journal', $log_date, $filename, $file_type, $dest, $url, $user_id, $user_name]);
    } else {
        // Fallback if column is missing: save without journal_id
        $stmt = $pdo->prepare("INSERT INTO site_media
            (site_id, site_name, asset_id, asset_name, log_date, file_name, file_type, file_path, url, uploaded_by, uploaded_by_name)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$site_id, $site_name, $asset_id, 'Daily Journal', $log_date, $filename, $file_type, $dest, $url, $user_id, $user_name]);
    }
    
    echo json_encode(['id' => $pdo->lastInsertId(), 'url' => $url, 'file_type' => $file_type, 'warning' => $column_check ? null : 'journal_id column missing']);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
}
