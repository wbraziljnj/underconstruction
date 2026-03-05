<?php

declare(strict_types=1);

// Evita que warnings/notices quebrem respostas JSON em produção.
@ini_set('display_errors', '0');
@ini_set('log_errors', '1');

require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/helpers.php';
require_once __DIR__ . '/src/Logger.php';

use UC\Database;
use UC\Logger;

function uc_is_default_password(string $stored): bool
{
    if ($stored === '') return false;
    $info = password_get_info($stored);
    $isHash = is_array($info) && (int)($info['algo'] ?? 0) !== 0;
    if ($isHash) {
        return password_verify('UnderConstruction', $stored);
    }
    // Compat: legado (texto puro/hex)
    if (preg_match('/^[a-f0-9]{32}$/i', $stored) === 1) {
        return hash_equals(strtolower($stored), md5('UnderConstruction'));
    }
    if (preg_match('/^[a-f0-9]{40}$/i', $stored) === 1) {
        return hash_equals(strtolower($stored), sha1('UnderConstruction'));
    }
    if (preg_match('/^[a-f0-9]{64}$/i', $stored) === 1) {
        return hash_equals(strtolower($stored), hash('sha256', 'UnderConstruction'));
    }
    return hash_equals($stored, 'UnderConstruction');
}

$__reqStart = microtime(true);
$__reqId = $_SERVER['HTTP_X_REQUEST_ID'] ?? uuid_v4();
$__method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$__requestUri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$__ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

Logger::withRequest([
    'request_id' => $__reqId,
    'method' => $__method,
    'path' => (string)$__requestUri,
    'ip' => $__ip,
]);

header('X-Request-Id: ' . $__reqId);

set_exception_handler(function (Throwable $e): void {
    Logger::error('exception', [
        'error' => [
            'type' => get_class($e),
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
            'stack' => $e->getTraceAsString(),
        ],
        'http' => [
            'method' => $_SERVER['REQUEST_METHOD'] ?? '',
            'path' => $_SERVER['REQUEST_URI'] ?? '',
            'status' => 500,
        ],
    ]);
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['detail' => 'Erro interno.'], JSON_UNESCAPED_UNICODE);
    }
    exit;
});

set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
    // Converte warnings/notices em exceção para não “vazar” HTML.
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

register_shutdown_function(function () use ($__reqStart): void {
    $lastError = error_get_last();
    $status = http_response_code() ?: 200;
    if ($lastError !== null && in_array($lastError['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        Logger::error('fatal', [
            'error' => [
                'type' => 'fatal',
                'message' => $lastError['message'] ?? '',
                'file' => $lastError['file'] ?? '',
                'line' => $lastError['line'] ?? 0,
            ],
            'http' => [
                'method' => $_SERVER['REQUEST_METHOD'] ?? '',
                'path' => $_SERVER['REQUEST_URI'] ?? '',
                'status' => 500,
            ],
        ]);
    }
    $duration = (int)round((microtime(true) - $__reqStart) * 1000);
    Logger::info('request_end', [
        'http' => [
            'method' => $_SERVER['REQUEST_METHOD'] ?? '',
            'path' => $_SERVER['REQUEST_URI'] ?? '',
            'status' => $status,
            'duration_ms' => $duration,
        ],
    ]);
});

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Request-Id');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

start_session_if_needed();
if (isset($_SESSION['uc_user_id']) && $_SESSION['uc_user_id']) {
    Logger::withRequest([
        'request_id' => $__reqId,
        'method' => $__method,
        'path' => (string)$__requestUri,
        'ip' => $__ip,
        'user_id' => (int)$_SESSION['uc_user_id'],
    ]);
}

$method = $_SERVER['REQUEST_METHOD'];
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$scriptDir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$relativePath = '/' . ltrim(str_replace($scriptDir, '', (string)$requestUri), '/');
$relativePath = rtrim($relativePath, '/');

Logger::info('request_start', [
    'http' => [
        'method' => $method,
        'path' => $relativePath,
    ],
]);

if (isset($_GET['ucDebug']) && $_GET['ucDebug'] === 'ping') {
    json_response(['ok' => true, 'marker' => 'uc-api', 'time' => date(DATE_ATOM)]);
    exit;
}

if ($relativePath === '/client-log' && $method === 'POST') {
    $payload = parse_json_body();
    $events = [];
    if (isset($payload[0]) && is_array($payload[0])) {
        $events = $payload;
    } elseif (is_array($payload)) {
        $events = [$payload];
    }
    foreach ($events as $evt) {
        if (!is_array($evt)) {
            continue;
        }
        $evtSan = Logger::sanitizeContext($evt);
        $name = is_string($evtSan['event'] ?? null) ? $evtSan['event'] : 'client_log';
        unset($evtSan['event']);
        $evtSan['user_agent'] = $_SERVER['HTTP_USER_AGENT'] ?? '';
        Logger::client($name, ['service' => 'client', 'context' => $evtSan]);
    }
    json_response(['ok' => true], 204);
    exit;
}

// Conectar cedo para falhar rápido (mesmo padrão do Sheila).
Database::connection();

function get_bearer_token(): ?string
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!is_string($h) || $h === '') {
        return null;
    }
    if (preg_match('/^Bearer\\s+(.*)$/i', trim($h), $m) === 1) {
        $t = trim((string)($m[1] ?? ''));
        return $t !== '' ? $t : null;
    }
    return null;
}

function verify_current_user_password(string $password): void
{
    $userId = require_authenticated_user_id();
    $user = fetch_one('SELECT password_hash FROM uc_users WHERE user_id = ? LIMIT 1', [$userId]);
    if (!$user) {
        json_response(['detail' => 'Não autenticado.'], 401);
        exit;
    }
    $stored = (string)($user['password_hash'] ?? '');
    if ($stored === '') {
        json_response(['detail' => 'Senha inválida.'], 403);
        exit;
    }
    $info = password_get_info($stored);
    $isHash = is_array($info) && (int)($info['algo'] ?? 0) !== 0;
    if ($isHash) {
        $ok = password_verify($password, $stored);
    } else {
        // Compat: legado com MD5/SHA1/SHA256 (hex) ou texto puro.
        if (preg_match('/^[a-f0-9]{32}$/i', $stored) === 1) {
            $ok = hash_equals(strtolower($stored), md5($password));
        } elseif (preg_match('/^[a-f0-9]{40}$/i', $stored) === 1) {
            $ok = hash_equals(strtolower($stored), sha1($password));
        } elseif (preg_match('/^[a-f0-9]{64}$/i', $stored) === 1) {
            $ok = hash_equals(strtolower($stored), hash('sha256', $password));
        } else {
            $ok = hash_equals($stored, $password);
        }
    }
    if (!$ok) {
        json_response(['detail' => 'Senha inválida.'], 403);
        exit;
    }
}

// Endpoint de emergência: resetar senha de todos os usuários.
// Protegido por token (env UC_RESET_TOKEN ou config.php ['resetToken']).
if ($relativePath === '/reset-all-passwords' && $method === 'POST') {
    $config = require __DIR__ . '/config.php';
    $expected = getenv('UC_RESET_TOKEN') ?: (string)($config['resetToken'] ?? '');
    $expected = trim($expected);
    if ($expected === '') {
        json_response(['detail' => 'Rota desabilitada.'], 404);
        exit;
    }

    $payload = parse_json_body();
    $token = get_bearer_token() ?? (is_string($payload['token'] ?? null) ? trim((string)$payload['token']) : '');
    if ($token === '' || !hash_equals($expected, $token)) {
        json_response(['detail' => 'Não autorizado.'], 401);
        exit;
    }

    $newHash = password_hash('UnderConstruction', PASSWORD_DEFAULT);
    $pdo = Database::connection();
    try {
        $stmt = $pdo->prepare('UPDATE uc_users SET password_hash = ?, updated_at = updated_at');
        $stmt->execute([$newHash]);
        $count = $stmt->rowCount();
    } catch (Throwable) {
        $stmt = $pdo->prepare('UPDATE uc_users SET password_hash = ?');
        $stmt->execute([$newHash]);
        $count = $stmt->rowCount();
    }
    json_response(['ok' => true, 'updated' => (int)$count, 'password' => 'UnderConstruction']);
    exit;
}

// Diagnóstico de login (token): mostra se usuário existe e formato de password_hash, sem expor senha.
if ($relativePath === '/diag/login' && $method === 'POST') {
    $config = require __DIR__ . '/config.php';
    $expected = getenv('UC_RESET_TOKEN') ?: (string)($config['resetToken'] ?? '');
    $expected = trim($expected);
    if ($expected === '') {
        json_response(['detail' => 'Rota desabilitada.'], 404);
        exit;
    }

    $payload = parse_json_body();
    $token = get_bearer_token() ?? (is_string($payload['token'] ?? null) ? trim((string)$payload['token']) : '');
    if ($token === '' || !hash_equals($expected, $token)) {
        json_response(['detail' => 'Não autorizado.'], 401);
        exit;
    }

    $email = trim((string)($payload['email'] ?? ($payload['identifier'] ?? '')));
    if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        json_response(['detail' => 'email inválido.'], 400);
        exit;
    }

    $pdo = Database::connection();
    $dbName = (string)$pdo->query('SELECT DATABASE() AS db')->fetch()['db'];
    $user = fetch_one('SELECT user_id, email, status, code, password_hash FROM uc_users WHERE LOWER(email) = ? LIMIT 1', [strtolower($email)]);
    if (!$user) {
        json_response(['ok' => true, 'db' => $dbName, 'userFound' => false]);
        exit;
    }
    $stored = (string)($user['password_hash'] ?? '');
    $info = $stored !== '' ? password_get_info($stored) : ['algo' => 0, 'algoName' => ''];
    $isMd5 = $stored !== '' && preg_match('/^[a-f0-9]{32}$/i', $stored) === 1;
    $isSha1 = $stored !== '' && preg_match('/^[a-f0-9]{40}$/i', $stored) === 1;
    $isSha256 = $stored !== '' && preg_match('/^[a-f0-9]{64}$/i', $stored) === 1;

    json_response([
        'ok' => true,
        'db' => $dbName,
        'userFound' => true,
        'status' => $user['status'] ?? null,
        'passwordStoredLen' => strlen($stored),
        'passwordLooksLikeHash' => (int)($info['algo'] ?? 0) !== 0,
        'passwordAlgo' => (string)($info['algoName'] ?? ''),
        'passwordLooksLikeMd5' => $isMd5,
        'passwordLooksLikeSha1' => $isSha1,
        'passwordLooksLikeSha256' => $isSha256,
        'codeType' => gettype($user['code'] ?? null),
        'codePreview' => is_string($user['code'] ?? null) ? substr((string)$user['code'], 0, 80) : null,
    ]);
    exit;
}

function require_privileged_role(): void
{
    $userId = require_authenticated_user_id();
    $row = fetch_one('SELECT tipo_usuario FROM uc_users WHERE user_id = ? LIMIT 1', [$userId]);
    if (!$row) {
        json_response(['detail' => 'Não autenticado.'], 401);
        exit;
    }
    $tipo = (string)($row['tipo_usuario'] ?? '');
    $allowed = ['Owner', 'Proprietario', 'Gerente', 'Engenheiro'];
    if (!in_array($tipo, $allowed, true)) {
        json_response(['detail' => 'Sem permissão.'], 403);
        exit;
    }
}

$FASES_FIXAS = [
    '01 - Estudo e Planejamento' => [
        '01.01 - Levantamento do terreno',
        '01.02 - Levantamento topográfico',
        '01.03 - Sondagem do solo (SPT)',
        '01.04 - Estudo de viabilidade da obra',
        '01.05 - Definição do programa da obra',
        '01.06 - Estimativa inicial de custo',
    ],
    '02 - Projetos Técnicos' => [
        '02.01 - Projeto arquitetônico',
        '02.02 - Projeto estrutural',
        '02.03 - Projeto elétrico',
        '02.04 - Projeto hidráulico',
        '02.05 - Projeto sanitário',
        '02.06 - Projeto de águas pluviais',
        '02.07 - Projeto de fundação',
        '02.08 - Projeto de cobertura',
        '02.09 - Compatibilização de projetos',
    ],
    '03 - Aprovações e Documentação' => [
        '03.01 - Aprovação do projeto na prefeitura',
        '03.02 - Emissão do alvará de construção',
        '03.03 - Registro da ART no CREA',
        '03.04 - Cadastro da obra no CNO/INSS',
        '03.05 - Elaboração do PGRCC',
    ],
    '04 - Preparação da Obra' => [
        '04.01 - Limpeza do terreno',
        '04.02 - Terraplanagem',
        '04.03 - Marcação da obra (gabarito)',
        '04.04 - Instalação do canteiro de obras',
        '04.05 - Ligação provisória de água',
        '04.06 - Ligação provisória de energia',
    ],
    '05 - Fundação' => [
        '05.01 - Escavação das fundações',
        '05.02 - Execução de estacas ou brocas',
        '05.03 - Execução de sapatas ou blocos',
        '05.04 - Execução de vigas baldrame',
        '05.05 - Impermeabilização da fundação',
        '05.06 - Aterro e compactação',
    ],
    '06 - Estrutura' => [
        '06.01 - Execução de pilares',
        '06.02 - Execução de vigas estruturais',
        '06.03 - Execução de lajes',
        '06.04 - Execução de escadas',
        '06.05 - Cura do concreto',
    ],
    '07 - Alvenaria' => [
        '07.01 - Levantamento de paredes externas',
        '07.02 - Levantamento de paredes internas',
        '07.03 - Execução de vergas',
        '07.04 - Execução de contravergas',
        '07.05 - Amarrações estruturais',
    ],
    '08 - Cobertura' => [
        '08.01 - Estrutura do telhado',
        '08.02 - Instalação de caibros e ripas',
        '08.03 - Instalação das telhas',
        '08.04 - Instalação de cumeeiras',
        '08.05 - Instalação de calhas',
        '08.06 - Instalação de rufos',
    ],
    '09 - Instalações' => [
        '09.01 - Infraestrutura elétrica',
        '09.02 - Infraestrutura hidráulica',
        '09.03 - Instalação de rede de esgoto',
        '09.04 - Instalação de rede de água fria',
        '09.05 - Instalação de água quente',
        '09.06 - Sistema de drenagem',
    ],
    '10 - Fechamentos' => [
        '10.01 - Instalação de portas',
        '10.02 - Instalação de janelas',
        '10.03 - Instalação de portões',
    ],
    '11 - Revestimentos' => [
        '11.01 - Execução de chapisco',
        '11.02 - Execução de emboço',
        '11.03 - Execução de reboco',
        '11.04 - Instalação de gesso ou drywall',
        '11.05 - Regularização de pisos',
    ],
    '12 - Acabamentos' => [
        '12.01 - Instalação de pisos',
        '12.02 - Instalação de revestimentos cerâmicos',
        '12.03 - Pintura interna',
        '12.04 - Pintura externa',
        '12.05 - Instalação de rodapés',
        '12.06 - Instalação de forros',
    ],
    '13 - Instalações Finais' => [
        '13.01 - Instalação de tomadas',
        '13.02 - Instalação de interruptores',
        '13.03 - Instalação de luminárias',
        '13.04 - Instalação de louças sanitárias',
        '13.05 - Instalação de metais (torneiras e registros)',
        '13.06 - Instalação de chuveiros',
    ],
    '14 - Área Externa' => [
        '14.01 - Execução de calçadas',
        '14.02 - Execução de garagem',
        '14.03 - Construção de muros',
        '14.04 - Instalação de portão',
        '14.05 - Paisagismo',
    ],
    '15 - Finalização' => [
        '15.01 - Limpeza final da obra',
        '15.02 - Testes das instalações',
        '15.03 - Vistoria final',
        '15.04 - Emissão do habite-se',
        '15.05 - Entrega da obra',
    ],
];

