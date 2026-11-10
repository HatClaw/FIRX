<?php
declare(strict_types=1);

$configPath = dirname(__DIR__, 3) . '/marketing-config.php';
$config = is_file($configPath) ? require $configPath : null;
$allowedOrigins = is_array($config) && is_array($config['allowed_origins'] ?? null) ? $config['allowed_origins'] : ['https://canal360.run.place'];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Headers: Authorization, Content-Type');
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
}
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');

function marketing_reply(int $status, array $payload): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
function marketing_http(string $url, string $method, array $headers, ?string $body = null): array {
    if (!function_exists('curl_init')) marketing_reply(503, ['error' => 'A hospedagem não tem cURL habilitado para validar a sessão.']);
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 35,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    $content = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($content === false) marketing_reply(502, ['error' => 'Não foi possível validar o acesso ao servidor de dados.', 'detail' => $error]);
    return [$status, (string)$content];
}
function marketing_config(): array {
    global $config;
    if (!is_array($config) || !filter_var($config['supabase_url'] ?? '', FILTER_VALIDATE_URL) || !str_ends_with((string)$config['supabase_url'], '.supabase.co') || strlen((string)($config['supabase_anon_key'] ?? '')) < 32 || !str_starts_with((string)($config['upload_dir'] ?? ''), '/')) {
        marketing_reply(503, ['error' => 'Configure a API de arquivos em /domains/canal360.run.place/marketing-config.php e crie a pasta privada /domains/canal360.run.place/marketing-uploads.']);
    }
    return $config;
}
function marketing_auth(array $config): array {
    $authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer\s+([A-Za-z0-9._~-]+)$/i', $authorization, $match)) marketing_reply(401, ['error' => 'Sessão ausente ou expirada. Entre novamente.']);
    $jwt = $match[1];
    $base = rtrim((string)$config['supabase_url'], '/');
    $headers = ['apikey: ' . $config['supabase_anon_key'], 'Authorization: Bearer ' . $jwt, 'Accept: application/json'];
    [$status, $body] = marketing_http($base . '/auth/v1/user', 'GET', $headers);
    $user = json_decode($body, true);
    if ($status < 200 || $status >= 300 || !is_array($user) || !preg_match('/^[0-9a-f-]{36}$/i', (string)($user['id'] ?? ''))) marketing_reply(401, ['error' => 'Sessão inválida. Entre novamente.']);
    return [$base, $headers, $jwt, $user];
}
function marketing_rest(array $auth, string $path, string $method = 'GET', ?string $body = null, array $extraHeaders = []): array {
    [$base, $headers] = $auth;
    if ($body !== null) $headers[] = 'Content-Type: application/json';
    $headers = array_merge($headers, $extraHeaders);
    return marketing_http($base . '/rest/v1/' . ltrim($path, '/'), $method, $headers, $body);
}
function marketing_authorize_project(array $auth, string $projectId): void {
    if (!preg_match('/^[0-9a-f-]{36}$/i', $projectId)) marketing_reply(400, ['error' => 'Projeto inválido.']);
    [$status, $body] = marketing_rest($auth, 'marketing_projects?id=eq.' . rawurlencode($projectId) . '&select=id', 'GET');
    $rows = json_decode($body, true);
    if ($status < 200 || $status >= 300 || !is_array($rows) || count($rows) !== 1) marketing_reply(403, ['error' => 'Você não tem acesso a este projeto.']);
}
function marketing_safe_name(string $name): string {
    $name = basename(str_replace('\\', '/', $name));
    $name = preg_replace('/[^\pL\pN._() -]/u', '_', $name) ?? 'arquivo';
    $name = trim(substr($name, 0, 180), " .\t\n\r\0\x0B");
    return $name !== '' ? $name : 'arquivo';
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
$isLocal = in_array($_SERVER['HTTP_HOST'] ?? '', ['localhost', '127.0.0.1'], true);
if (empty($_SERVER['HTTPS']) && !$isLocal) marketing_reply(400, ['error' => 'A transferência de arquivos exige HTTPS.']);
$config = marketing_config();
$auth = marketing_auth($config);
$user = $auth[3];
$uploadDir = rtrim((string)$config['upload_dir'], '/');
if (!is_dir($uploadDir) && !@mkdir($uploadDir, 0750, true) && !is_dir($uploadDir)) marketing_reply(503, ['error' => 'A pasta privada de uploads não pode ser criada. Verifique o caminho e as permissões PHP.']);
if (!is_writable($uploadDir)) marketing_reply(503, ['error' => 'A pasta privada de uploads está sem permissão de escrita.']);

$action = strtolower((string)($_GET['action'] ?? $_POST['action'] ?? ''));
if ($action === 'upload' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $projectId = (string)($_POST['project_id'] ?? '');
    marketing_authorize_project($auth, $projectId);
    if (!isset($_FILES['file']) || !is_array($_FILES['file'])) marketing_reply(400, ['error' => 'Selecione um arquivo para enviar.']);
    $upload = $_FILES['file'];
    $limit = min(104857600, max(1, (int)($config['max_bytes'] ?? 104857600)));
    if (($upload['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file((string)($upload['tmp_name'] ?? ''))) marketing_reply(400, ['error' => 'Falha ao receber o arquivo.']);
    if ((int)$upload['size'] < 1 || (int)$upload['size'] > $limit) marketing_reply(413, ['error' => 'O arquivo excede o limite de 100 MB.']);
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file((string)$upload['tmp_name']) ?: 'application/octet-stream';
    $allowed = ['image/jpeg','image/png','image/gif','image/webp','application/pdf','text/plain','text/csv','application/zip','application/x-zip-compressed','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation','application/msword','application/vnd.ms-excel','application/vnd.ms-powerpoint','audio/mpeg','audio/wav','video/mp4'];
    if (!in_array($mime, $allowed, true)) marketing_reply(415, ['error' => 'Tipo de arquivo não permitido. Envie uma imagem, PDF, documento, planilha, arquivo compactado ou mídia compatível.']);
    $extension = strtolower(pathinfo((string)$upload['name'], PATHINFO_EXTENSION));
    if (!preg_match('/^[a-z0-9]{1,10}$/', $extension)) $extension = 'bin';
    $storageName = bin2hex(random_bytes(16)) . '.' . $extension;
    if (!move_uploaded_file((string)$upload['tmp_name'], $uploadDir . '/' . $storageName)) marketing_reply(500, ['error' => 'Não foi possível gravar o arquivo na pasta da hospedagem.']);
    $taskId = (string)($_POST['task_id'] ?? '');
    $category = (string)($_POST['category'] ?? 'entrega');
    if (!in_array($category, ['briefing','referencia','entrega','documento','outro'], true)) $category = 'outro';
    $record = [
        'project_id' => $projectId,
        'task_id' => preg_match('/^[0-9a-f-]{36}$/i', $taskId) ? $taskId : null,
        'uploaded_by' => $user['id'], 'storage_name' => $storageName,
        'original_name' => marketing_safe_name((string)$upload['name']), 'content_type' => $mime,
        'size_bytes' => (int)$upload['size'], 'category' => $category, 'version' => 1,
    ];
    [$status, $body] = marketing_rest($auth, 'marketing_files', 'POST', json_encode($record, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), ['Prefer: return=representation']);
    if ($status < 200 || $status >= 300) { @unlink($uploadDir . '/' . $storageName); marketing_reply(403, ['error' => 'O arquivo não pôde ser vinculado ao projeto. Verifique a permissão de acesso.', 'detail' => json_decode($body, true)['message'] ?? '']); }
    $created = json_decode($body, true);
    marketing_reply(201, ['ok' => true, 'id' => is_array($created) && isset($created[0]['id']) ? $created[0]['id'] : null]);
}

if (in_array($action, ['download','delete'], true)) {
    $fileId = (string)($_GET['id'] ?? '');
    if (!preg_match('/^[0-9a-f-]{36}$/i', $fileId)) marketing_reply(400, ['error' => 'Arquivo inválido.']);
    [$status, $body] = marketing_rest($auth, 'marketing_files?id=eq.' . rawurlencode($fileId) . '&select=id,project_id,storage_name,original_name,content_type,size_bytes', 'GET');
    $rows = json_decode($body, true);
    if ($status < 200 || $status >= 300 || !is_array($rows) || count($rows) !== 1) marketing_reply(404, ['error' => 'Arquivo não encontrado ou acesso negado.']);
    $file = $rows[0];
    marketing_authorize_project($auth, (string)$file['project_id']);
    $storageName = (string)$file['storage_name'];
    if (!preg_match('/^[a-f0-9]{32}\.[a-z0-9]{1,10}$/', $storageName)) marketing_reply(500, ['error' => 'Referência interna de arquivo inválida.']);
    $path = $uploadDir . '/' . $storageName;
    if ($action === 'delete' && $_SERVER['REQUEST_METHOD'] === 'DELETE') {
        [$deleteStatus] = marketing_rest($auth, 'marketing_files?id=eq.' . rawurlencode($fileId), 'DELETE');
        if ($deleteStatus < 200 || $deleteStatus >= 300) marketing_reply(403, ['error' => 'Você não pode excluir este arquivo.']);
        if (is_file($path) && !@unlink($path)) marketing_reply(500, ['error' => 'Registro removido, mas o arquivo permanece no diretório privado. Remova-o pela administração da hospedagem.']);
        marketing_reply(200, ['ok' => true]);
    }
    if ($action !== 'download' || $_SERVER['REQUEST_METHOD'] !== 'GET') marketing_reply(405, ['error' => 'Método não permitido.']);
    if (!is_file($path) || !is_readable($path)) marketing_reply(404, ['error' => 'Arquivo não está disponível no servidor.']);
    $inline = ($_GET['disposition'] ?? '') === 'inline';
    $safeName = marketing_safe_name((string)$file['original_name']);
    header('Content-Type: ' . preg_replace('/[^\w.+-\/]/', '', (string)$file['content_type']));
    header('Content-Length: ' . (string)filesize($path));
    header('Content-Disposition: ' . ($inline && str_starts_with((string)$file['content_type'], 'image/') ? 'inline' : 'attachment') . '; filename="' . addcslashes($safeName, '"\\') . '"; filename*=UTF-8\'\'' . rawurlencode($safeName));
    readfile($path);
    exit;
}
marketing_reply(400, ['error' => 'Ação de arquivo inválida.']);

