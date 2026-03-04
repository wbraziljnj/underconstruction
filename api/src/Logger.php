<?php

declare(strict_types=1);

namespace UC;

use DateTimeImmutable;
use Throwable;

class Logger
{
    private const DEFAULT_DIR = 'logs';
    private const DEFAULT_RETENTION_DAYS = 3;
    private const DEFAULT_SERVICE = 'api';
    private const SENSITIVE_KEYS = ['password', 'senha', 'token', 'authorization', 'cookie', 'cookies', 'set-cookie'];

    private static string $requestId = '';
    private static array $request = [];
    private static bool $cleaned = false;

    public static function withRequest(array $reqMeta): void
    {
        self::$requestId = $reqMeta['request_id'] ?? self::uuid();
        self::$request = $reqMeta;
        self::$request['request_id'] = self::$requestId;
    }

    public static function getRequestId(): string
    {
        return self::$requestId ?: self::uuid();
    }

    public static function info(string $event, array $context = []): void
    {
        self::log('info', $event, $context, 'app');
    }

    public static function warn(string $event, array $context = []): void
    {
        self::log('warn', $event, $context, 'app');
    }

    public static function error(string $event, array $context = []): void
    {
        self::log('error', $event, $context, 'error');
    }

    public static function client(string $event, array $context = []): void
    {
        self::log('info', $event, $context, 'client');
    }

    public static function sanitizeContext(array $data): array
    {
        return self::sanitize($data);
    }

    private static function log(string $level, string $event, array $context, string $stream): void
    {
        try {
            self::ensureCleaned();
            $ts = (new DateTimeImmutable('now'))->format('Y-m-d\TH:i:s.vP');
            $env = getenv('APP_ENV') ?: 'prod';
            $debug = filter_var(getenv('APP_DEBUG'), FILTER_VALIDATE_BOOL);
            $service = $context['service'] ?? self::DEFAULT_SERVICE;

            $http = $context['http'] ?? [];
            unset($context['http']);

            $user = $context['user'] ?? null;
            unset($context['user']);

            $error = $context['error'] ?? null;
            unset($context['error']);

            $message = $context['message'] ?? null;
            unset($context['message']);

            if (!$debug) {
                $context = self::stripBodies($context);
            }
            $context = self::sanitize($context);

            $payload = [
                'ts' => $ts,
                'level' => $level,
                'service' => $service,
                'event' => $event,
                'request_id' => self::getRequestId(),
            ];
            if ($message !== null) {
                $payload['message'] = $message;
            }
            if ($http !== []) {
                $payload['http'] = $http;
            }
            if ($user !== null) {
                $payload['user'] = $user;
            }
            if ($error !== null) {
                $payload['error'] = $error;
            }
            if ($context !== []) {
                $payload['context'] = $context;
            }
            if (self::$request !== []) {
                $payload['request'] = self::$request;
            }

            self::writeLine($payload, $stream);
        } catch (Throwable $e) {
            // Fail-safe: swallow logging errors
        }
    }

    private static function writeLine(array $data, string $stream): void
    {
        $dir = getenv('LOG_DIR') ?: self::DEFAULT_DIR;
        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        $date = (new DateTimeImmutable('now'))->format('Y-m-d');
        $file = rtrim($dir, '/') . '/' . $stream . '-' . $date . '.jsonl';
        $line = json_encode($data, JSON_UNESCAPED_UNICODE) . PHP_EOL;
        @file_put_contents($file, $line, FILE_APPEND | LOCK_EX);
    }

    private static function ensureCleaned(): void
    {
        if (self::$cleaned) {
            return;
        }
        self::$cleaned = true;
        $dir = getenv('LOG_DIR') ?: self::DEFAULT_DIR;
        $retention = (int)(getenv('LOG_RETENTION_DAYS') ?: self::DEFAULT_RETENTION_DAYS);
        if ($retention < 1) {
            $retention = self::DEFAULT_RETENTION_DAYS;
        }
        if (!is_dir($dir)) {
            return;
        }
        $now = new DateTimeImmutable('now');
        foreach (glob(rtrim($dir, '/') . '/*.jsonl') ?: [] as $file) {
            $base = basename($file);
            if (preg_match('/-(\d{4}-\d{2}-\d{2})\.jsonl$/', $base, $m)) {
                $fileDate = DateTimeImmutable::createFromFormat('Y-m-d', $m[1]);
                if ($fileDate !== false) {
                    $diff = $now->diff($fileDate)->days;
                    if ($diff !== false && $diff > $retention) {
                        @unlink($file);
                    }
                }
            }
        }
    }

    private static function sanitize(array $data)
    {
        $out = [];
        foreach ($data as $k => $v) {
            $lower = strtolower((string)$k);
            if (in_array($lower, self::SENSITIVE_KEYS, true)) {
                $out[$k] = '[masked]';
                continue;
            }
            if (is_array($v)) {
                $out[$k] = self::sanitize($v);
            } else {
                $out[$k] = $v;
            }
        }
        return $out;
    }

    private static function stripBodies(array $data): array
    {
        foreach (['body', 'payload', 'response'] as $key) {
            if (array_key_exists($key, $data)) {
                unset($data[$key]);
            }
        }
        return $data;
    }

    private static function uuid(): string
    {
        if (function_exists('\\uuid_v4')) {
            return \uuid_v4();
        }
        return bin2hex(random_bytes(16));
    }
}