$DOC_STATUS = ['ABERTO', 'ANDAMENTO', 'PENDENTE', 'FINALIZADO'];

function uc_public_api_url_for_path(?string $path): ?string
{
    if ($path === null) return null;
    $p = trim($path);
    if ($p === '') return null;
    // Já é URL absoluta ou caminho absoluto
    if (preg_match('#^https?://#i', $p) === 1) return $p;
    if (str_starts_with($p, '/')) return $p;

    $scriptDir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
    return $scriptDir . '/' . ltrim($p, '/');
}

function require_obra_cadastrada(): void
{
    $codigo = require_active_obra_codigo();
    $row = fetch_one('SELECT obra_id FROM uc_obra WHERE codigo = ? LIMIT 1', [$codigo]);
    if (!$row) {
        json_response(['detail' => 'Cadastre a Obra antes de cadastrar usuários, fases ou faturas.'], 409);
        exit;
    }
}

if ($relativePath === '/upload-foto' && $method === 'POST') {
    require_authenticated_user_id();
    require_active_obra_codigo();

    if (!isset($_FILES['foto'])) {
        json_response(['detail' => 'Arquivo "foto" é obrigatório (multipart/form-data).'], 400);
        exit;
    }

    $file = $_FILES['foto'];
    if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        json_response(['detail' => 'Falha no upload de arquivo.'], 400);
        exit;
    }

    $maxSize = 5 * 1024 * 1024; // 5 MB
    if (($file['size'] ?? 0) > $maxSize) {
        json_response(['detail' => 'Arquivo muito grande (máx 5MB).'], 413);
        exit;
    }

    $mime = null;
    if (class_exists('finfo')) {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);
    } elseif (function_exists('mime_content_type')) {
        $mime = mime_content_type($file['tmp_name']);
    }
    if (!is_string($mime) || $mime === '') {
        $mime = 'application/octet-stream';
    }

    $allowed = [
        'image/jpeg' => '.jpg',
        'image/png' => '.png',
        'image/webp' => '.webp',
    ];
    $ext = $allowed[$mime] ?? null;
    if ($ext === null) {
        $name = (string)($file['name'] ?? '');
        $byName = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $map = ['jpg' => '.jpg', 'jpeg' => '.jpg', 'png' => '.png', 'webp' => '.webp'];
        $ext = $map[$byName] ?? null;
    }
    if ($ext === null) {
        json_response(['detail' => 'Formato de imagem não suportado. Use JPG, PNG ou WEBP.'], 415);
        exit;
    }

    $destDir = __DIR__ . '/uploads';
    if (!is_dir($destDir)) {
        mkdir($destDir, 0755, true);
    }

    $filename = uuid_v4() . $ext;
    $destPath = $destDir . '/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        json_response(['detail' => 'Não foi possível salvar o arquivo.'], 500);
        exit;
    }

    $publicPath = uc_public_api_url_for_path('uploads/' . $filename);
    json_response([
        'filename' => $filename,
        'path' => 'uploads/' . $filename,
        'url' => $publicPath,
        'mime' => $mime,
        'size' => (int)$file['size'],
    ], 201);
    exit;
}

if ($relativePath === '/upload-documento' && $method === 'POST') {
    require_authenticated_user_id();
    require_active_obra_codigo();

    if (!isset($_FILES['arquivo'])) {
        json_response(['detail' => 'Arquivo "arquivo" é obrigatório (multipart/form-data).'], 400);
        exit;
    }

    $file = $_FILES['arquivo'];
    if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        json_response(['detail' => 'Falha no upload de arquivo.'], 400);
        exit;
    }

    $maxSize = 10 * 1024 * 1024; // 10 MB
    if (($file['size'] ?? 0) > $maxSize) {
        json_response(['detail' => 'Arquivo muito grande (máx 10MB).'], 413);
        exit;
    }

    $mime = null;
    if (class_exists('finfo')) {
        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);
    } elseif (function_exists('mime_content_type')) {
        $mime = mime_content_type($file['tmp_name']);
    }
    if (!is_string($mime) || $mime === '') {
        $mime = 'application/octet-stream';
    }

    $allowed = [
        'image/jpeg' => '.jpg',
        'image/png' => '.png',
        'image/webp' => '.webp',
        'application/pdf' => '.pdf',
        'application/msword' => '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => '.docx',
        'application/vnd.ms-excel' => '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => '.xlsx',
    ];
    $ext = $allowed[$mime] ?? null;
    if ($ext === null) {
        $name = (string)($file['name'] ?? '');
        $byName = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        $map = [
            'jpg' => '.jpg',
            'jpeg' => '.jpg',
            'png' => '.png',
            'webp' => '.webp',
            'pdf' => '.pdf',
            'doc' => '.doc',
            'docx' => '.docx',
            'xls' => '.xls',
            'xlsx' => '.xlsx',
        ];
        $ext = $map[$byName] ?? null;
    }
    if ($ext === null) {
        json_response(['detail' => 'Formato não suportado. Use imagem, PDF, Word ou Excel.'], 415);
        exit;
    }

    $destDir = __DIR__ . '/uploads';
    if (!is_dir($destDir)) {
        mkdir($destDir, 0755, true);
    }

    $filename = uuid_v4() . $ext;
    $destPath = $destDir . '/' . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        json_response(['detail' => 'Não foi possível salvar o arquivo.'], 500);
        exit;
    }

    $publicPath = uc_public_api_url_for_path('uploads/' . $filename);
    json_response([
        'filename' => $filename,
        'path' => 'uploads/' . $filename,
        'url' => $publicPath,
        'mime' => $mime,
        'size' => (int)$file['size'],
    ], 201);
    exit;
}

if ($relativePath === '/login' && $method === 'POST') {
    $payload = parse_json_body();
    $email = trim((string)($payload['email'] ?? ''));
    $password = (string)($payload['password'] ?? '');

    if ($email === '' || $password === '') {
        json_response(['detail' => 'Email e senha são obrigatórios.'], 400);
        exit;
    }

    // Sempre autentica pelo cadastro principal (menor user_id) desse email.
    $principal = fetch_one('SELECT * FROM uc_users WHERE LOWER(email) = ? ORDER BY user_id ASC LIMIT 1', [strtolower($email)]);
    if (!$principal) {
        json_response(['detail' => 'Credenciais inválidas.'], 401);
        exit;
    }

    $principalId = (int)($principal['id_principal'] ?? 0);
    if ($principalId <= 0) {
        $principalId = (int)$principal['user_id'];
    }

    $stored = (string)($principal['password_hash'] ?? '');
    if ($stored === '') {
        json_response(['detail' => 'Credenciais inválidas.'], 401);
        exit;
    }

    $info = password_get_info($stored);
    $isHash = is_array($info) && (int)($info['algo'] ?? 0) !== 0;

    $ok = false;
    if ($isHash) {
        $ok = password_verify($password, $stored);
    } else {
        // Compat: legado com MD5/SHA1/SHA256 (hex) ou texto puro (coluna password_hash).
        // Se bater, faz upgrade automático para hash.
        if (preg_match('/^[a-f0-9]{32}$/i', $stored) === 1) {
            $ok = hash_equals(strtolower($stored), md5($password));
        } elseif (preg_match('/^[a-f0-9]{40}$/i', $stored) === 1) {
            $ok = hash_equals(strtolower($stored), sha1($password));
        } elseif (preg_match('/^[a-f0-9]{64}$/i', $stored) === 1) {
            $ok = hash_equals(strtolower($stored), hash('sha256', $password));
        } else {
            $ok = hash_equals($stored, $password);
        }
        if ($ok) {
            $newHash = password_hash($password, PASSWORD_DEFAULT);
            try {
                $pdo = Database::connection();
                $stmt = $pdo->prepare('UPDATE uc_users SET password_hash = ?, updated_at = updated_at WHERE user_id = ?');
                $stmt->execute([$newHash, (string)$principal['user_id']]);
            } catch (Throwable $e) {
                error_log('[UC] password upgrade failed: ' . $e->getMessage());
            }
        }
    }

    if (!$ok) {
        json_response(['detail' => 'Credenciais inválidas.'], 401);
        exit;
    }

    // Busca todos registros desse usuário (mesmo id_principal).
    $groupUsers = fetch_all(
        'SELECT * FROM uc_users WHERE id_principal = ? OR user_id = ? ORDER BY user_id ASC',
        [$principalId, $principalId]
    );
    if (!$groupUsers) {
        json_response(['detail' => 'Credenciais inválidas.'], 401);
        exit;
    }

    // Codes acessíveis = união dos codes de todos os registros do grupo (ou todas se Owner).
    $codes = [];
    foreach ($groupUsers as $gu) {
        $codes = array_merge($codes, parse_user_codes_from_db($gu['code'] ?? ''));
    }

    $isOwner = (string)($principal['tipo_usuario'] ?? '') === 'Owner';
    if ($isOwner) {
        $rows = fetch_all('SELECT codigo FROM uc_obra');
        $codes = array_merge($codes, array_map(fn($r) => (string)$r['codigo'], $rows));
    }
    $_SESSION['uc_codes'] = $codes;
    $active = $_SESSION['uc_active_code'] ?? null;
    // Define active code pela ordem alfabética se não houver um válido
    $codesSorted = $codes;
    sort($codesSorted, SORT_NATURAL | SORT_FLAG_CASE);
    if (!is_string($active) || !in_array($active, $codes, true)) {
        $_SESSION['uc_active_code'] = $codesSorted[0] ?? null;
    }

    // Determina o registro ativo (o que tem o code do active); se não achar, usa o principal.
    $activeUser = $principal;
    foreach ($groupUsers as $gu) {
        $userCodes = parse_user_codes_from_db($gu['code'] ?? '');
        if (in_array($_SESSION['uc_active_code'], $userCodes, true)) {
            $activeUser = $gu;
            break;
        }
    }

    $_SESSION['uc_user_id_principal'] = (string)$principalId;
    $_SESSION['uc_user_id'] = (string)$activeUser['user_id'];

    json_response([
        'userId' => (string)$activeUser['user_id'],
        'principalId' => (string)$principalId,
        'nome' => (string)$activeUser['nome'],
        'email' => (string)$principal['email'],
        'tipoUsuario' => (string)$activeUser['tipo_usuario'],
        'codes' => array_values(array_unique($codes)),
        'activeCode' => $_SESSION['uc_active_code'] ?? null,
        // Regra: primeiro acesso é baseado na senha do cadastro principal (credencial do login).
        'mustChangePassword' => uc_is_default_password((string)($principal['password_hash'] ?? '')),
    ]);
    exit;
}

if ($relativePath === '/me' && $method === 'GET') {
    $userId = $_SESSION['uc_user_id'] ?? null;
    if (!is_string($userId) || trim($userId) === '') {
        json_response(null);
        exit;
    }
    $user = fetch_one('SELECT * FROM uc_users WHERE user_id = ? LIMIT 1', [$userId]);
    if (!$user) {
        unset($_SESSION['uc_user_id']);
        json_response(null);
        exit;
    }
    $codes = parse_user_codes_from_db($user['code'] ?? '');
    // Se Owner, substitui por todas as obras existentes
    if ((string)($user['tipo_usuario'] ?? '') === 'Owner') {
        $rows = fetch_all('SELECT codigo FROM uc_obra');
        $codes = array_values(array_unique(array_map(fn($r) => (string)$r['codigo'], $rows)));
    }
    $_SESSION['uc_codes'] = $codes;
    $active = $_SESSION['uc_active_code'] ?? null;
    if (!is_string($active) || !in_array($active, $codes, true)) {
        $_SESSION['uc_active_code'] = $codes[0] ?? null;
    }
    $principalId = (int)($user['id_principal'] ?? 0);
    if ($principalId <= 0) {
        $principalId = (int)($user['user_id'] ?? 0);
    }
    $principal = $principalId > 0 ? fetch_one('SELECT password_hash FROM uc_users WHERE user_id = ? LIMIT 1', [$principalId]) : false;

    json_response([
        'userId' => (string)$user['user_id'],
        'nome' => (string)$user['nome'],
        'email' => (string)$user['email'],
        'tipoUsuario' => (string)$user['tipo_usuario'],
        'codes' => $codes,
        'activeCode' => $_SESSION['uc_active_code'] ?? null,
        // Regra: primeiro acesso baseado no cadastro principal.
        'mustChangePassword' => uc_is_default_password((string)(($principal['password_hash'] ?? null) ?? ($user['password_hash'] ?? ''))),
    ]);
    exit;
}

if ($relativePath === '/logout' && $method === 'POST') {
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
    http_response_code(204);
    exit;
}

