<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// Load .env
$env = parse_ini_file('.env');
$host = $env['DB_HOST'];
$db   = $env['DB_NAME'];
$user = $env['DB_USER'];
$pass = $env['DB_PASS'];
$uploadDir = $env['UPLOAD_DIR'];

// Database Connection
try {
    $pdo = new PDO("mysql:host=$host;dbname=$db", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $siteId = $_POST['site_id'] ?? '';
    $siteName = $_POST['site_name'] ?? 'UnknownSite';
    $assetId = $_POST['asset_id'] ?? '';
    $assetName = $_POST['asset_name'] ?? 'UnknownAsset';
    $logDate = $_POST['log_date'] ?? date('Y-m-d');
    $uploadedBy = $_POST['uploaded_by'] ?? '';
    $uploadedByName = $_POST['uploaded_by_name'] ?? '';
    
    if (isset($_FILES['media'])) {
        $file = $_FILES['media'];
        $fileName = $file['name'];
        $fileTmpName = $file['tmp_name'];
        $fileType = strpos($file['type'], 'video') !== false ? 'video' : 'image';
        
        // Clean site name for folder
        $cleanSiteName = preg_replace('/[^a-zA-Z0-9]/', '_', $siteName);
        $subDir = $fileType === 'video' ? 'videos' : 'images';
        $targetDir = "$uploadDir/$cleanSiteName/$subDir/";
        
        if (!is_dir($targetDir)) {
            mkdir($targetDir, 0777, true);
        }
        
        // New file name: date_time_uploader_originalName
        $timestamp = date('Ymd_His');
        $newFileName = "{$timestamp}_{$uploadedBy}_" . preg_replace('/[^a-zA-Z0-9.]/', '_', $fileName);
        $targetFile = $targetDir . $newFileName;
        
        if (move_uploaded_file($fileTmpName, $targetFile)) {
            // Save to database
            $stmt = $pdo->prepare("INSERT INTO media_logs 
                (site_id, site_name, asset_id, asset_name, log_date, file_name, file_path, file_type, uploaded_by, uploaded_by_name) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $siteId, $siteName, $assetId, $assetName, $logDate, $newFileName, $targetFile, $fileType, $uploadedBy, $uploadedByName
            ]);
            
            echo json_encode([
                'success' => true, 
                'message' => 'File uploaded successfully',
                'file' => $targetFile
            ]);
        } else {
            echo json_encode(['error' => 'Failed to move uploaded file']);
        }
    } else {
        echo json_encode(['error' => 'No file uploaded']);
    }
}
?>
