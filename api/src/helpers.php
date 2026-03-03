<?php

declare(strict_types=1);

use UC\Database;

function json_response(mixed $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
}

function parse_json_body(): array
{
    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw ?: '', true);
    return is_array($decoded) ? $decoded : [];
}

function fetch_all(string $query, array $params = []): array
{
    $pdo = Database::connection();
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    return $stmt->fetchAll();
}

function fetch_one(string $query, array $params = []): array|false
{
    $pdo = Database::connection();
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    return $stmt->fetch();
}

function start_session_if_needed(): void
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
}

function get_active_obra_codigo(): ?string
{
    start_session_if_needed();
    $codigo = $_SESSION['uc_codigo'] ?? null;
    if (!is_string($codigo)) {
        return null;
    }
    $codigo = trim($codigo);
    return $codigo === '' ? null : $codigo;
}

function require_active_obra_codigo(): string
{
    $codigo = get_active_obra_codigo();
    if ($codigo === null) {
        json_response(['error' => 'Nenhuma obra selecionada.'], 409);
        exit;
    }
    return $codigo;
}