if ($relativePath === '/password/change' && $method === 'POST') {
    $userId = require_authenticated_user_id();
    $payload = parse_json_body();

    $current = is_string($payload['current_password'] ?? null) ? (string)$payload['current_password'] : '';
    $next = is_string($payload['new_password'] ?? null) ? (string)$payload['new_password'] : '';
    if (trim($current) === '') {
        fail_validation('current_password', 'Senha atual obrigatória', 400);
    }
    $nextTrim = trim($next);
    if ($nextTrim === '' || strlen($nextTrim) < 6) {
        fail_validation('new_password', 'Nova senha deve ter pelo menos 6 caracteres', 400);
    }

    $user = fetch_one('SELECT email, password_hash FROM uc_users WHERE user_id = ? LIMIT 1', [$userId]);
    if (!$user) {
        json_response(['detail' => 'Não autenticado.'], 401);
        exit;
    }
    $stored = (string)($user['password_hash'] ?? '');
    if ($stored === '') {
        fail_validation('current_password', 'Senha atual inválida', 403);
    }

    $info = password_get_info($stored);
    $isHash = is_array($info) && (int)($info['algo'] ?? 0) !== 0;
    $ok = false;
    if ($isHash) {
        $ok = password_verify($current, $stored);
    } else {
        if (preg_match('/^[a-f0-9]{32}$/i', $stored) === 1) {
            $ok = hash_equals(strtolower($stored), md5($current));
        } elseif (preg_match('/^[a-f0-9]{40}$/i', $stored) === 1) {
            $ok = hash_equals(strtolower($stored), sha1($current));
        } elseif (preg_match('/^[a-f0-9]{64}$/i', $stored) === 1) {
            $ok = hash_equals(strtolower($stored), hash('sha256', $current));
        } else {
            $ok = hash_equals($stored, $current);
        }
    }
    if (!$ok) {
        fail_validation('current_password', 'Senha atual inválida', 403);
    }

    $email = strtolower((string)($user['email'] ?? ''));
    if ($email === '') {
        json_response(['detail' => 'Email inválido.'], 400);
        exit;
    }

    $newHash = password_hash($nextTrim, PASSWORD_DEFAULT);
    $pdo = Database::connection();
    $stmt = $pdo->prepare('UPDATE uc_users SET password_hash = ? WHERE LOWER(email) = ?');
    $stmt->execute([$newHash, $email]);
    json_response(['ok' => true]);
    exit;
}

if ($relativePath === '/obras' && $method === 'GET') {
    require_authenticated_user_id();
    $activeCode = get_active_obra_codigo();
    $codes = get_user_obras_codes();
    $isOwner = is_owner_authenticated();

    $obras = [];
    if ($isOwner) {
        $rows = fetch_all('SELECT obra_id, foto, nome, codigo FROM uc_obra ORDER BY nome ASC');
        $obras = array_map(fn ($r) => [
            'obraId' => (int)$r['obra_id'],
            'nome' => (string)$r['nome'],
            'codigo' => (string)$r['codigo'],
            'foto' => $r['foto'] !== null ? (string)$r['foto'] : null,
        ], $rows);
        $codes = array_values(array_unique(array_map(fn ($r) => (string)$r['codigo'], $rows)));
        // Owner pode acessar todas; mantém codes na sessão para coerência.
        $_SESSION['uc_codes'] = $codes;
    } elseif ($codes !== []) {
        $placeholders = implode(',', array_fill(0, count($codes), '?'));
        $rows = fetch_all(
            "SELECT obra_id, foto, nome, codigo FROM uc_obra WHERE codigo IN ($placeholders) ORDER BY nome ASC",
            $codes
        );
        $obras = array_map(fn ($r) => [
            'obraId' => (int)$r['obra_id'],
            'nome' => (string)$r['nome'],
            'codigo' => (string)$r['codigo'],
            'foto' => $r['foto'] !== null ? (string)$r['foto'] : null,
        ], $rows);
    }

    // Ajusta activeCode para um válido
    if (!is_string($activeCode) || !in_array($activeCode, $codes, true)) {
        $activeCode = $codes[0] ?? null;
        if ($activeCode !== null) {
            $_SESSION['uc_active_code'] = $activeCode;
        }
    }

    json_response([
        'codes' => $codes,
        'activeCode' => $activeCode,
        'obras' => $obras,
        'owner' => $isOwner,
    ]);
    exit;
}

if ($relativePath === '/obras/select' && $method === 'POST') {
    require_authenticated_user_id();
    $body = parse_json_body();
    $codigo = is_string($body['codigo'] ?? null) ? trim((string)$body['codigo']) : '';
    if ($codigo === '') {
        fail_validation('codigo', 'codigo é obrigatório');
    }
    require_user_has_codigo($codigo);
    $_SESSION['uc_active_code'] = $codigo;
    json_response(['activeCode' => $codigo]);
    exit;
}

if ($relativePath === '/cadastros/options' && $method === 'GET') {
    require_authenticated_user_id();
    $code = require_active_obra_codigo();
    $rows = fetch_all(
        // Owner aparece em todos os selects, independente do code (perfil global).
        'SELECT user_id, nome, tipo_usuario, status
         FROM uc_users
         WHERE (' . uc_users_code_predicate('code') . ' OR tipo_usuario = ?)
         ORDER BY nome ASC',
        [$code, 'Owner']
    );
    $options = array_map(fn ($r) => [
        'userId' => (string)$r['user_id'],
        'nome' => (string)$r['nome'],
        'tipoUsuario' => (string)$r['tipo_usuario'],
        'status' => (string)$r['status'],
    ], $rows);
    json_response($options);
    exit;
}

if ($relativePath === '/cadastros/lookup' && $method === 'GET') {
    require_authenticated_user_id();
    $email = trim((string)($_GET['email'] ?? ''));
    if ($email === '') {
        json_response(null);
        exit;
    }
    $principal = fetch_one('SELECT * FROM uc_users WHERE LOWER(email) = ? ORDER BY user_id ASC LIMIT 1', [strtolower($email)]);
    if (!$principal) {
        json_response(null);
        exit;
    }
    $principalId = (int)($principal['id_principal'] ?? 0);
    if ($principalId <= 0) {
        $principalId = (int)$principal['user_id'];
    }
    json_response([
        'userId' => (string)$principal['user_id'],
        'idPrincipal' => (string)$principalId,
        'nome' => (string)$principal['nome'],
        'cpfCnpj' => (string)$principal['cpf_cnpj'],
        'telefone' => (string)$principal['telefone'],
        'endereco' => (string)$principal['endereco'],
        'email' => (string)$principal['email'],
        'tipoUsuario' => (string)$principal['tipo_usuario'],
        'status' => (string)$principal['status'],
        'notas' => $principal['notas'] !== null ? (string)$principal['notas'] : '',
        'foto' => $principal['foto'] !== null ? (string)$principal['foto'] : '',
    ]);
    exit;
}

if ($relativePath === '/fases/options' && $method === 'GET') {
    require_authenticated_user_id();
    $code = require_active_obra_codigo();
    $rows = fetch_all(
        'SELECT fase_id, fase, subfase, data_inicio, previsao_finalizacao, data_finalizacao, status
         FROM uc_fases
         WHERE ' . uc_code_predicate_for_table('uc_fases', 'code') . '
         ORDER BY
            CAST(SUBSTRING_INDEX(fase, " ", 1) AS UNSIGNED) ASC,
            CAST(SUBSTRING_INDEX(COALESCE(subfase, ""), ".", 1) AS UNSIGNED) ASC,
            CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(COALESCE(subfase, ""), ".", -1), " ", 1) AS UNSIGNED) ASC,
            data_inicio ASC,
            fase_id ASC',
        [$code]
    );
    $options = array_map(fn ($r) => [
        'faseId' => (string)$r['fase_id'],
        'fase' => (string)$r['fase'],
        'subfase' => $r['subfase'] !== null ? (string)$r['subfase'] : null,
        'dataInicio' => (string)$r['data_inicio'],
        'previsaoFinalizacao' => (string)$r['previsao_finalizacao'],
        'dataFinalizacao' => $r['data_finalizacao'] !== null ? (string)$r['data_finalizacao'] : null,
        'status' => (string)($r['status'] ?? ''),
    ], $rows);
    json_response($options);
    exit;
}

if ($relativePath === '/cadastros' && $method === 'GET') {
    require_authenticated_user_id();
    $code = require_active_obra_codigo();

    $q = trim((string)($_GET['q'] ?? ''));
    $tipo = trim((string)($_GET['tipo_usuario'] ?? ''));
    $status = trim((string)($_GET['status'] ?? ''));

    $sql = 'SELECT user_id, foto, tipo_usuario, nome, cpf_cnpj, telefone, endereco, email, notas, status, created_at, updated_at
            FROM uc_users WHERE (code = ? OR tipo_usuario = "Owner")';
    $params = [$code];

    if ($q !== '') {
        $sql .= ' AND (LOWER(nome) LIKE ? OR LOWER(email) LIKE ? OR cpf_cnpj LIKE ?)';
        $like = '%' . strtolower($q) . '%';
        $params[] = $like;
        $params[] = $like;
        $params[] = '%' . $q . '%';
    }
    if ($tipo !== '') {
        $sql .= ' AND tipo_usuario = ?';
        $params[] = $tipo;
    }
    if ($status !== '') {
        $sql .= ' AND status = ?';
        $params[] = $status;
    }

    $sql .= ' ORDER BY nome ASC';
    $rows = fetch_all($sql, $params);
    $items = array_map(fn ($r) => [
        'userId' => (string)$r['user_id'],
        'foto' => $r['foto'] !== null ? (string)$r['foto'] : null,
        'tipoUsuario' => (string)$r['tipo_usuario'],
        'nome' => (string)$r['nome'],
        'cpfCnpj' => (string)$r['cpf_cnpj'],
        'telefone' => (string)$r['telefone'],
        'endereco' => (string)$r['endereco'],
        'email' => (string)$r['email'],
        'notas' => $r['notas'] !== null ? (string)$r['notas'] : null,
        'status' => (string)$r['status'],
        'createdAt' => (string)$r['created_at'],
        'updatedAt' => (string)$r['updated_at'],
    ], $rows);
    json_response(['items' => $items]);
    exit;
}

if ($relativePath === '/fases' && $method === 'GET') {
    global $FASES_FIXAS;
    require_authenticated_user_id();
    $code = require_active_obra_codigo();

    $q = trim((string)($_GET['q'] ?? ''));

    $sql = 'SELECT f.fase_id, f.fase, f.subfase, f.data_inicio, f.previsao_finalizacao, f.data_finalizacao, f.responsavel_id,
                   f.status, f.valor_previsao, f.notas, f.created_at, f.updated_at,
                   u.nome AS responsavel_nome,
                   (
                     COALESCE((SELECT SUM(ft.total) FROM uc_faturas ft WHERE ft.fase_id = f.fase_id AND ' . uc_code_predicate_for_table('uc_faturas', 'ft.code') . '), 0)
                   ) AS valor_atual
            FROM uc_fases f
            LEFT JOIN uc_users u ON u.user_id = f.responsavel_id
            WHERE ' . uc_code_predicate_for_table('uc_fases', 'f.code');
    $params = [$code, $code, $code];

    if ($q !== '') {
        $sql .= ' AND (LOWER(f.fase) LIKE ? OR LOWER(u.nome) LIKE ?)';
        $like = '%' . strtolower($q) . '%';
        $params[] = $like;
        $params[] = $like;
    }
    $statusFilter = trim((string)($_GET['status'] ?? ''));
    if ($statusFilter !== '') {
        $sql .= ' AND f.status = ?';
        $params[] = $statusFilter;
    }

    $sql .= ' ORDER BY
                CAST(SUBSTRING_INDEX(f.fase, " ", 1) AS UNSIGNED) ASC,
                CAST(SUBSTRING_INDEX(COALESCE(f.subfase, ""), ".", 1) AS UNSIGNED) ASC,
                CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(COALESCE(f.subfase, ""), ".", -1), " ", 1) AS UNSIGNED) ASC,
                f.data_inicio ASC,
                f.fase_id ASC';
    $rows = fetch_all($sql, $params);
    $items = array_map(fn ($r) => [
        'faseId' => (string)$r['fase_id'],
        'fase' => (string)$r['fase'],
        'subfase' => (string)$r['subfase'],
        'status' => (string)($r['status'] ?? ''),
        'dataInicio' => (string)$r['data_inicio'],
        'previsaoFinalizacao' => (string)$r['previsao_finalizacao'],
        'dataFinalizacao' => $r['data_finalizacao'] !== null ? (string)$r['data_finalizacao'] : null,
        'responsavelId' => $r['responsavel_id'] !== null ? (string)$r['responsavel_id'] : null,
        'responsavelNome' => $r['responsavel_nome'] !== null ? (string)$r['responsavel_nome'] : null,
        'valorPrevisao' => (string)$r['valor_previsao'],
        'valorAtual' => (string)$r['valor_atual'],
        'notas' => $r['notas'] !== null ? (string)$r['notas'] : null,
        'createdAt' => (string)$r['created_at'],
        'updatedAt' => (string)$r['updated_at'],
    ], $rows);
    json_response(['items' => $items]);
    exit;
}

