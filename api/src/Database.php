<?php

declare(strict_types=1);

namespace UC;

use PDO;
use PDOException;

final class Database
{
    private static ?PDO $connection = null;

    public static function connection(): PDO
    {
        if (self::$connection !== null) {
            return self::$connection;
        }

        $config = require __DIR__ . '/../config.php';
        $db = $config['db'] ?? [];

        $hosts = $db['hosts'] ?? [];
        $database = (string)($db['database'] ?? '');
        $charset = (string)($db['charset'] ?? 'utf8mb4');
        $user = (string)($db['user'] ?? '');
        $password = (string)($db['password'] ?? '');

        $lastError = null;
        foreach ($hosts as $host) {
            try {
                $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', $host, $database, $charset);
                self::$connection = new PDO(
                    $dsn,
                    $user,
                    $password,
                    [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        PDO::ATTR_EMULATE_PREPARES => false,
                    ]
                );
                return self::$connection;
            } catch (PDOException $e) {
                $lastError = $e;
                error_log('[UC] DB connect failed for host ' . $host . ': ' . $e->getMessage());
            }
        }

        http_response_code(500);
        header('Content-Type: application/json');
        echo json_encode([
            'error' => 'Erro ao conectar ao banco de dados',
            'details' => $lastError ? $lastError->getMessage() : null,
        ]);
        exit;
    }
}

