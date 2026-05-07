<?php
header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

// Load .env
$env = parse_ini_file('.env');
$host = $env['DB_HOST'];
$db   = $env['DB_NAME'];
$user = $env['DB_USER'];
$pass = $env['DB_PASS'];
$baseUrl = $env['BASE_URL'];

// Database Connection
try {
    $pdo = new PDO("mysql:host=$host;dbname=$db", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

$siteId = $_GET['site_id'] ?? '';
$assetId = $_GET['asset_id'] ?? '';
$logDate = $_GET['log_date'] ?? '';

if (!$siteId || !$assetId || !$logDate) {
    echo json_encode(['error' => 'Missing parameters']);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT * FROM media_logs WHERE site_id = ? AND asset_id = ? AND log_date = ? ORDER BY created_at DESC");
    $stmt->execute([$siteId, $assetId, $logDate]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Append base URL to file path if needed
    foreach ($results as &$row) {
        $row['url'] = $baseUrl . '/' . $row['file_path'];
    }
    
    echo json_encode($results);
} catch (PDOException $e) {
    echo json_encode(['error' => 'Query failed: ' . $e->getMessage()]);
}
?>