if ($relativePath === '/home/summary' && $method === 'GET') {
    require_authenticated_user_id();
    $code = require_active_obra_codigo();

    $faseCountsRows = fetch_all(
        'SELECT status, COUNT(*) AS c
         FROM uc_fases
         WHERE ' . uc_code_predicate_for_table('uc_fases', 'code') . '
         GROUP BY status',
        [$code]
    );
    $faseCounts = [
        'ABERTO' => 0,
        'ANDAMENTO' => 0,
        'PENDENTE' => 0,
        'FINALIZADO' => 0,
    ];
    foreach ($faseCountsRows as $r) {
        $st = strtoupper((string)($r['status'] ?? ''));
        if ($st !== '' && array_key_exists($st, $faseCounts)) {
            $faseCounts[$st] = (int)($r['c'] ?? 0);
        }
    }

    $faturaCountsRows = fetch_all(
        'SELECT pagamento, COUNT(*) AS c
         FROM uc_faturas
         WHERE ' . uc_code_predicate_for_table('uc_faturas', 'code') . ' AND status = ?
         GROUP BY pagamento',
        [$code, 'ATIVO']
    );
    $faturaCounts = [
        'aberto' => 0,
        'pendente' => 0,
        'pago' => 0,
    ];
    foreach ($faturaCountsRows as $r) {
        $pg = strtolower((string)($r['pagamento'] ?? ''));
        if ($pg !== '' && array_key_exists($pg, $faturaCounts)) {
            $faturaCounts[$pg] = (int)($r['c'] ?? 0);
        }
    }

    $userRow = fetch_one(
        'SELECT COUNT(*) AS c FROM uc_users WHERE ' . uc_users_code_predicate('code'),
        [$code]
    );
    $usuariosTotal = $userRow ? (int)($userRow['c'] ?? 0) : 0;

    $docsCountsRows = fetch_all(
        'SELECT status, COUNT(*) AS c
         FROM uc_documentacoes
         WHERE ' . uc_code_predicate_for_table('uc_documentacoes', 'code') . '
         GROUP BY status',
        [$code]
    );
    $docsCounts = [
        'ABERTO' => 0,
        'PENDENTE' => 0,
        'FINALIZADO' => 0,
    ];
    foreach ($docsCountsRows as $r) {
        $st = strtoupper((string)($r['status'] ?? ''));
        if ($st !== '' && array_key_exists($st, $docsCounts)) {
            $docsCounts[$st] = (int)($r['c'] ?? 0);
        }
    }

    json_response([
        'activeCode' => $code,
        'fases' => [
            'abertas' => $faseCounts['ABERTO'],
            'andamentos' => $faseCounts['ANDAMENTO'],
            'pendentes' => $faseCounts['PENDENTE'],
            'finalizadas' => $faseCounts['FINALIZADO'],
        ],
        'faturas' => $faturaCounts,
        'documentos' => [
            'aberto' => $docsCounts['ABERTO'],
            'pendente' => $docsCounts['PENDENTE'],
            'finalizado' => $docsCounts['FINALIZADO'],
        ],
        'usuariosTotal' => $usuariosTotal,
    ]);
    exit;
}

if ($relativePath === '/home/timeline' && $method === 'GET') {
    require_authenticated_user_id();
    $code = require_active_obra_codigo();

    $sql = 'SELECT f.fase_id, f.fase, f.subfase, f.status, f.data_inicio, f.previsao_finalizacao, f.data_finalizacao,
                   f.responsavel_id, u.nome AS responsavel_nome,
                   COUNT(DISTINCT ft.fatura_id) AS faturas_count,
                   COUNT(DISTINCT d.docs_id) AS docs_count
            FROM uc_fases f
            LEFT JOIN uc_users u ON u.user_id = f.responsavel_id AND (' . uc_users_code_predicate('u.code') . ' OR u.tipo_usuario = ?)
            LEFT JOIN uc_faturas ft ON ft.fase_id = f.fase_id AND ' . uc_code_predicate_for_table('uc_faturas', 'ft.code') . '
            LEFT JOIN uc_documentacoes d ON (d.fase COLLATE utf8mb4_unicode_ci) = (f.fase COLLATE utf8mb4_unicode_ci) AND ' . uc_code_predicate_for_table('uc_documentacoes', 'd.code') . '
            WHERE ' . uc_code_predicate_for_table('uc_fases', 'f.code') . '
            GROUP BY f.fase_id, f.fase, f.subfase, f.status, f.data_inicio, f.previsao_finalizacao, f.data_finalizacao, f.responsavel_id, u.nome
            ORDER BY
                CAST(SUBSTRING_INDEX(f.fase, " ", 1) AS UNSIGNED) ASC,
                CAST(SUBSTRING_INDEX(COALESCE(f.subfase, ""), ".", 1) AS UNSIGNED) ASC,
                CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(COALESCE(f.subfase, ""), ".", -1), " ", 1) AS UNSIGNED) ASC,
                f.data_inicio ASC,
                f.fase_id ASC';
    $params = [$code, 'Owner', $code, $code, $code];

    try {
        $rows = fetch_all($sql, $params);
    } catch (Throwable $e) {
        json_response(['detail' => 'Erro interno ao carregar timeline', 'error' => $e->getMessage()], 500);
        exit;
    }

    $items = array_map(fn ($r) => [
        'faseId' => (string)$r['fase_id'],
        'fase' => (string)$r['fase'],
        'subfase' => $r['subfase'] !== null ? (string)$r['subfase'] : null,
        'status' => (string)($r['status'] ?? ''),
        'dataInicio' => (string)$r['data_inicio'],
        'previsaoFinalizacao' => (string)$r['previsao_finalizacao'],
        'dataFinalizacao' => $r['data_finalizacao'] !== null ? (string)$r['data_finalizacao'] : null,
        'responsavelId' => $r['responsavel_id'] !== null ? (string)$r['responsavel_id'] : null,
        'responsavelNome' => $r['responsavel_nome'] !== null ? (string)$r['responsavel_nome'] : null,
        'faturasCount' => (int)($r['faturas_count'] ?? 0),
        'docsCount' => (int)($r['docs_count'] ?? 0),
    ], $rows);
    json_response(['items' => $items]);
    exit;
}

if ($relativePath === '/documentacoes' && $method === 'GET') {
    require_authenticated_user_id();
    $code = require_active_obra_codigo();

    $q = trim((string)($_GET['q'] ?? ''));
    $status = trim((string)($_GET['status'] ?? ''));
    $fase = trim((string)($_GET['fase'] ?? ''));
    $subfase = trim((string)($_GET['subfase'] ?? ''));

    $sql = 'SELECT d.docs_id, d.documento, d.fase, d.subfase, d.fatura, d.dados_pagamento, d.data_inclusao, d.data_entrega,
                   d.status, d.tipo_assinatura, d.assinatura, d.responsavel_id, d.notas, d.arquivo_path, d.created_at, d.updated_at,
                   u.nome AS responsavel_nome, ua.nome AS assinatura_nome,
                   ft.descricao AS fatura_descricao
            FROM uc_documentacoes d
            LEFT JOIN uc_users u ON u.user_id = d.responsavel_id
            LEFT JOIN uc_users ua ON ua.user_id = d.assinatura
            LEFT JOIN uc_faturas ft ON ft.fatura_id = d.fatura AND ' . uc_code_predicate_for_table('uc_faturas', 'ft.code') . '
            WHERE ' . uc_code_predicate_for_table('uc_documentacoes', 'd.code');
    $params = [$code, $code];

    if ($q !== '') {
        $sql .= ' AND (LOWER(d.documento) LIKE ? OR LOWER(d.fase) LIKE ? OR LOWER(d.subfase) LIKE ? OR LOWER(u.nome) LIKE ?)';
        $like = '%' . strtolower($q) . '%';
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }
    if ($status !== '') {
        $sql .= ' AND d.status = ?';
        $params[] = $status;
    }
    if ($fase !== '') {
        $sql .= ' AND d.fase = ?';
        $params[] = $fase;
    }
    if ($subfase !== '') {
        $sql .= ' AND d.subfase = ?';
        $params[] = $subfase;
    }

    $sql .= ' ORDER BY d.data_inclusao DESC, d.docs_id DESC';
    try {
        $rows = fetch_all($sql, $params);
    } catch (Throwable $e) {
        json_response(['detail' => 'Erro interno ao listar documentações', 'error' => $e->getMessage()], 500);
        exit;
    }
    $items = array_map(fn ($r) => [
        'docsId' => (int)$r['docs_id'],
        'documento' => (string)$r['documento'],
        'fase' => (string)$r['fase'],
        'subfase' => (string)$r['subfase'],
        'faturaId' => $r['fatura'] !== null ? (string)$r['fatura'] : null,
        'faturaDescricao' => $r['fatura_descricao'] !== null ? (string)$r['fatura_descricao'] : null,
        'dadosPagamento' => $r['dados_pagamento'] !== null ? (string)$r['dados_pagamento'] : null,
        'dataInclusao' => (string)$r['data_inclusao'],
        'dataEntrega' => $r['data_entrega'] !== null ? (string)$r['data_entrega'] : null,
        'status' => (string)$r['status'],
        'tipoAssinatura' => (string)$r['tipo_assinatura'],
        'assinatura' => (string)$r['assinatura'],
        'assinaturaNome' => $r['assinatura_nome'] !== null ? (string)$r['assinatura_nome'] : null,
        'responsavelId' => $r['responsavel_id'] !== null ? (string)$r['responsavel_id'] : null,
        'responsavelNome' => $r['responsavel_nome'] !== null ? (string)$r['responsavel_nome'] : null,
        'notas' => $r['notas'] !== null ? (string)$r['notas'] : null,
        'arquivoPath' => $r['arquivo_path'] !== null ? (string)$r['arquivo_path'] : null,
        'arquivoUrl' => $r['arquivo_path'] !== null ? uc_public_api_url_for_path((string)$r['arquivo_path']) : null,
        'createdAt' => (string)$r['created_at'],
        'updatedAt' => (string)$r['updated_at'],
    ], $rows);
    json_response(['items' => $items]);
    exit;
}

if ($relativePath === '/documentacoes' && $method === 'POST') {
    global $FASES_FIXAS, $DOC_STATUS;
    require_authenticated_user_id();
    require_privileged_role();
    require_obra_cadastrada();
    $code = require_active_obra_codigo();

    $payload = parse_json_body();
    require_password_confirmation($payload);

    $documento = trim((string)($payload['documento'] ?? ''));
    if ($documento === '') {
        fail_validation('documento', 'Documento obrigatório');
    }
    $fase = trim((string)($payload['fase'] ?? ''));
    if ($fase === '') {
        fail_validation('fase', 'Fase obrigatória');
    }
    $subfase = optional_string($payload['subfase'] ?? null) ?? '';

    $status = trim((string)($payload['status'] ?? ''));
    if (!in_array($status, $DOC_STATUS, true)) {
        fail_validation('status', 'Status inválido');
    }

    $faturaRawMixed = $payload['fatura'] ?? ($payload['faturaId'] ?? ($payload['fatura_id'] ?? null));
    $faturaRaw = is_int($faturaRawMixed) ? (string)$faturaRawMixed : optional_string($faturaRawMixed);
    $faturaId = null;
    if (is_string($faturaRaw) && $faturaRaw !== '') {
        if (!ctype_digit($faturaRaw)) {
            fail_validation('fatura', 'Fatura inválida');
        }
        $faturaId = (int)$faturaRaw;
        if ($faturaId <= 0) {
            $faturaId = null;
        }
        if ($faturaId !== null) {
            $exists = fetch_one(
                'SELECT fatura_id FROM uc_faturas WHERE fatura_id = ? AND ' . uc_code_predicate_for_table('uc_faturas', 'code') . ' LIMIT 1',
                [$faturaId, $code]
            );
            if (!$exists) {
                fail_validation('fatura', 'Fatura não encontrada');
            }
        }
    }

    $tipoAssinatura = trim((string)($payload['tipo_assinatura'] ?? ($payload['tipoAssinatura'] ?? '')));
    if (!in_array($tipoAssinatura, ['Sem Assinatura', 'Assinatura Digital', 'Assinatura Gov', 'Assinatura Cartorio'], true)) {
        $tipoAssinatura = 'Sem Assinatura';
    }

    $assinatura = optional_string($payload['assinatura'] ?? null);
    if ($assinatura === null || $assinatura === '') {
        fail_validation('assinatura', 'Assinatura obrigatória');
    }

    $dadosPagamento = optional_string($payload['dados_pagamento'] ?? ($payload['dadosPagamento'] ?? null));
    // `uc_documentacoes.notas` no banco está NOT NULL.
    $notas = optional_string($payload['notas'] ?? '') ?? '';
    $dataInclusao = parse_datetime_or_null($payload['data_inclusao'] ?? ($payload['dataInclusao'] ?? ''), 'data_inclusao', false) ?? now_datetime_ms();
    $dataEntrega = parse_datetime_or_null($payload['data_entrega'] ?? ($payload['dataEntrega'] ?? ''), 'data_entrega', false);
    $arquivoPath = optional_string($payload['arquivo_path'] ?? ($payload['arquivoPath'] ?? null));

    $responsavelIdRawMixed = $payload['responsavel_id'] ?? ($payload['responsavelId'] ?? null);
    $responsavelIdRaw = is_int($responsavelIdRawMixed) ? (string)$responsavelIdRawMixed : optional_string($responsavelIdRawMixed);
    $responsavelId = null;
    if (is_string($responsavelIdRaw) && ctype_digit($responsavelIdRaw)) {
        $responsavelId = (int)$responsavelIdRaw;
        if ($responsavelId <= 0) {
            $responsavelId = null;
        }
    }

    $now = now_datetime_ms();
    $pdo = Database::connection();
    try {
        $stmt = $pdo->prepare('INSERT INTO uc_documentacoes (documento, fase, subfase, fatura, dados_pagamento, data_inclusao, data_entrega, status, tipo_assinatura, assinatura, responsavel_id, notas, arquivo_path, created_at, updated_at, code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $documento,
            $fase,
            $subfase,
            $faturaId,
            $dadosPagamento,
            $dataInclusao,
            $dataEntrega,
            $status,
            $tipoAssinatura,
            $assinatura,
            $responsavelId,
            $notas,
            $arquivoPath,
            $now,
            $now,
            $code,
        ]);
        $id = (int)$pdo->lastInsertId();
    } catch (Throwable $e) {
        json_response(['detail' => 'Erro ao salvar documentação', 'error' => $e->getMessage()], 500);
        exit;
    }

    json_response([
        'docsId' => $id,
        'documento' => $documento,
        'fase' => $fase,
        'subfase' => $subfase,
        'status' => $status,
        'faturaId' => $faturaId !== null ? (string)$faturaId : null,
        'tipoAssinatura' => $tipoAssinatura,
        'assinatura' => $assinatura,
    ], 201);
    exit;
}

