<?php
/**
 * upload-signature.php
 * Handles user signature image uploads for the DCEL app.
 *
 * Deploy to: https://dewaterconstruct.com/dcel-media/upload-signature.php
 *
 * Expected POST fields:
 *   media          (file)   – the signature image
 *   uploaded_by    (string) – user UUID
 *   uploaded_by_name (string) – display name (for logging)
 *
 * Returns JSON:
 *   { "success": true,  "url": "https://dewaterconstruct.com/dcel-media/signatures/..." }
 *   { "success": false, "error": "reason" }
 */

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow requests from the React app (adjust origin if needed)
$allowed_origins = [
    'https://dewaterconstruct.com',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:4173',
];

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowed_origins, true)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    // Fallback: allow all (remove this line in production if you want strict origin)
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Content-Type: application/json; charset=utf-8');

// Handle preflight (OPTIONS) request from the browser
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Only allow POST ────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed. Use POST.']);
    exit;
}

// ── Validate file presence ─────────────────────────────────────────────────────
if (empty($_FILES['media']) || $_FILES['media']['error'] !== UPLOAD_ERR_OK) {
    $upload_errors = [
        UPLOAD_ERR_INI_SIZE   => 'File exceeds server upload_max_filesize.',
        UPLOAD_ERR_FORM_SIZE  => 'File exceeds form MAX_FILE_SIZE.',
        UPLOAD_ERR_PARTIAL    => 'File was only partially uploaded.',
        UPLOAD_ERR_NO_FILE    => 'No file was uploaded.',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder on server.',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk.',
        UPLOAD_ERR_EXTENSION  => 'A PHP extension blocked the upload.',
    ];
    $code = $_FILES['media']['error'] ?? UPLOAD_ERR_NO_FILE;
    $msg  = $upload_errors[$code] ?? 'Unknown upload error.';
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

$file      = $_FILES['media'];
$tmp_path  = $file['tmp_name'];
$orig_name = $file['name'];
$file_size = $file['size'];

// ── Size guard: 5 MB max ───────────────────────────────────────────────────────
$max_bytes = 5 * 1024 * 1024; // 5 MB
if ($file_size > $max_bytes) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'File too large. Maximum size is 5 MB.']);
    exit;
}

// ── Validate MIME type (images only) ──────────────────────────────────────────
$allowed_mimes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
    'image/svg+xml',
];

$finfo     = new finfo(FILEINFO_MIME_TYPE);
$mime_type = $finfo->file($tmp_path);

if (!in_array($mime_type, $allowed_mimes, true)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => "Invalid file type '$mime_type'. Only PNG, JPEG, GIF, WEBP, and SVG are allowed.",
    ]);
    exit;
}

// ── Derive safe extension from MIME ───────────────────────────────────────────
$mime_to_ext = [
    'image/png'     => 'png',
    'image/jpeg'    => 'jpg',
    'image/jpg'     => 'jpg',
    'image/gif'     => 'gif',
    'image/webp'    => 'webp',
    'image/svg+xml' => 'svg',
];
$ext = $mime_to_ext[$mime_type] ?? 'png';

// ── Build safe filename ────────────────────────────────────────────────────────
// Pattern: signatures/{userId}_{timestamp}_{random}.{ext}
$uploaded_by = preg_replace('/[^a-zA-Z0-9\-_]/', '', $_POST['uploaded_by'] ?? 'user');
$timestamp   = date('YmdHis');
$random      = bin2hex(random_bytes(6)); // 12-char hex
$filename    = "{$uploaded_by}_{$timestamp}_{$random}.{$ext}";

// ── Ensure upload directory exists ────────────────────────────────────────────
// Adjust __DIR__ path if your document root differs
$upload_dir = __DIR__ . '/signatures/';
if (!is_dir($upload_dir)) {
    if (!mkdir($upload_dir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to create upload directory on server.']);
        exit;
    }
}

$dest_path = $upload_dir . $filename;

// ── Move the uploaded file ─────────────────────────────────────────────────────
if (!move_uploaded_file($tmp_path, $dest_path)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Failed to save file on server.']);
    exit;
}

// ── Build the public URL ───────────────────────────────────────────────────────
// Derive base URL from the server variables so this works in any environment
$scheme   = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host     = $_SERVER['HTTP_HOST'] ?? 'dewaterconstruct.com';
// Script lives at /dcel-media/upload-signature.php → base is /dcel-media
$base_dir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$public_url = "{$scheme}://{$host}{$base_dir}/signatures/{$filename}";

// ── Optional: log the upload ───────────────────────────────────────────────────
$log_entry = implode(' | ', [
    date('Y-m-d H:i:s'),
    'SIGNATURE_UPLOAD',
    $uploaded_by,
    $_POST['uploaded_by_name'] ?? 'unknown',
    $filename,
    "{$file_size} bytes",
]) . PHP_EOL;
@file_put_contents(__DIR__ . '/upload_log.txt', $log_entry, FILE_APPEND | LOCK_EX);

// ── Return success ────────────────────────────────────────────────────────────
http_response_code(200);
echo json_encode([
    'success'  => true,
    'url'      => $public_url,
    'filename' => $filename,
]);
