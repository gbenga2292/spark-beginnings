<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$env_file = __DIR__ . '/.env';
if (!file_exists($env_file)) {
    echo json_encode(['error' => '.env not found']); exit;
}
$env = parse_ini_file($env_file);

try {
    $pdo = new PDO(
        "mysql:host={$env['DB_HOST']};dbname={$env['DB_NAME']};charset=utf8mb4",
        $env['DB_USER'], $env['DB_PASS'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB error: ' . $e->getMessage()]); exit;
}

$body = json_decode(file_get_contents('php://input'), true);
$id   = (int)($body['id'] ?? 0);

if (!$id) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing id']); exit;
}

// Get file path before deleting record
$stmt = $pdo->prepare("SELECT file_path FROM site_media WHERE id = ?");
$stmt->execute([$id]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

// Delete physical file
if ($row && file_exists($row['file_path'])) {
    unlink($row['file_path']);
}

// Delete DB record
$pdo->prepare("DELETE FROM site_media WHERE id = ?")->execute([$id]);

echo json_encode(['success' => true]);