if (preg_match('#^/documentacoes/(\\d+)$#', $relativePath, $m) && $method === 'PUT') {
    global $FASES_FIXAS, $DOC_STATUS;
    require_authenticated_user_id();
    require_privileged_role();
    require_obra_cadastrada();
    $code = require_active_obra_codigo();
    $docsId = (int)$m[1];

    $existing = fetch_one('SELECT * FROM uc_documentacoes WHERE docs_id = ? AND code = ? LIMIT 1', [$docsId, $code]);
    if (!$existing) {
        json_response(['detail' => 'Documentação não encontrada.'], 404);
        exit;
    }

    $payload = parse_json_body();
    require_password_confirmation($payload);

    $documento = trim((string)($payload['documento'] ?? ''));
    if ($documento === '') {
        fail_validation('documento', 'Documento obrigatório');
    }
    $fase = trim((string)($payload['fase'] ?? ''));
    if ($fase === '') {
        fail_validation('fase', 'Fase obrigatória');
    }
    $subfase = optional_string($payload['subfase'] ?? null) ?? '';

    $status = trim((string)($payload['status'] ?? ''));
    if (!in_array($status, $DOC_STATUS, true)) {
        fail_validation('status', 'Status inválido');
    }

    $faturaRawMixed = $payload['fatura'] ?? ($payload['faturaId'] ?? ($payload['fatura_id'] ?? null));
    $faturaRaw = is_int($faturaRawMixed) ? (string)$faturaRawMixed : optional_string($faturaRawMixed);
    $faturaId = null;
    if (is_string($faturaRaw) && $faturaRaw !== '') {
        if (!ctype_digit($faturaRaw)) {
            fail_validation('fatura', 'Fatura inválida');
        }
        $faturaId = (int)$faturaRaw;
        if ($faturaId <= 0) {
            $faturaId = null;
        }
        if ($faturaId !== null) {
            $exists = fetch_one(
                'SELECT fatura_id FROM uc_faturas WHERE fatura_id = ? AND ' . uc_code_predicate_for_table('uc_faturas', 'code') . ' LIMIT 1',
                [$faturaId, $code]
            );
            if (!$exists) {
                fail_validation('fatura', 'Fatura não encontrada');
            }
        }
    }

    $tipoAssinatura = trim((string)($payload['tipo_assinatura'] ?? ($payload['tipoAssinatura'] ?? '')));
    if ($tipoAssinatura === '') {
        $tipoAssinatura = (string)($existing['tipo_assinatura'] ?? 'Sem Assinatura');
    }
    if (!in_array($tipoAssinatura, ['Sem Assinatura', 'Assinatura Digital', 'Assinatura Gov', 'Assinatura Cartorio'], true)) {
        $tipoAssinatura = 'Sem Assinatura';
    }

    $assinatura = optional_string($payload['assinatura'] ?? null);
    if ($assinatura === null || $assinatura === '') {
        $assinatura = optional_string($existing['assinatura'] ?? '') ?? '';
    }
    if ($assinatura === '') {
        fail_validation('assinatura', 'Assinatura obrigatória');
    }

    $dadosPagamento = optional_string($payload['dados_pagamento'] ?? ($payload['dadosPagamento'] ?? null));
    // `uc_documentacoes.notas` no banco está NOT NULL.
    $notas = optional_string($payload['notas'] ?? '') ?? '';
    $dataInclusao = parse_datetime_or_null($payload['data_inclusao'] ?? ($payload['dataInclusao'] ?? ''), 'data_inclusao', false) ?? (string)($existing['data_inclusao'] ?? now_datetime_ms());
    $dataEntrega = parse_datetime_or_null($payload['data_entrega'] ?? ($payload['dataEntrega'] ?? ''), 'data_entrega', false);
    $arquivoPath = optional_string($payload['arquivo_path'] ?? ($payload['arquivoPath'] ?? null)) ?? ($existing['arquivo_path'] ?? null);

    $responsavelIdRawMixed = $payload['responsavel_id'] ?? ($payload['responsavelId'] ?? null);
    $responsavelIdRaw = is_int($responsavelIdRawMixed) ? (string)$responsavelIdRawMixed : optional_string($responsavelIdRawMixed);
    $responsavelId = null;
    if (is_string($responsavelIdRaw) && ctype_digit($responsavelIdRaw)) {
        $responsavelId = (int)$responsavelIdRaw;
        if ($responsavelId <= 0) {
            $responsavelId = null;
        }
    }

    $pdo = Database::connection();
    try {
        $stmt = $pdo->prepare('UPDATE uc_documentacoes SET documento = ?, fase = ?, subfase = ?, fatura = ?, dados_pagamento = ?, data_inclusao = ?, data_entrega = ?, status = ?, tipo_assinatura = ?, assinatura = ?, responsavel_id = ?, notas = ?, arquivo_path = ?, updated_at = ? WHERE docs_id = ? AND code = ?');
        $stmt->execute([
            $documento,
            $fase,
            $subfase,
            $faturaId,
            $dadosPagamento,
            $dataInclusao,
            $dataEntrega,
            $status,
            $tipoAssinatura,
            $assinatura,
            $responsavelId,
            $notas,
            $arquivoPath,
            now_datetime_ms(),
            $docsId,
            $code,
        ]);
    } catch (Throwable $e) {
        json_response(['detail' => 'Erro ao atualizar documentação', 'error' => $e->getMessage()], 500);
        exit;
    }

    $row = fetch_one(
        'SELECT d.docs_id, d.documento, d.fase, d.subfase, d.fatura, d.dados_pagamento, d.data_inclusao, d.data_entrega,
                d.status, d.tipo_assinatura, d.assinatura, d.responsavel_id, d.notas, d.arquivo_path, d.created_at, d.updated_at,
                u.nome AS responsavel_nome, ua.nome AS assinatura_nome,
                ft.descricao AS fatura_descricao
         FROM uc_documentacoes d
         LEFT JOIN uc_users u ON u.user_id = d.responsavel_id
         LEFT JOIN uc_users ua ON ua.user_id = d.assinatura
         LEFT JOIN uc_faturas ft ON ft.fatura_id = d.fatura
         WHERE d.docs_id = ? AND d.code = ?',
        [$docsId, $code]
    );
    json_response([
        'docsId' => (int)($row['docs_id'] ?? $docsId),
        'documento' => $row['documento'] ?? $documento,
        'fase' => $row['fase'] ?? $fase,
        'subfase' => $row['subfase'] ?? $subfase,
        'faturaId' => ($row && array_key_exists('fatura', $row) && $row['fatura'] !== null) ? (string)$row['fatura'] : ($faturaId !== null ? (string)$faturaId : null),
        'faturaDescricao' => ($row && array_key_exists('fatura_descricao', $row) && $row['fatura_descricao'] !== null) ? (string)$row['fatura_descricao'] : null,
        'dadosPagamento' => $row['dados_pagamento'] ?? $dadosPagamento,
        'dataInclusao' => $row['data_inclusao'] ?? $dataInclusao,
        'dataEntrega' => $row['data_entrega'] ?? $dataEntrega,
        'status' => $row['status'] ?? $status,
        'tipoAssinatura' => $row['tipo_assinatura'] ?? $tipoAssinatura,
        'assinatura' => $row['assinatura'] ?? $assinatura,
        'assinaturaNome' => $row['assinatura_nome'] ?? null,
        'responsavelId' => $row['responsavel_id'] ?? $responsavelId,
        'responsavelNome' => $row['responsavel_nome'] ?? null,
        'notas' => $row['notas'] ?? $notas,
        'arquivoPath' => $row['arquivo_path'] ?? $arquivoPath,
        'arquivoUrl' => ($row['arquivo_path'] ?? $arquivoPath) ? uc_public_api_url_for_path((string)($row['arquivo_path'] ?? $arquivoPath)) : null,
        'createdAt' => $row['created_at'] ?? null,
        'updatedAt' => $row['updated_at'] ?? null,
    ]);
    exit;
}

if (preg_match('#^/documentacoes/(\\d+)$#', $relativePath, $m) && $method === 'DELETE') {
    require_authenticated_user_id();
    require_privileged_role();
    require_obra_cadastrada();
    $code = require_active_obra_codigo();
    $docsId = (int)$m[1];

    $payload = parse_json_body();
    require_password_confirmation($payload);

    $row = fetch_one('SELECT docs_id FROM uc_documentacoes WHERE docs_id = ? AND code = ? LIMIT 1', [$docsId, $code]);
    if (!$row) {
        json_response(['detail' => 'Documentação não encontrada.'], 404);
        exit;
    }

    $pdo = Database::connection();
    $stmt = $pdo->prepare('DELETE FROM uc_documentacoes WHERE docs_id = ? AND code = ?');
    $stmt->execute([$docsId, $code]);
    http_response_code(204);
    exit;
}

if ($relativePath === '/debug/export-logs' && $method === 'GET') {
    $debug = filter_var(getenv('APP_DEBUG'), FILTER_VALIDATE_BOOL);
    if (!$debug) {
        require_privileged_role();
    }
    $dir = getenv('LOG_DIR') ?: 'logs';
    $days = (int)($_GET['days'] ?? 1);
    if ($days < 1) $days = 1;
    if ($days > 3) $days = 3;
    $limit = (int)($_GET['limit'] ?? 500);
    if ($limit < 1) $limit = 1;
    if ($limit > 1000) $limit = 1000;
    $requestIdFilter = trim((string)($_GET['request_id'] ?? ''));

    $streams = ['app', 'error', 'client'];
    $today = new DateTimeImmutable('today');
    $files = [];
    for ($i = 0; $i < $days; $i++) {
        $date = $today->modify("-{$i} days")->format('Y-m-d');
        foreach ($streams as $s) {
            $path = rtrim($dir, '/') . "/{$s}-{$date}.jsonl";
            if (is_file($path)) {
                $files[] = $path;
            }
        }
    }

    $items = [];
    foreach ($files as $file) {
        $lines = @file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if (!is_array($lines)) {
            continue;
        }
        foreach ($lines as $line) {
            $decoded = json_decode($line, true);
            if (!is_array($decoded)) {
                continue;
            }
            if ($requestIdFilter !== '' && ($decoded['request_id'] ?? '') !== $requestIdFilter) {
                continue;
            }
            $items[] = $decoded;
            if (count($items) >= $limit) {
                break 2;
            }
        }
    }

    json_response(['items' => $items]);
    exit;
}

if ($relativePath === '/faturas' && $method === 'GET') {
    require_authenticated_user_id();
    $code = require_active_obra_codigo();

    $q = trim((string)($_GET['q'] ?? ''));
    $pagamento = trim((string)($_GET['pagamento'] ?? ''));
    $status = trim((string)($_GET['status'] ?? ''));
    $faseId = trim((string)($_GET['fase_id'] ?? ''));

    $sql = 'SELECT ft.fatura_id, ft.data, ft.lancamento, ft.data_pagamento, ft.dados_pagamento, ft.nfe, ft.notas, ft.status, ft.pagamento,
                   ft.valor, ft.quantidade, ft.descricao, ft.total, ft.fase_id, ft.responsavel_id, ft.empresa_id,
                   ft.subfase,
                   ft.created_at, ft.updated_at,
                   f.fase AS fase_nome,
                   ur.nome AS responsavel_nome,
                   ue.nome AS empresa_nome
            FROM uc_faturas ft
            LEFT JOIN uc_fases f ON f.fase_id = ft.fase_id
            LEFT JOIN uc_users ur ON ur.user_id = ft.responsavel_id AND (' . uc_users_code_predicate('ur.code') . ' OR ur.tipo_usuario = ?)
            LEFT JOIN uc_users ue ON ue.user_id = ft.empresa_id AND (' . uc_users_code_predicate('ue.code') . ' OR ue.tipo_usuario = ?)
            WHERE ' . uc_code_predicate_for_table('uc_faturas', 'ft.code');
    // Ordem dos placeholders no SQL:
    // 1) ur.code, 2) ur.tipo_usuario, 3) ue.code, 4) ue.tipo_usuario, 5) ft.code
    $params = [$code, 'Owner', $code, 'Owner', $code];

    if ($q !== '') {
        $sql .= ' AND (LOWER(ft.descricao) LIKE ? OR LOWER(f.fase) LIKE ? OR LOWER(ur.nome) LIKE ? OR LOWER(ue.nome) LIKE ?)';
        $like = '%' . strtolower($q) . '%';
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
        $params[] = $like;
    }
    if ($pagamento !== '') {
        $sql .= ' AND ft.pagamento = ?';
        $params[] = $pagamento;
    }
    if ($status !== '') {
        $sql .= ' AND ft.status = ?';
        $params[] = $status;
    }
    if ($faseId !== '' && ctype_digit($faseId)) {
        $sql .= ' AND ft.fase_id = ?';
        $params[] = (int)$faseId;
    }

    $sql .= ' ORDER BY ft.data DESC, ft.lancamento DESC';
    $rows = fetch_all($sql, $params);
    $items = array_map(fn ($r) => [
        'faturaId' => (string)$r['fatura_id'],
        'fatura' => (string)$r['descricao'],
        'data' => (string)$r['data'],
        'lancamento' => (string)$r['lancamento'],
        'dataPagamento' => $r['data_pagamento'] !== null ? (string)$r['data_pagamento'] : null,
        'dadosPagamento' => $r['dados_pagamento'] !== null ? (string)$r['dados_pagamento'] : null,
        'nfe' => $r['nfe'] !== null ? (string)$r['nfe'] : null,
        'notas' => $r['notas'] !== null ? (string)$r['notas'] : '',
        'status' => (string)$r['status'],
        'pagamento' => (string)$r['pagamento'],
        'valor' => (string)$r['valor'],
        'quantidade' => (int)$r['quantidade'],
        'total' => (string)$r['total'],
        'faseId' => (string)$r['fase_id'],
        'faseNome' => $r['fase_nome'] !== null ? (string)$r['fase_nome'] : null,
        'subfase' => $r['subfase'] !== null ? (string)$r['subfase'] : '',
        'responsavelId' => $r['responsavel_id'] !== null ? (string)$r['responsavel_id'] : null,
        'responsavelNome' => $r['responsavel_nome'] !== null ? (string)$r['responsavel_nome'] : null,
        'empresaId' => $r['empresa_id'] !== null ? (string)$r['empresa_id'] : null,
        'empresaNome' => $r['empresa_nome'] !== null ? (string)$r['empresa_nome'] : null,
        'createdAt' => (string)$r['created_at'],
        'updatedAt' => (string)$r['updated_at'],
    ], $rows);
    json_response(['items' => $items]);
    exit;
}

