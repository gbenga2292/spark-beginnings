<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
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

// Authenticate via API Key
$provided_key = $_SERVER['HTTP_X_API_KEY'] ?? '';
$expected_key = $env['API_SECRET_KEY'] ?? '';

if (!$expected_key || $provided_key !== $expected_key) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']); exit;
}

$user_id = trim($_POST['uploaded_by'] ?? 'unknown');

if (!isset($_FILES['media'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing file']);
    exit;
}

$file = $_FILES['media'];
$mime = mime_content_type($file['tmp_name']);
$file_type = (strpos($mime, 'video/') === 0) ? 'video' : 'image';

$ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if (!$ext) {
    $ext = 'bin';
}
$filename = preg_replace('/[^a-zA-Z0-9_-]/', '_', pathinfo($file['name'], PATHINFO_FILENAME)) . '_' . time() . '.' . $ext;

$dir = $upload_dir . '/tasks/' . date('Y-m-d');
if (!is_dir($dir)) mkdir($dir, 0755, true);

$dest = $dir . '/' . $filename;
if (!move_uploaded_file($file['tmp_name'], $dest)) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to save file to ' . $dest]); exit;
}

$url = $base_url . '/tasks/' . date('Y-m-d') . '/' . $filename;

echo json_encode(['url' => $url, 'file_type' => $file_type]);
