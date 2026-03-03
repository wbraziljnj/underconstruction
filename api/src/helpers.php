<?php

declare(strict_types=1);

use DateTimeImmutable;
use UC\Database;

function json_response(mixed $data, int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
}

function fail_validation(string $field, string $message, int $code = 400): void
{
    json_response(['field' => $field, 'detail' => $message], $code);
    exit;
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

function require_authenticated_user_id(): string
{
    start_session_if_needed();
    $userId = $_SESSION['uc_user_id'] ?? null;
    if (is_int($userId)) {
        return (string)$userId;
    }
    if (!is_string($userId) || trim($userId) === '') {
        json_response(['detail' => 'Não autenticado.'], 401);
        exit;
    }
    return trim($userId);
}

function get_active_obra_codigo(): ?string
{
    start_session_if_needed();
    $codigo = $_SESSION['uc_code'] ?? ($_SESSION['uc_codigo'] ?? null);
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

function now_datetime_ms(): string
{
    return (new DateTimeImmutable('now'))->format('Y-m-d H:i:s.v');
}

function optional_string(mixed $value): ?string
{
    if (!is_string($value)) {
        return null;
    }
    $trimmed = trim($value);
    return $trimmed === '' ? null : $trimmed;
}

function parse_datetime_or_null(mixed $value, string $field, bool $required = false): ?string
{
    $raw = is_string($value) ? trim($value) : '';
    if ($raw === '') {
        if ($required) {
            fail_validation($field, sprintf('%s é obrigatório', $field));
        }
        return null;
    }
    // Suporta YYYY-MM-DD vindo de inputs type="date"
    if (preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $raw)) {
        return $raw . ' 00:00:00';
    }
    $dt = date_create($raw);
    if ($dt === false) {
        fail_validation($field, sprintf('%s inválido', $field));
    }
    return $dt->format('Y-m-d H:i:s');
}

function parse_date_or_null(mixed $value, string $field, bool $required = false): ?string
{
    $raw = is_string($value) ? trim($value) : '';
    if ($raw === '') {
        if ($required) {
            fail_validation($field, sprintf('%s é obrigatório', $field));
        }
        return null;
    }
    if (!preg_match('/^\\d{4}-\\d{2}-\\d{2}$/', $raw)) {
        fail_validation($field, sprintf('%s inválido', $field));
    }
    return $raw;
}

function normalize_decimal(mixed $value, string $field, int $scale = 2, bool $required = true): string
{
    if ($value === null || $value === '') {
        if ($required) {
            fail_validation($field, sprintf('%s é obrigatório', $field));
        }
        $value = 0;
    }
    if (!is_numeric($value)) {
        fail_validation($field, sprintf('%s inválido', $field));
    }
    $float = (float)$value;
    return number_format($float, $scale, '.', '');
}

function normalize_int(mixed $value, string $field, bool $required = true): int
{
    if ($value === null || $value === '') {
        if ($required) {
            fail_validation($field, sprintf('%s é obrigatório', $field));
        }
        $value = 0;
    }
    if (!is_numeric($value)) {
        fail_validation($field, sprintf('%s inválido', $field));
    }
    return (int)$value;
}

function uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}