if ($relativePath === '/cadastros' && $method === 'POST') {
    require_authenticated_user_id();
    require_privileged_role();
    require_obra_cadastrada();
    $code = require_active_obra_codigo();

    $payload = parse_json_body();

    $tipoUsuario = (string)($payload['tipo_usuario'] ?? '');
    $allowedTipos = [
        'Owner',
        'Proprietario',
        'Gerente',
        'Engenheiro',
        'Arquiteto',
        'Operacional',
        'Pedreiro',
        'Ajudante',
        'Fornecedor',
        'Fiscalizacao',
    ];
    if (!in_array($tipoUsuario, $allowedTipos, true)) {
        fail_validation('tipo_usuario', 'Tipo de usuário inválido');
    }
    if ($tipoUsuario === 'Owner') {
        $existingOwner = fetch_one(
            'SELECT user_id FROM uc_users WHERE ' . uc_users_code_predicate('code') . ' AND tipo_usuario = ? LIMIT 1',
            [$code, 'Owner']
        );
        if ($existingOwner) {
            json_response(['detail' => 'Já existe um Owner para este código.'], 409);
            exit;
        }
    }

    $email = trim((string)($payload['email'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail_validation('email', 'Email inválido');
    }

    // Localiza principal desse email (se existir) -> sempre o cadastro mais antigo.
    $principal = fetch_one('SELECT * FROM uc_users WHERE LOWER(email) = ? ORDER BY user_id ASC LIMIT 1', [strtolower($email)]);
    $principalId = $principal ? (int)$principal['user_id'] : 0;

    // Regra: não pode existir 2 perfis no mesmo código (obra).
    // Se já existe algum perfil dessa pessoa (email) na obra atual, bloqueia.
    $existingInCode = fetch_one(
        'SELECT user_id FROM uc_users WHERE LOWER(email) = ? AND ' . uc_users_code_predicate('code') . ' LIMIT 1',
        [strtolower($email), $code]
    );
    if ($existingInCode) {
        json_response(['detail' => 'Este usuário já possui um cadastro nesta obra.'], 409);
        exit;
    }

    // Se email já existe, copia dados do principal (menos tipo_usuario).
    // Cada obra pode ter um tipo diferente.
    if ($principal) {
        $nome = (string)$principal['nome'];
        $cpfCnpj = (string)$principal['cpf_cnpj'];
        $telefone = (string)$principal['telefone'];
        $endereco = (string)$principal['endereco'];
        $status = (string)$principal['status'];
        $foto = optional_string($principal['foto'] ?? null);
        $notas = optional_string($payload['notas'] ?? ($principal['notas'] ?? null));
        $passwordHash = (string)$principal['password_hash'];
    } else {
        $nome = trim((string)($payload['nome'] ?? ''));
        if ($nome === '') {
            fail_validation('nome', 'Nome é obrigatório');
        }
        $cpfCnpj = trim((string)($payload['cpf_cnpj'] ?? ''));
        if ($cpfCnpj === '') {
            fail_validation('cpf_cnpj', 'CPF/CNPJ é obrigatório');
        }
        $telefone = trim((string)($payload['telefone'] ?? ''));
        if ($telefone === '') {
            fail_validation('telefone', 'Telefone é obrigatório');
        }
        $endereco = trim((string)($payload['endereco'] ?? ''));
        if ($endereco === '') {
            fail_validation('endereco', 'Endereço é obrigatório');
        }
        $status = (string)($payload['status'] ?? '');
        if (!in_array($status, ['ATIVO', 'INATIVO'], true)) {
            fail_validation('status', 'Status inválido');
        }
        $foto = optional_string($payload['foto'] ?? null);
        $notas = optional_string($payload['notas'] ?? null);
        $resetSenha = (bool)($payload['reset_senha'] ?? false);
        $passwordHash = password_hash('UnderConstruction', PASSWORD_DEFAULT);
        if ($resetSenha) {
            // nada extra
        }
    }

    $pdo = Database::connection();
    try {
        $stmt = $pdo->prepare('INSERT INTO uc_users (code, foto, tipo_usuario, nome, cpf_cnpj, telefone, endereco, email, notas, status, password_hash, id_principal) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $code,
            $foto,
            $tipoUsuario,
            $nome,
            $cpfCnpj,
            $telefone,
            $endereco,
            $email,
            $notas,
            $status,
            $passwordHash,
            $principalId > 0 ? $principalId : null,
        ]);
    } catch (PDOException $e) {
        throw $e;
    }

    $userId = (int)$pdo->lastInsertId();
    // Se for novo principal (não havia email), define id_principal = próprio user_id
    if (!$principal) {
        try {
            $stmt = $pdo->prepare('UPDATE uc_users SET id_principal = ? WHERE user_id = ?');
            $stmt->execute([$userId, $userId]);
        } catch (Throwable $e) {
            // ignora
        }
        $principalId = $userId;
    }

    json_response([
        'userId' => $userId,
        'idPrincipal' => (int)$principalId,
        'nome' => $nome,
        'email' => $email,
        'tipoUsuario' => $tipoUsuario,
        'status' => $status,
    ], 201);
    exit;
}

if (preg_match('#^/cadastros/([^/]+)$#', $relativePath, $m) && $method === 'PUT') {
    $currentUserId = require_authenticated_user_id();
    require_privileged_role();
    require_obra_cadastrada();
    $code = require_active_obra_codigo();
    $userId = trim((string)$m[1]);
    if ($userId === '') {
        json_response(['detail' => 'user_id inválido.'], 400);
        exit;
    }

    $existing = fetch_one(
        'SELECT * FROM uc_users WHERE user_id = ? AND (code = ? OR tipo_usuario = "Owner") LIMIT 1',
        [$userId, $code]
    );
    if (!$existing) {
        json_response(['detail' => 'Usuário não encontrado.'], 404);
        exit;
    }

    if ((string)($existing['tipo_usuario'] ?? '') === 'Owner' && (string)$existing['user_id'] !== (string)$currentUserId) {
        json_response(['detail' => 'Apenas o próprio Owner pode se editar.'], 403);
        exit;
    }

    $payload = parse_json_body();

    $tipoUsuario = (string)($payload['tipo_usuario'] ?? '');
    $allowedTipos = [
        'Owner',
        'Proprietario',
        'Gerente',
        'Engenheiro',
        'Arquiteto',
        'Operacional',
        'Pedreiro',
        'Ajudante',
        'Fornecedor',
        'Fiscalizacao',
    ];
    if (!in_array($tipoUsuario, $allowedTipos, true)) {
        fail_validation('tipo_usuario', 'Tipo de usuário inválido');
    }
    if ($tipoUsuario === 'Owner') {
        if (!is_owner_authenticated() || (string)$userId !== (string)$currentUserId) {
            json_response(['detail' => 'Apenas o próprio Owner pode definir/alterar Owner.'], 403);
            exit;
        }
        $existingOwner = fetch_one(
            'SELECT user_id FROM uc_users WHERE ' . uc_users_code_predicate('code') . ' AND tipo_usuario = ? AND user_id != ? LIMIT 1',
            [$code, 'Owner', (int)$userId]
        );
        if ($existingOwner) {
            json_response(['detail' => 'Já existe um Owner para este código.'], 409);
            exit;
        }
    }

    $nome = trim((string)($payload['nome'] ?? ''));
    if ($nome === '') {
        fail_validation('nome', 'Nome é obrigatório');
    }
    $cpfCnpj = trim((string)($payload['cpf_cnpj'] ?? ''));
    if ($cpfCnpj === '') {
        fail_validation('cpf_cnpj', 'CPF/CNPJ é obrigatório');
    }
    $telefone = trim((string)($payload['telefone'] ?? ''));
    if ($telefone === '') {
        fail_validation('telefone', 'Telefone é obrigatório');
    }
    $endereco = trim((string)($payload['endereco'] ?? ''));
    if ($endereco === '') {
        fail_validation('endereco', 'Endereço é obrigatório');
    }
    $email = trim((string)($payload['email'] ?? ''));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        fail_validation('email', 'Email inválido');
    }
    $status = (string)($payload['status'] ?? '');
    if (!in_array($status, ['ATIVO', 'INATIVO'], true)) {
        fail_validation('status', 'Status inválido');
    }

    $foto = optional_string($payload['foto'] ?? null);
    $notas = optional_string($payload['notas'] ?? null);
    $resetSenha = (bool)($payload['reset_senha'] ?? false);

    $now = now_datetime_ms();

    $principalId = (int)($existing['id_principal'] ?? 0);
    if ($principalId <= 0) {
        $principalId = (int)$existing['user_id'];
    }

    $pdo = Database::connection();
    try {
        $where = ' WHERE user_id = ? AND ' . uc_users_code_predicate('code');
        $whereParams = [$userId, $code];
        if ((string)($existing['tipo_usuario'] ?? '') === 'Owner') {
            $where = ' WHERE user_id = ?';
            $whereParams = [$userId];
        }

        $sql = 'UPDATE uc_users
                SET foto = ?, tipo_usuario = ?, nome = ?, cpf_cnpj = ?, telefone = ?, endereco = ?, email = ?, notas = ?, status = ?, updated_at = ?';
        $params = [
            $foto,
            $tipoUsuario,
            $nome,
            $cpfCnpj,
            $telefone,
            $endereco,
            $email,
            $notas,
            $status,
            $now,
        ];
        $newHash = null;
        if ($resetSenha) {
            $newHash = password_hash('UnderConstruction', PASSWORD_DEFAULT);
            $sql .= ', password_hash = ?';
            $params[] = $newHash;
        }
        $sql .= $where;
        $params = array_merge($params, $whereParams);

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        // Se resetou a senha e este registro não é o principal, aplica também no principal
        if ($resetSenha && (int)$userId !== $principalId && $newHash !== null) {
            $stmtP = $pdo->prepare('UPDATE uc_users SET password_hash = ?, updated_at = updated_at WHERE user_id = ?');
            $stmtP->execute([$newHash, $principalId]);
        }
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            json_response(['detail' => 'CPF/CNPJ ou email já cadastrado.'], 409);
            exit;
        }
        throw $e;
    }

    $row = fetch_one(
        'SELECT user_id, foto, tipo_usuario, nome, cpf_cnpj, telefone, endereco, email, notas, status, created_at, updated_at FROM uc_users WHERE user_id = ? AND (code = ? OR tipo_usuario = "Owner") LIMIT 1',
        [$userId, $code]
    );
    json_response([
        'userId' => (string)$row['user_id'],
        'foto' => $row['foto'] !== null ? (string)$row['foto'] : null,
        'tipoUsuario' => (string)$row['tipo_usuario'],
        'nome' => (string)$row['nome'],
        'cpfCnpj' => (string)$row['cpf_cnpj'],
        'telefone' => (string)$row['telefone'],
        'endereco' => (string)$row['endereco'],
        'email' => (string)$row['email'],
        'notas' => $row['notas'] !== null ? (string)$row['notas'] : null,
        'status' => (string)$row['status'],
        'createdAt' => (string)$row['created_at'],
        'updatedAt' => (string)$row['updated_at'],
    ]);
    exit;
}

if (preg_match('#^/cadastros/(\\d+)$#', $relativePath, $m) && $method === 'DELETE') {
    $currentUserId = require_authenticated_user_id();
    require_privileged_role();
    require_obra_cadastrada();
    $code = require_active_obra_codigo();
    $targetId = (int)$m[1];

    $payload = parse_json_body();
    $password = trim((string)($payload['password'] ?? ''));
    if ($password === '') {
        json_response(['detail' => 'Senha é obrigatória.'], 400);
        exit;
    }
    verify_current_user_password($password);

    $row = fetch_one(
        'SELECT user_id, tipo_usuario, id_principal, code FROM uc_users WHERE user_id = ? LIMIT 1',
        [$targetId]
    );
    if (!$row) {
        json_response(['detail' => 'Usuário não encontrado.'], 404);
        exit;
    }
    if ((string)($row['tipo_usuario'] ?? '') === 'Owner' && (string)$row['user_id'] !== (string)$currentUserId) {
        json_response(['detail' => 'Apenas o próprio Owner pode se excluir.'], 403);
        exit;
    }
    if ((string)($row['tipo_usuario'] ?? '') !== 'Owner' && (string)($row['code'] ?? '') !== (string)$code) {
        json_response(['detail' => 'Usuário não encontrado.'], 404);
        exit;
    }

    $principalId = (int)($row['id_principal'] ?? 0);
    if ($principalId <= 0) {
        $principalId = (int)$row['user_id'];
    }

    $pdo = Database::connection();
    // Se for o principal, apaga todos vinculados.
    if ($principalId === (int)$row['user_id']) {
        $stmt = $pdo->prepare('DELETE FROM uc_users WHERE id_principal = ? OR user_id = ?');
        $stmt->execute([$principalId, $principalId]);
    } else {
        $stmt = $pdo->prepare('DELETE FROM uc_users WHERE user_id = ?');
        $stmt->execute([$targetId]);
    }
    http_response_code(204);
    exit;
}

if ($relativePath === '/fases' && $method === 'POST') {
    global $FASES_FIXAS;
    require_authenticated_user_id();
    require_privileged_role();
    require_obra_cadastrada();
    $code = require_active_obra_codigo();

    $payload = parse_json_body();

    $fase = trim((string)($payload['fase'] ?? ''));
    if ($fase === '') {
        fail_validation('fase', 'Fase obrigatória');
    }
    if (!array_key_exists($fase, $FASES_FIXAS)) {
        fail_validation('fase', 'Fase inválida');
    }
    $subfase = trim((string)($payload['subfase'] ?? ''));
    $allowedSubs = $FASES_FIXAS[$fase] ?? [];
    if ($subfase === '' && $allowedSubs !== []) {
        $subfase = $allowedSubs[0];
    }
    if ($subfase === '' || !in_array($subfase, $allowedSubs, true)) {
        fail_validation('subfase', 'Subfase inválida para esta fase');
    }
    $allowedSubs = $FASES_FIXAS[$fase] ?? [];
    $subfase = trim((string)($payload['subfase'] ?? ''));
    if ($subfase === '' && $allowedSubs !== []) {
        $subfase = $allowedSubs[0];
    }
    if ($subfase === '' || !in_array($subfase, $allowedSubs, true)) {
        fail_validation('subfase', 'Subfase inválida para esta fase');
    }

    $status = (string)($payload['status'] ?? '');
    $allowedStatus = ['ABERTO', 'ANDAMENTO', 'PENDENTE', 'FINALIZADO'];
    if (!in_array($status, $allowedStatus, true)) {
        fail_validation('status', 'Status inválido');
    }

    $dataInicio = parse_datetime_or_null($payload['data_inicio'] ?? '', 'data_inicio', true);
    $previsaoFinalizacao = parse_datetime_or_null($payload['previsao_finalizacao'] ?? '', 'previsao_finalizacao', true);
    $dataFinalizacao = parse_datetime_or_null($payload['data_finalizacao'] ?? '', 'data_finalizacao', false);

    $responsavelIdRaw = optional_string($payload['responsavel_id'] ?? null);
    $responsavelId = null;
    if ($responsavelIdRaw !== null && ctype_digit($responsavelIdRaw)) {
        $responsavelId = (int)$responsavelIdRaw;
    }
    $valorPrevisao = normalize_decimal($payload['valor_previsao'] ?? null, 'valor_previsao', 2, true);
    $notas = optional_string($payload['notas'] ?? null);

    $pdo = Database::connection();
    $stmt = $pdo->prepare('INSERT INTO uc_fases (code, fase, subfase, status, data_inicio, previsao_finalizacao, data_finalizacao, responsavel_id, valor_previsao, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $code,
        $fase,
        $subfase,
        $status,
        $dataInicio,
        $previsaoFinalizacao,
        $dataFinalizacao,
        $responsavelId,
        $valorPrevisao,
        $notas,
    ]);

    $faseId = (int)$pdo->lastInsertId();
    json_response([
        'faseId' => $faseId,
        'fase' => $fase,
        'status' => $status,
    ], 201);
    exit;
}

