<?php

// Config centralizado (mesmo padrão do Sheila).
// Observação: este repositório não versiona credenciais; use variáveis de ambiente (.env no servidor).

$hostsEnv = getenv('UC_DB_HOSTS') ?: '';
$hosts = array_values(array_filter(array_map('trim', explode(',', $hostsEnv))));
if (!$hosts) {
    // Fallback padrão (host principal e alternativo). Senha vem do env.
    $hosts = [
        'mysql.wbrazilsoftwares.com.br',
        'mysql50-farm1.kinghost.net',
    ];
}

return [
    'db' => [
        'hosts' => $hosts,
        'database' => getenv('UC_DB_NAME') ?: 'wbrazilsoftwar',
        'user' => getenv('UC_DB_USER') ?: '',
        'password' => getenv('UC_DB_PASS') ?: '',
        'charset' => getenv('UC_DB_CHARSET') ?: 'utf8mb4',
    ],
];

