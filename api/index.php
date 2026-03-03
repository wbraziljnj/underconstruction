<?php

declare(strict_types=1);

require_once __DIR__ . '/src/Database.php';
require_once __DIR__ . '/src/helpers.php';

use UC\Database;

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
    $userId = $_SESSION['uc_user_id'] ?? null;
    if (!is_string($userId) || trim($userId) === '') {
        json_response(['detail' => 'Não autenticado.'], 401);
        exit;
    }
    $code = trim((string)($_SESSION['uc_code'] ?? $_SESSION['uc_codigo'] ?? ''));
    if ($code === '') {
        json_response(['detail' => 'Nenhuma obra selecionada.'], 409);
        exit;
    }
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
    $userId = $_SESSION['uc_user_id'] ?? null;
    if (!is_string($userId) || trim($userId) === '') {
        json_response(['detail' => 'Não autenticado.'], 401);
        exit;
    }
    $code = trim((string)($_SESSION['uc_code'] ?? $_SESSION['uc_codigo'] ?? ''));
    if ($code === '') {
        json_response(['detail' => 'Nenhuma obra selecionada.'], 409);
        exit;
    }
    $rows = fetch_all(
        'SELECT fase_id, fase, data_inicio, previsao_finalizacao, data_finalizacao FROM uc_fases WHERE code = ? AND deleted_at IS NULL ORDER BY data_inicio ASC',
        [$code]
    );
    $options = array_map(fn ($r) => [
        'faseId' => (string)$r['fase_id'],
        'fase' => (string)$r['fase'],
        'dataInicio' => (string)$r['data_inicio'],
        'previsaoFinalizacao' => (string)$r['previsao_finalizacao'],
        'dataFinalizacao' => $r['data_finalizacao'] !== null ? (string)$r['data_finalizacao'] : null,
    ], $rows);
    json_response($options);
    exit;
}

if ($relativePath === '/health' && $method === 'GET') {
    json_response(['ok' => true, 'time' => date(DATE_ATOM)]);
    exit;
}

json_response(['error' => 'Rota não encontrada', 'path' => $relativePath], 404);