if (preg_match('#^/fases/(\\d+)$#', $relativePath, $m) && $method === 'PUT') {
    global $FASES_FIXAS;
    require_authenticated_user_id();
    require_privileged_role();
    require_obra_cadastrada();
    $code = require_active_obra_codigo();
    $faseId = (int)$m[1];

    $existing = fetch_one('SELECT * FROM uc_fases WHERE fase_id = ? AND code = ? LIMIT 1', [$faseId, $code]);
    if (!$existing) {
        json_response(['detail' => 'Fase não encontrada.'], 404);
        exit;
    }

    $payload = parse_json_body();

    $fase = trim((string)($payload['fase'] ?? ''));
    if ($fase === '') {
        fail_validation('fase', 'Fase obrigatória');
    }
    if (!array_key_exists($fase, $FASES_FIXAS)) {
        fail_validation('fase', 'Fase inválida');
    }
    $subfase = trim((string)($payload['subfase'] ?? ''));
    $allowedSubs = $FASES_FIXAS[$fase] ?? [];
    if ($subfase === '' && $allowedSubs !== []) {
        $subfase = $allowedSubs[0];
    }
    if ($subfase === '' || !in_array($subfase, $allowedSubs, true)) {
        fail_validation('subfase', 'Subfase inválida para esta fase');
    }
    $status = (string)($payload['status'] ?? '');
    $allowedStatus = ['ABERTO', 'ANDAMENTO', 'PENDENTE', 'FINALIZADO'];
    if (!in_array($status, $allowedStatus, true)) {
        fail_validation('status', 'Status inválido');
    }

    $dataInicio = parse_datetime_or_null($payload['data_inicio'] ?? '', 'data_inicio', true);
    $previsaoFinalizacao = parse_datetime_or_null($payload['previsao_finalizacao'] ?? '', 'previsao_finalizacao', true);
    $dataFinalizacao = parse_datetime_or_null($payload['data_finalizacao'] ?? '', 'data_finalizacao', false);

    $responsavelIdRaw = optional_string($payload['responsavel_id'] ?? null);
    $responsavelId = null;
    if ($responsavelIdRaw !== null && ctype_digit($responsavelIdRaw)) {
        $responsavelId = (int)$responsavelIdRaw;
    }

    $valorPrevisao = normalize_decimal($payload['valor_previsao'] ?? null, 'valor_previsao', 2, true);
    $notas = optional_string($payload['notas'] ?? null);

    $pdo = Database::connection();
    try {
        $stmt = $pdo->prepare('UPDATE uc_fases SET fase = ?, subfase = ?, status = ?, data_inicio = ?, previsao_finalizacao = ?, data_finalizacao = ?, responsavel_id = ?, valor_previsao = ?, notas = ? WHERE fase_id = ? AND code = ?');
        $stmt->execute([
            $fase,
            $subfase,
            $status,
            $dataInicio,
            $previsaoFinalizacao,
            $dataFinalizacao,
            $responsavelId,
            $valorPrevisao,
            $notas,
            $faseId,
            $code,
        ]);
    } catch (Throwable $e) {
        json_response(['detail' => 'Erro ao atualizar fase', 'error' => $e->getMessage()], 500);
        exit;
    }

    // Observação: no schema atual, as faturas referenciam a fase por `fase_id` (FK),
    // então o "nome da fase" aparece automaticamente atualizado via JOIN — não existe coluna de nome na uc_faturas.

    try {
        $row = fetch_one(
            'SELECT f.fase_id, f.fase, f.subfase, f.status, f.data_inicio, f.previsao_finalizacao, f.data_finalizacao, f.responsavel_id,
                    f.valor_previsao, f.notas, f.created_at, f.updated_at,
                    u.nome AS responsavel_nome,
                    COALESCE(SUM(ft.total), 0) AS valor_atual
             FROM uc_fases f
             LEFT JOIN uc_users u ON u.user_id = f.responsavel_id
             LEFT JOIN uc_faturas ft ON ft.fase_id = f.fase_id AND ' . uc_code_predicate_for_table('uc_faturas', 'ft.code') . '
             WHERE f.fase_id = ? AND f.code = ?
             GROUP BY f.fase_id, f.fase, f.subfase, f.status, f.data_inicio, f.previsao_finalizacao, f.data_finalizacao, f.responsavel_id, f.valor_previsao, f.notas, f.created_at, f.updated_at, u.nome',
            [$faseId, $code]
        );
    } catch (Throwable $e) {
        $row = false;
    }
    if ($row === false) {
        // fallback: usa dados enviados, pois update já foi realizado
        $row = [
            'fase_id' => $faseId,
            'fase' => $fase,
            'subfase' => $subfase,
            'status' => $status,
            'data_inicio' => $dataInicio,
            'previsao_finalizacao' => $previsaoFinalizacao,
            'data_finalizacao' => $dataFinalizacao,
            'responsavel_id' => $responsavelId,
            'responsavel_nome' => null,
            'valor_previsao' => $valorPrevisao,
            'valor_atual' => '0',
            'notas' => $notas,
            'created_at' => $existing['created_at'] ?? now_datetime_ms(),
            'updated_at' => now_datetime_ms(),
        ];
    }
    json_response([
        'faseId' => (int)$row['fase_id'],
        'fase' => (string)$row['fase'],
        'subfase' => (string)$row['subfase'],
        'status' => (string)$row['status'],
        'dataInicio' => (string)$row['data_inicio'],
        'previsaoFinalizacao' => (string)$row['previsao_finalizacao'],
        'dataFinalizacao' => $row['data_finalizacao'] !== null ? (string)$row['data_finalizacao'] : null,
        'responsavelId' => $row['responsavel_id'] !== null ? (int)$row['responsavel_id'] : null,
        'responsavelNome' => $row['responsavel_nome'] !== null ? (string)$row['responsavel_nome'] : null,
        'valorPrevisao' => (string)$row['valor_previsao'],
        'valorAtual' => (string)$row['valor_atual'],
        'notas' => $row['notas'] !== null ? (string)$row['notas'] : null,
        'createdAt' => (string)$row['created_at'],
        'updatedAt' => (string)$row['updated_at'],
    ]);
    exit;
}

if (preg_match('#^/fases/(\\d+)$#', $relativePath, $m) && $method === 'DELETE') {
    require_authenticated_user_id();
    require_privileged_role();
    require_obra_cadastrada();
    $code = require_active_obra_codigo();
    $faseId = (int)$m[1];

    $payload = parse_json_body();
    $password = trim((string)($payload['password'] ?? ''));
    if ($password === '') {
        json_response(['detail' => 'Senha é obrigatória.'], 400);
        exit;
    }
    verify_current_user_password($password);

    $row = fetch_one('SELECT fase_id FROM uc_fases WHERE fase_id = ? AND code = ? LIMIT 1', [$faseId, $code]);
    if (!$row) {
        json_response(['detail' => 'Fase não encontrada.'], 404);
        exit;
    }

    // FK em uc_faturas tem ON DELETE CASCADE para fase_id
    $pdo = Database::connection();
    $stmt = $pdo->prepare('DELETE FROM uc_fases WHERE fase_id = ? AND code = ?');
    $stmt->execute([$faseId, $code]);
    http_response_code(204);
    exit;
}

if ($relativePath === '/faturas' && $method === 'POST') {
    require_authenticated_user_id();
    require_privileged_role();
    require_obra_cadastrada();
    $code = require_active_obra_codigo();

    $payload = parse_json_body();

    $descricao = trim((string)($payload['descricao'] ?? ''));
    if ($descricao === '') {
        fail_validation('descricao', 'Descrição obrigatória');
    }

    $data = parse_datetime_or_null($payload['data'] ?? '', 'data', true);
    $lancamento = parse_datetime_or_null($payload['lancamento'] ?? '', 'lancamento', false) ?? now_datetime_ms();

    $pagamento = (string)($payload['pagamento'] ?? '');
    $allowedPagamento = ['aberto', 'pendente', 'pago'];
    if (!in_array($pagamento, $allowedPagamento, true)) {
        fail_validation('pagamento', 'Pagamento inválido');
    }

    $status = (string)($payload['status'] ?? '');
    if (!in_array($status, ['ATIVO', 'INATIVO'], true)) {
        fail_validation('status', 'Status inválido');
    }

    $valor = normalize_decimal($payload['valor'] ?? null, 'valor', 2, true);
    $quantidade = normalize_int($payload['quantidade'] ?? null, 'quantidade', true);
    if ($quantidade < 0) {
        fail_validation('quantidade', 'Quantidade deve ser positiva');
    }
    $total = normalize_decimal((float)$valor * (float)$quantidade, 'total', 2, true);

    $faseIdRaw = trim((string)($payload['fase_id'] ?? ''));
    if ($faseIdRaw === '' || !ctype_digit($faseIdRaw)) {
        fail_validation('fase_id', 'Fase obrigatória');
    }
    $faseId = (int)$faseIdRaw;

    $subfase = trim((string)($payload['subfase'] ?? ''));
    if ($subfase === '') {
        fail_validation('subfase', 'Subfase obrigatória');
    }

    $responsavelIdRaw = optional_string($payload['responsavel_id'] ?? null);
    $responsavelId = null;
    if ($responsavelIdRaw !== null && ctype_digit($responsavelIdRaw)) {
        $responsavelId = (int)$responsavelIdRaw;
    }
    $empresaIdRaw = optional_string($payload['empresa_id'] ?? null);
    $empresaId = null;
    if ($empresaIdRaw !== null && ctype_digit($empresaIdRaw)) {
        $empresaId = (int)$empresaIdRaw;
    }

    $dataPagamento = null;
    if ($pagamento === 'pago') {
        $dataPagamento = parse_datetime_or_null($payload['data_pagamento'] ?? '', 'data_pagamento', true);
    } else {
        $dataPagamento = null;
    }
    $dadosPagamento = optional_string($payload['dados_pagamento'] ?? ($payload['dadosPagamento'] ?? null));
    $nfe = optional_string($payload['nfe'] ?? null);
    $notas = optional_string($payload['notas'] ?? null) ?? '';
    $dadosPagamentoStr = $dadosPagamento ?? '';
    $nfeStr = $nfe ?? '';

    $pdo = Database::connection();
    $stmt = $pdo->prepare('INSERT INTO uc_faturas (code, descricao, data, lancamento, data_pagamento, dados_pagamento, nfe, notas, status, pagamento, valor, quantidade, total, fase_id, subfase, responsavel_id, empresa_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $code,
        $descricao,
        $data,
        $lancamento,
        $dataPagamento,
        $dadosPagamentoStr,
        $nfeStr,
        $notas,
        $status,
        $pagamento,
        $valor,
        $quantidade,
        $total,
        $faseId,
        $subfase,
        $responsavelId,
        $empresaId,
    ]);

    $faturaId = (int)$pdo->lastInsertId();
    json_response([
        'faturaId' => $faturaId,
        'descricao' => $descricao,
        'valor' => $valor,
        'quantidade' => $quantidade,
        'total' => $total,
    ], 201);
    exit;
}

