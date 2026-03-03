<?php

declare(strict_types=1);

// Evita que warnings/notices quebrem respostas JSON em produção.
@ini_set('display_errors', '0');
@ini_set('log_errors', '1');

require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/helpers.php';

use UC\Database;

set_exception_handler(function (Throwable $e): void {
    error_log('[UC] Uncaught: ' . $e->getMessage() . "\n" . $e->getTraceAsString());
    if (!headers_sent()) {
        json_response(['detail' => 'Erro interno.'], 500);
        return;
    }
});

set_error_handler(function (int $severity, string $message, string $file, int $line): bool {
    // Converte warnings/notices em exceção para não “vazar” HTML.
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

start_session_if_needed();

$method = $_SERVER['REQUEST_METHOD'];
$requestUri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$scriptDir = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/');
$relativePath = '/' . ltrim(str_replace($scriptDir, '', (string)$requestUri), '/');
$relativePath = rtrim($relativePath, '/');

if (isset($_GET['ucDebug']) && $_GET['ucDebug'] === 'ping') {
    json_response(['ok' => true, 'marker' => 'uc-api', 'time' => date(DATE_ATOM)]);
    exit;
}

// Conectar cedo para falhar rápido (mesmo padrão do Sheila).
Database::connection();

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

    $publicPath = '/api/uploads/' . $filename;
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

    $user = fetch_one('SELECT * FROM uc_users WHERE LOWER(email) = ? LIMIT 1', [strtolower($email)]);
    if (!$user) {
        json_response(['detail' => 'Credenciais inválidas.'], 401);
        exit;
    }

    $hash = (string)($user['password_hash'] ?? '');
    if ($hash === '' || !password_verify($password, $hash)) {
        json_response(['detail' => 'Credenciais inválidas.'], 401);
        exit;
    }

    $_SESSION['uc_user_id'] = (string)$user['user_id'];
    $_SESSION['uc_code'] = (string)($user['code'] ?? '');
    $_SESSION['uc_codigo'] = (string)($user['code'] ?? '');

    json_response([
        'userId' => (string)$user['user_id'],
        'nome' => (string)$user['nome'],
        'email' => (string)$user['email'],
        'tipoUsuario' => (string)$user['tipo_usuario'],
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
    $_SESSION['uc_code'] = (string)($user['code'] ?? '');
    $_SESSION['uc_codigo'] = (string)($user['code'] ?? '');
    json_response([
        'userId' => (string)$user['user_id'],
        'nome' => (string)$user['nome'],
        'email' => (string)$user['email'],
        'tipoUsuario' => (string)$user['tipo_usuario'],
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

if ($relativePath === '/cadastros/options' && $method === 'GET') {
    require_authenticated_user_id();
    $codigo = require_active_obra_codigo();
    $code = trim((string)($_SESSION['uc_code'] ?? $codigo));
    $rows = fetch_all(
        'SELECT user_id, nome, tipo_usuario, status FROM uc_users WHERE code = ? ORDER BY nome ASC',
        [$code]
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

if ($relativePath === '/fases/options' && $method === 'GET') {
    require_authenticated_user_id();
    $codigo = require_active_obra_codigo();
    $code = trim((string)($_SESSION['uc_code'] ?? $codigo));
    $rows = fetch_all(
        'SELECT fase_id, fase, data_inicio, previsao_finalizacao, data_finalizacao, status FROM uc_fases WHERE code = ? ORDER BY data_inicio ASC',
        [$code]
    );
    $options = array_map(fn ($r) => [
        'faseId' => (string)$r['fase_id'],
        'fase' => (string)$r['fase'],
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
    $codigo = require_active_obra_codigo();
    $code = trim((string)($_SESSION['uc_code'] ?? $codigo));

    $q = trim((string)($_GET['q'] ?? ''));
    $tipo = trim((string)($_GET['tipo_usuario'] ?? ''));
    $status = trim((string)($_GET['status'] ?? ''));

    $sql = 'SELECT user_id, foto, tipo_usuario, nome, cpf_cnpj, telefone, endereco, email, notas, status, created_at, updated_at
            FROM uc_users WHERE code = ?';
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
    require_authenticated_user_id();
    $codigo = require_active_obra_codigo();
    $code = trim((string)($_SESSION['uc_code'] ?? $codigo));

    $q = trim((string)($_GET['q'] ?? ''));

    $sql = 'SELECT f.fase_id, f.fase, f.data_inicio, f.previsao_finalizacao, f.data_finalizacao, f.responsavel_id,
                   f.status, f.valor_total, f.valor_parcial, f.notas, f.created_at, f.updated_at,
                   u.nome AS responsavel_nome
            FROM uc_fases f
            LEFT JOIN uc_users u ON u.user_id = f.responsavel_id
            WHERE f.code = ?';
    $params = [$code];

    if ($q !== '') {
        $sql .= ' AND (LOWER(f.fase) LIKE ? OR LOWER(u.nome) LIKE ?)';
        $like = '%' . strtolower($q) . '%';
        $params[] = $like;
        $params[] = $like;
    }

    $sql .= ' ORDER BY f.data_inicio ASC';
    $rows = fetch_all($sql, $params);
    $items = array_map(fn ($r) => [
        'faseId' => (string)$r['fase_id'],
        'fase' => (string)$r['fase'],
        'status' => (string)($r['status'] ?? ''),
        'dataInicio' => (string)$r['data_inicio'],
        'previsaoFinalizacao' => (string)$r['previsao_finalizacao'],
        'dataFinalizacao' => $r['data_finalizacao'] !== null ? (string)$r['data_finalizacao'] : null,
        'responsavelId' => $r['responsavel_id'] !== null ? (string)$r['responsavel_id'] : null,
        'responsavelNome' => $r['responsavel_nome'] !== null ? (string)$r['responsavel_nome'] : null,
        'valorTotal' => (string)$r['valor_total'],
        'valorParcial' => (string)$r['valor_parcial'],
        'notas' => $r['notas'] !== null ? (string)$r['notas'] : null,
        'createdAt' => (string)$r['created_at'],
        'updatedAt' => (string)$r['updated_at'],
    ], $rows);
    json_response(['items' => $items]);
    exit;
}

if ($relativePath === '/faturas' && $method === 'GET') {
    require_authenticated_user_id();
    $codigo = require_active_obra_codigo();
    $code = trim((string)($_SESSION['uc_code'] ?? $codigo));

    $q = trim((string)($_GET['q'] ?? ''));
    $pagamento = trim((string)($_GET['pagamento'] ?? ''));
    $status = trim((string)($_GET['status'] ?? ''));

    $sql = 'SELECT ft.fatura_id, ft.data, ft.lancamento, ft.data_pagamento, ft.status, ft.pagamento,
                   ft.valor, ft.quantidade, ft.descricao, ft.total, ft.fase_id, ft.responsavel_id, ft.empresa_id,
                   ft.created_at, ft.updated_at,
                   f.fase AS fase_nome,
                   ur.nome AS responsavel_nome,
                   ue.nome AS empresa_nome
            FROM uc_faturas ft
            LEFT JOIN uc_fases f ON f.fase_id = ft.fase_id
            LEFT JOIN uc_users ur ON ur.user_id = ft.responsavel_id
            LEFT JOIN uc_users ue ON ue.user_id = ft.empresa_id
            WHERE ft.code = ?';
    $params = [$code];

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

    $sql .= ' ORDER BY ft.data DESC, ft.lancamento DESC';
    $rows = fetch_all($sql, $params);
    $items = array_map(fn ($r) => [
        'faturaId' => (string)$r['fatura_id'],
        'fatura' => (string)$r['descricao'],
        'data' => (string)$r['data'],
        'lancamento' => (string)$r['lancamento'],
        'dataPagamento' => $r['data_pagamento'] !== null ? (string)$r['data_pagamento'] : null,
        'status' => (string)$r['status'],
        'pagamento' => (string)$r['pagamento'],
        'valor' => (string)$r['valor'],
        'quantidade' => (int)$r['quantidade'],
        'total' => (string)$r['total'],
        'faseId' => (string)$r['fase_id'],
        'faseNome' => $r['fase_nome'] !== null ? (string)$r['fase_nome'] : null,
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
    $code = require_active_obra_codigo();

    $payload = parse_json_body();

    $tipoUsuario = (string)($payload['tipo_usuario'] ?? '');
    $allowedTipos = ['Pedreiro', 'Ajudante', 'FornecedorMateriais', 'Engenheiro', 'PrestadorServico', 'Gerente', 'Owner'];
    if (!in_array($tipoUsuario, $allowedTipos, true)) {
        fail_validation('tipo_usuario', 'Tipo de usuário inválido');
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
    $passwordHash = password_hash('UnderConstruction', PASSWORD_DEFAULT);
    $userId = uuid_v4();

    $pdo = Database::connection();
    try {
        // Tabela atual no MySQL usa apenas `code` (não existe `codigo` por enquanto).
        $stmt = $pdo->prepare('INSERT INTO uc_users (user_id, code, foto, tipo_usuario, nome, cpf_cnpj, telefone, endereco, email, notas, status, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $userId,
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
            $now,
            $now,
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            json_response(['detail' => 'CPF/CNPJ ou email já cadastrado.'], 409);
            exit;
        }
        throw $e;
    }

    if ($resetSenha) {
        // Nada extra a fazer para novos cadastros; para edições futuras, este flag pede reset.
    }

    json_response([
        'userId' => $userId,
        'nome' => $nome,
        'email' => $email,
        'tipoUsuario' => $tipoUsuario,
        'status' => $status,
    ], 201);
    exit;
}

if ($relativePath === '/fases' && $method === 'POST') {
    require_authenticated_user_id();
    $code = require_active_obra_codigo();

    $payload = parse_json_body();

    $fase = trim((string)($payload['fase'] ?? ''));
    if ($fase === '') {
        fail_validation('fase', 'Fase obrigatória');
    }
    $status = (string)($payload['status'] ?? '');
    $allowedStatus = ['ABERTO', 'ANDAMENTO', 'PENDENTE', 'FINALIZADO'];
    if (!in_array($status, $allowedStatus, true)) {
        fail_validation('status', 'Status inválido');
    }

    $dataInicio = parse_datetime_or_null($payload['data_inicio'] ?? '', 'data_inicio', true);
    $previsaoFinalizacao = parse_datetime_or_null($payload['previsao_finalizacao'] ?? '', 'previsao_finalizacao', true);
    $dataFinalizacao = parse_datetime_or_null($payload['data_finalizacao'] ?? '', 'data_finalizacao', false);

    $responsavelId = optional_string($payload['responsavel_id'] ?? null);
    $valorTotal = normalize_decimal($payload['valor_total'] ?? null, 'valor_total', 2, true);
    $valorParcial = normalize_decimal($payload['valor_parcial'] ?? null, 'valor_parcial', 2, true);
    if ((float)$valorParcial > (float)$valorTotal) {
        fail_validation('valor_parcial', 'Valor parcial não pode ser maior que o valor total');
    }
    $notas = optional_string($payload['notas'] ?? null);

    $now = now_datetime_ms();
    $faseId = uuid_v4();

    $pdo = Database::connection();
    $stmt = $pdo->prepare('INSERT INTO uc_fases (fase_id, code, fase, status, data_inicio, previsao_finalizacao, data_finalizacao, responsavel_id, valor_total, valor_parcial, notas, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $faseId,
        $code,
        $fase,
        $status,
        $dataInicio,
        $previsaoFinalizacao,
        $dataFinalizacao,
        $responsavelId,
        $valorTotal,
        $valorParcial,
        $notas,
        $now,
        $now,
    ]);

    json_response([
        'faseId' => $faseId,
        'fase' => $fase,
        'status' => $status,
    ], 201);
    exit;
}

if ($relativePath === '/faturas' && $method === 'POST') {
    require_authenticated_user_id();
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

    $faseId = trim((string)($payload['fase_id'] ?? ''));
    if ($faseId === '') {
        fail_validation('fase_id', 'Fase obrigatória');
    }
    $responsavelId = optional_string($payload['responsavel_id'] ?? null);
    $empresaId = optional_string($payload['empresa_id'] ?? null);

    $dataPagamento = null;
    if ($pagamento === 'pago') {
        $dataPagamento = parse_datetime_or_null($payload['data_pagamento'] ?? '', 'data_pagamento', true);
    } else {
        $dataPagamento = null;
    }

    $now = now_datetime_ms();
    $faturaId = uuid_v4();

    $pdo = Database::connection();
    // Tabela atual no MySQL usa apenas `code` (não existe `codigo` por enquanto).
    $stmt = $pdo->prepare('INSERT INTO uc_faturas (fatura_id, code, descricao, data, lancamento, data_pagamento, status, pagamento, valor, quantidade, total, fase_id, responsavel_id, empresa_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([
        $faturaId,
        $code,
        $descricao,
        $data,
        $lancamento,
        $dataPagamento,
        $status,
        $pagamento,
        $valor,
        $quantidade,
        $total,
        $faseId,
        $responsavelId,
        $empresaId,
        $now,
        $now,
    ]);

    json_response([
        'faturaId' => $faturaId,
        'descricao' => $descricao,
        'valor' => $valor,
        'quantidade' => $quantidade,
        'total' => $total,
    ], 201);
    exit;
}

if ($relativePath === '/health' && $method === 'GET') {
    json_response(['ok' => true, 'time' => date(DATE_ATOM)]);
    exit;
}

json_response(['error' => 'Rota não encontrada', 'path' => $relativePath], 404);
