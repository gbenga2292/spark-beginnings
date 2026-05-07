<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

$env_file = __DIR__ . '/.env';
if (!file_exists($env_file)) { echo json_encode(['error' => 'No .env']); exit; }
$env = parse_ini_file($env_file);

try {
    $pdo = new PDO(
        "mysql:host={$env['DB_HOST']};dbname={$env['DB_NAME']};charset=utf8mb4",
        $env['DB_USER'], $env['DB_PASS'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
} catch (PDOException $e) { echo json_encode(['error' => $e->getMessage()]); exit; }

$site_id    = trim($_GET['site_id'] ?? '');
$journal_id = trim($_GET['journal_id'] ?? ''); 
$asset_id   = trim($_GET['asset_id'] ?? 'JOURNAL');
$log_date   = trim($_GET['log_date'] ?? '');

$results = [];

try {
    $column_check = $pdo->query("SHOW COLUMNS FROM site_media LIKE 'journal_id'")->fetch();

    if ($column_check && $journal_id) {
        $stmt = $pdo->prepare("SELECT id, url, file_name, file_type, uploaded_by_name FROM site_media WHERE journal_id = ? ORDER BY created_at ASC");
        $stmt->execute([$journal_id]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    if (empty($results) && $site_id && $log_date) {
        // Fallback to site/date
        $query = "SELECT id, url, file_name, file_type, uploaded_by_name FROM site_media WHERE site_id = ? AND asset_id = ? AND log_date = ?";
        if ($column_check) {
            $query .= " AND (journal_id IS NULL OR journal_id = '')";
        }
        $query .= " ORDER BY created_at ASC";
        
        $stmt = $pdo->prepare($query);
        $stmt->execute([$site_id, $asset_id, $log_date]);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
    
    echo json_encode($results);
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