if (preg_match('#^/faturas/(\\d+)$#', $relativePath, $m) && $method === 'PUT') {
    require_authenticated_user_id();
    require_privileged_role();
    require_obra_cadastrada();
    $code = require_active_obra_codigo();
    $faturaId = (int)$m[1];

    $existing = fetch_one('SELECT * FROM uc_faturas WHERE fatura_id = ? AND code = ? LIMIT 1', [$faturaId, $code]);
    if (!$existing) {
        json_response(['detail' => 'Fatura não encontrada.'], 404);
        exit;
    }

    $payload = parse_json_body();

    $descricao = trim((string)($payload['descricao'] ?? ''));
    if ($descricao === '') {
        fail_validation('descricao', 'Descrição obrigatória');
    }

    $data = parse_datetime_or_null($payload['data'] ?? '', 'data', true);

    $pagamento = (string)($payload['pagamento'] ?? '');
    $allowedPagamento = ['aberto', 'pendente', 'pago'];
    if (!in_array($pagamento, $allowedPagamento, true)) {
        fail_validation('pagamento', 'Pagamento inválido');
    }

    $status = (string)($payload['status'] ?? '');
    if (!in_array($status, ['ATIVO', 'INATIVO'], true)) {
        fail_validation('status', 'Status inválido');
    }

    $valor = normalize_decimal($payload['valor'] ?? null, 'valor', 2, true);
    $quantidade = normalize_int($payload['quantidade'] ?? null, 'quantidade', true);
    if ($quantidade < 0) {
        fail_validation('quantidade', 'Quantidade deve ser positiva');
    }
    $total = normalize_decimal((float)$valor * (float)$quantidade, 'total', 2, true);

    $faseIdRaw = trim((string)($payload['fase_id'] ?? ''));
    if ($faseIdRaw === '' || !ctype_digit($faseIdRaw)) {
        fail_validation('fase_id', 'Fase obrigatória');
    }
    $faseId = (int)$faseIdRaw;

    $subfase = trim((string)($payload['subfase'] ?? ''));
    if ($subfase === '') {
        fail_validation('subfase', 'Subfase obrigatória');
    }

    $responsavelIdRaw = optional_string($payload['responsavel_id'] ?? null);
    $responsavelId = null;
    if ($responsavelIdRaw !== null && ctype_digit($responsavelIdRaw)) {
        $responsavelId = (int)$responsavelIdRaw;
    }
    $empresaIdRaw = optional_string($payload['empresa_id'] ?? null);
    $empresaId = null;
    if ($empresaIdRaw !== null && ctype_digit($empresaIdRaw)) {
        $empresaId = (int)$empresaIdRaw;
    }

    $dataPagamento = null;
    if ($pagamento === 'pago') {
        $dataPagamento = parse_datetime_or_null($payload['data_pagamento'] ?? '', 'data_pagamento', true);
    } else {
        $dataPagamento = null;
    }
    $dadosPagamento = optional_string($payload['dados_pagamento'] ?? ($payload['dadosPagamento'] ?? null));
    $nfe = optional_string($payload['nfe'] ?? null);
    $notas = optional_string($payload['notas'] ?? null) ?? '';
    $dadosPagamentoStr = $dadosPagamento ?? '';
    $nfeStr = $nfe ?? '';

    $pdo = Database::connection();
    $stmt = $pdo->prepare('UPDATE uc_faturas SET descricao = ?, data = ?, data_pagamento = ?, dados_pagamento = ?, nfe = ?, notas = ?, status = ?, pagamento = ?, valor = ?, quantidade = ?, total = ?, fase_id = ?, subfase = ?, responsavel_id = ?, empresa_id = ? WHERE fatura_id = ? AND code = ?');
    $stmt->execute([
        $descricao,
        $data,
        $dataPagamento,
        $dadosPagamentoStr,
        $nfeStr,
        $notas,
        $status,
        $pagamento,
        $valor,
        $quantidade,
        $total,
        $faseId,
        $subfase,
        $responsavelId,
        $empresaId,
        $faturaId,
        $code,
    ]);

    $row = fetch_one(
        'SELECT ft.fatura_id, ft.data, ft.lancamento, ft.data_pagamento, ft.dados_pagamento, ft.nfe, ft.notas, ft.status, ft.pagamento,
                ft.valor, ft.quantidade, ft.descricao, ft.total, ft.fase_id, ft.subfase, ft.responsavel_id, ft.empresa_id,
                ft.created_at, ft.updated_at,
                f.fase AS fase_nome,
                ur.nome AS responsavel_nome,
                ue.nome AS empresa_nome
         FROM uc_faturas ft
         LEFT JOIN uc_fases f ON f.fase_id = ft.fase_id
         LEFT JOIN uc_users ur ON ur.user_id = ft.responsavel_id AND (' . uc_users_code_predicate('ur.code') . ' OR ur.tipo_usuario = ?)
         LEFT JOIN uc_users ue ON ue.user_id = ft.empresa_id AND (' . uc_users_code_predicate('ue.code') . ' OR ue.tipo_usuario = ?)
         WHERE ft.fatura_id = ? AND ft.code = ? LIMIT 1',
        [$code, 'Owner', $code, 'Owner', $faturaId, $code]
    );
    json_response([
        'faturaId' => (int)$row['fatura_id'],
        'fatura' => (string)$row['descricao'],
        'data' => (string)$row['data'],
        'lancamento' => (string)$row['lancamento'],
        'dataPagamento' => $row['data_pagamento'] !== null ? (string)$row['data_pagamento'] : null,
        'dadosPagamento' => $row['dados_pagamento'] !== null ? (string)$row['dados_pagamento'] : null,
        'nfe' => $row['nfe'] !== null ? (string)$row['nfe'] : null,
        'notas' => $row['notas'] !== null ? (string)$row['notas'] : '',
        'status' => (string)$row['status'],
        'pagamento' => (string)$row['pagamento'],
        'valor' => (string)$row['valor'],
        'quantidade' => (int)$row['quantidade'],
        'total' => (string)$row['total'],
        'faseId' => (int)$row['fase_id'],
        'faseNome' => $row['fase_nome'] !== null ? (string)$row['fase_nome'] : null,
        'subfase' => $row['subfase'] !== null ? (string)$row['subfase'] : '',
        'responsavelId' => $row['responsavel_id'] !== null ? (int)$row['responsavel_id'] : null,
        'responsavelNome' => $row['responsavel_nome'] !== null ? (string)$row['responsavel_nome'] : null,
        'empresaId' => $row['empresa_id'] !== null ? (int)$row['empresa_id'] : null,
        'empresaNome' => $row['empresa_nome'] !== null ? (string)$row['empresa_nome'] : null,
        'createdAt' => (string)$row['created_at'],
        'updatedAt' => (string)$row['updated_at'],
    ]);
    exit;
}

if (preg_match('#^/faturas/(\\d+)$#', $relativePath, $m) && $method === 'DELETE') {
    require_authenticated_user_id();
    require_privileged_role();
    require_obra_cadastrada();
    $code = require_active_obra_codigo();
    $faturaId = (int)$m[1];

    $payload = parse_json_body();
    $password = trim((string)($payload['password'] ?? ''));
    if ($password === '') {
        json_response(['detail' => 'Senha é obrigatória.'], 400);
        exit;
    }
    verify_current_user_password($password);

    $row = fetch_one('SELECT fatura_id FROM uc_faturas WHERE fatura_id = ? AND code = ? LIMIT 1', [$faturaId, $code]);
    if (!$row) {
        json_response(['detail' => 'Fatura não encontrada.'], 404);
        exit;
    }

    $pdo = Database::connection();
    $stmt = $pdo->prepare('DELETE FROM uc_faturas WHERE fatura_id = ? AND code = ?');
    $stmt->execute([$faturaId, $code]);
    http_response_code(204);
    exit;
}

if ($relativePath === '/obra' && $method === 'GET') {
    require_authenticated_user_id();
    $codigo = require_active_obra_codigo();
    $row = fetch_one('SELECT * FROM uc_obra WHERE codigo = ? LIMIT 1', [$codigo]);
    if (!$row) {
        json_response(null);
        exit;
    }
    json_response([
        'obraId' => (int)$row['obra_id'],
        'foto' => $row['foto'] !== null ? (string)$row['foto'] : null,
        'nome' => (string)$row['nome'],
        'caderneta' => $row['caderneta'] !== null ? (string)$row['caderneta'] : null,
        'responsavel' => $row['responsavel'] !== null ? (string)$row['responsavel'] : null,
        'rua' => $row['rua'] !== null ? (string)$row['rua'] : null,
        'numero' => $row['numero'] !== null ? (string)$row['numero'] : null,
        'bairro' => $row['bairro'] !== null ? (string)$row['bairro'] : null,
        'cidade' => $row['cidade'] !== null ? (string)$row['cidade'] : null,
        'cep' => $row['cep'] !== null ? (string)$row['cep'] : null,
        'matricula' => $row['matricula'] !== null ? (string)$row['matricula'] : null,
        'engenheiroResponsavel' => $row['engenheiro_responsavel'] !== null ? (string)$row['engenheiro_responsavel'] : null,
        'dataInicio' => $row['data_inicio'] !== null ? (string)$row['data_inicio'] : null,
        'dataPrevisaoFinalizacao' => $row['data_previsao_finalizacao'] !== null ? (string)$row['data_previsao_finalizacao'] : null,
        'codigo' => (string)$row['codigo'],
        'notas' => $row['notas'] !== null ? (string)$row['notas'] : null,
        'createdAt' => (string)$row['created_at'],
        'updatedAt' => (string)$row['updated_at'],
    ]);
    exit;
}

if ($relativePath === '/obra' && $method === 'POST') {
    require_authenticated_user_id();
    require_privileged_role();
    $codigo = require_active_obra_codigo();

    $existing = fetch_one('SELECT obra_id FROM uc_obra WHERE codigo = ? LIMIT 1', [$codigo]);
    if ($existing) {
        json_response(['detail' => 'Obra já existe para este código.'], 409);
        exit;
    }

    $payload = parse_json_body();
    $nome = trim((string)($payload['nome'] ?? ''));
    if ($nome === '') {
        fail_validation('nome', 'Nome é obrigatório');
    }
    $slug = slug_codigo($nome);
    if ($slug === '' || $slug !== $codigo) {
        json_response(['detail' => 'O nome da obra deve gerar o mesmo código da obra ativa.'], 409);
        exit;
    }

    $foto = optional_string($payload['foto'] ?? null);
    $caderneta = optional_string($payload['caderneta'] ?? null);

    $responsavel = null;
    $responsavelIdRaw = optional_string($payload['responsavel_id'] ?? null);
    if ($responsavelIdRaw !== null && ctype_digit($responsavelIdRaw)) {
        $u = fetch_one('SELECT nome FROM uc_users WHERE user_id = ? LIMIT 1', [(int)$responsavelIdRaw]);
        if (!$u) {
            fail_validation('responsavel_id', 'Responsável inválido');
        }
        $responsavel = (string)$u['nome'];
    }

    $rua = optional_string($payload['rua'] ?? null);
    $numero = optional_string($payload['numero'] ?? null);
    $bairro = optional_string($payload['bairro'] ?? null);
    $cidade = optional_string($payload['cidade'] ?? null);
    $cep = optional_string($payload['cep'] ?? null);
    $matricula = optional_string($payload['matricula'] ?? null);

    $engResp = null;
    $engIdRaw = optional_string($payload['engenheiro_responsavel_id'] ?? null);
    if ($engIdRaw !== null && ctype_digit($engIdRaw)) {
        $u = fetch_one('SELECT nome FROM uc_users WHERE user_id = ? LIMIT 1', [(int)$engIdRaw]);
        if (!$u) {
            fail_validation('engenheiro_responsavel_id', 'Engenheiro responsável inválido');
        }
        $engResp = (string)$u['nome'];
    }

    $dataInicio = parse_date_or_null($payload['data_inicio'] ?? ($payload['dataInicio'] ?? null), 'data_inicio', false);
    $dataPrev = parse_date_or_null($payload['data_previsao_finalizacao'] ?? ($payload['dataPrevisaoFinalizacao'] ?? null), 'data_previsao_finalizacao', false);
    $notas = optional_string($payload['notas'] ?? null);

    $pdo = Database::connection();
    $stmt = $pdo->prepare('INSERT INTO uc_obra (foto, nome, caderneta, responsavel, rua, numero, bairro, cidade, cep, matricula, engenheiro_responsavel, data_inicio, data_previsao_finalizacao, codigo, notas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $foto,
        $nome,
        $caderneta,
        $responsavel,
        $rua,
        $numero,
        $bairro,
        $cidade,
        $cep,
        $matricula,
        $engResp,
        $dataInicio,
        $dataPrev,
        $codigo,
        $notas,
    ]);

    $obraId = (int)$pdo->lastInsertId();
    json_response(['obraId' => $obraId, 'codigo' => $codigo], 201);
    exit;
}

if ($relativePath === '/obra' && $method === 'PUT') {
    require_authenticated_user_id();
    require_privileged_role();
    $codigo = require_active_obra_codigo();

    $row = fetch_one('SELECT obra_id FROM uc_obra WHERE codigo = ? LIMIT 1', [$codigo]);
    if (!$row) {
        // upsert via POST
        json_response(['detail' => 'Obra não existe.'], 404);
        exit;
    }

    $payload = parse_json_body();
    $nome = trim((string)($payload['nome'] ?? ''));
    if ($nome === '') {
        fail_validation('nome', 'Nome é obrigatório');
    }
    $slug = slug_codigo($nome);
    if ($slug === '' || $slug !== $codigo) {
        json_response(['detail' => 'O nome da obra deve gerar o mesmo código da obra ativa.'], 409);
        exit;
    }

    $foto = optional_string($payload['foto'] ?? null);
    $caderneta = optional_string($payload['caderneta'] ?? null);

    $responsavel = null;
    $responsavelIdRaw = optional_string($payload['responsavel_id'] ?? null);
    if ($responsavelIdRaw !== null && ctype_digit($responsavelIdRaw)) {
        $u = fetch_one('SELECT nome FROM uc_users WHERE user_id = ? LIMIT 1', [(int)$responsavelIdRaw]);
        if (!$u) {
            fail_validation('responsavel_id', 'Responsável inválido');
        }
        $responsavel = (string)$u['nome'];
    }

    $rua = optional_string($payload['rua'] ?? null);
    $numero = optional_string($payload['numero'] ?? null);
    $bairro = optional_string($payload['bairro'] ?? null);
    $cidade = optional_string($payload['cidade'] ?? null);
    $cep = optional_string($payload['cep'] ?? null);
    $matricula = optional_string($payload['matricula'] ?? null);

    $engResp = null;
    $engIdRaw = optional_string($payload['engenheiro_responsavel_id'] ?? null);
    if ($engIdRaw !== null && ctype_digit($engIdRaw)) {
        $u = fetch_one('SELECT nome FROM uc_users WHERE user_id = ? LIMIT 1', [(int)$engIdRaw]);
        if (!$u) {
            fail_validation('engenheiro_responsavel_id', 'Engenheiro responsável inválido');
        }
        $engResp = (string)$u['nome'];
    }

    $dataInicio = parse_date_or_null($payload['data_inicio'] ?? ($payload['dataInicio'] ?? null), 'data_inicio', false);
    $dataPrev = parse_date_or_null($payload['data_previsao_finalizacao'] ?? ($payload['dataPrevisaoFinalizacao'] ?? null), 'data_previsao_finalizacao', false);
    $notas = optional_string($payload['notas'] ?? null);

    $pdo = Database::connection();
    $stmt = $pdo->prepare('UPDATE uc_obra SET foto = ?, nome = ?, caderneta = ?, responsavel = ?, rua = ?, numero = ?, bairro = ?, cidade = ?, cep = ?, matricula = ?, engenheiro_responsavel = ?, data_inicio = ?, data_previsao_finalizacao = ?, notas = ? WHERE codigo = ?');
    $stmt->execute([
        $foto,
        $nome,
        $caderneta,
        $responsavel,
        $rua,
        $numero,
        $bairro,
        $cidade,
        $cep,
        $matricula,
        $engResp,
        $dataInicio,
        $dataPrev,
        $notas,
        $codigo,
    ]);

    json_response(['ok' => true]);
    exit;
}

if ($relativePath === '/health' && $method === 'GET') {
    json_response(['ok' => true, 'time' => date(DATE_ATOM)]);
    exit;
}

json_response(['error' => 'Rota não encontrada', 'path' => $relativePath], 404);
