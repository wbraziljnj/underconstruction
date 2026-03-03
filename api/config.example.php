<?php

// Copie para api/config.php ou configure via variáveis de ambiente.
// Recomendido: usar env vars no servidor (ex.: via Apache SetEnv / painel).

return [
    'db' => [
        'hosts' => [
            'mysql.wbrazilsoftwares.com.br',
            'mysql50-farm1.kinghost.net',
        ],
        'database' => 'wbrazilsoftwar',
        'user' => 'SEU_USUARIO',
        'password' => 'SUA_SENHA',
        'charset' => 'utf8mb4',
    ],
];

