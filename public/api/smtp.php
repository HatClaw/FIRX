<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function reply(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function smtp_fail(string $code, string $message): never {
    reply(502, ['error' => $message, 'code' => $code]);
}

function clean_header(string $value, int $limit = 998): string {
    $value = preg_replace('/[\r\n\x00-\x1f\x7f]/u', ' ', $value) ?? '';
    return trim(substr($value, 0, $limit));
}

function smtp_read($socket, array $expected, string $stage = 'SMTP_RESPONSE'): string {
    $lines = [];
    do {
        $line = fgets($socket, 2048);
        if ($line === false) smtp_fail('SMTP_READ', 'Conexão SMTP encerrada inesperadamente.');
        $lines[] = trim($line);
        $code = substr($line, 0, 3);
        $more = isset($line[3]) && $line[3] === '-';
    } while ($more);
    if (!in_array((int)$code, $expected, true)) {
        $safeStage = preg_replace('/[^A-Z0-9_]/', '', strtoupper($stage)) ?: 'SMTP_RESPONSE';
        $status = preg_replace('/\D/', '', $code);
        smtp_fail('SMTP_' . $status . '_' . $safeStage, 'O servidor SMTP recusou a etapa ' . strtolower(str_replace('_', ' ', $safeStage)) . ' (' . $status . ').');
    }
    return implode("\n", $lines);
}

function smtp_command($socket, string $command, array $expected, string $stage = 'SMTP_COMMAND'): string {
    smtp_write($socket, $command . "\r\n");
    return smtp_read($socket, $expected, $stage);
}

function smtp_write($socket, string $data): void {
    $length = strlen($data);
    $offset = 0;
    while ($offset < $length) {
        $written = fwrite($socket, substr($data, $offset));
        if ($written === false || $written === 0) smtp_fail('SMTP_WRITE', 'Falha ao comunicar com o servidor SMTP.');
        $offset += $written;
    }
}

function mime_header(string $value): string {
    $value = clean_header($value, 240);
    return function_exists('mb_encode_mimeheader') ? mb_encode_mimeheader($value, 'UTF-8', 'B', "\r\n") : '=?UTF-8?B?' . base64_encode($value) . '?=';
}

function build_mime_message(string $from, string $fromName, array $recipients, string $subject, string $text, string $html, string $messageIdDomain): string {
    $boundary = '=_GrowMoney_' . bin2hex(random_bytes(18));
    $toHeader = implode(', ', array_map(static fn($address) => '<' . $address . '>', $recipients));
    $messageIdDomain = preg_replace('/[^a-z0-9.-]/i', '', $messageIdDomain) ?: 'growmoney.local';

    $headers = [
        'From: ' . mime_header($fromName) . ' <' . $from . '>',
        'To: ' . $toHeader,
        'Subject: ' . mime_header($subject),
        'Date: ' . date(DATE_RFC2822),
        'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $messageIdDomain . '>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        'X-Mailer: GrowMoney SMTP',
    ];

    $parts = [
        '--' . $boundary . "\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($text), 76, "\r\n"),
        '--' . $boundary . "\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\n"
            . "Content-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($html), 76, "\r\n"),
        '--' . $boundary . "--\r\n",
    ];

    return implode("\r\n", $headers) . "\r\n\r\n" . implode('', $parts);
}

function smtp_send(array $settings, string $action, ?array $mail): void {
    $host = strtolower(trim((string)($settings['host'] ?? '')));
    $port = (int)($settings['port'] ?? 0);
    $username = (string)($settings['username'] ?? '');
    $password = (string)($settings['password'] ?? '');
    $from = strtolower(trim((string)($settings['fromEmail'] ?? '')));
    $fromName = clean_header((string)($settings['fromName'] ?? 'GrowMoney'), 120);
    if (!preg_match('/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/', $host)
        || $port !== 587 || $username === '' || strlen($username) > 254 || strlen($password) > 1024
        || !filter_var($from, FILTER_VALIDATE_EMAIL)) {
        reply(400, ['error' => 'Configuração SMTP inválida para STARTTLS na porta 587.', 'code' => 'INVALID_SETTINGS']);
    }

    $context = stream_context_create(['ssl' => [
        'verify_peer' => true, 'verify_peer_name' => true, 'peer_name' => $host,
        'SNI_enabled' => true, 'crypto_method' => STREAM_CRYPTO_METHOD_TLS_CLIENT,
    ]]);
    $socket = @stream_socket_client('tcp://' . $host . ':' . $port, $errno, $errstr, 15, STREAM_CLIENT_CONNECT, $context);
    if (!$socket) smtp_fail('SMTP_CONNECT', 'Não foi possível conectar ao servidor SMTP da hospedagem.');
    stream_set_timeout($socket, 20);
    try {
        smtp_read($socket, [220], 'GREETING');
        smtp_command($socket, 'EHLO growmoney', [250], 'EHLO');
        smtp_command($socket, 'STARTTLS', [220], 'STARTTLS');
        $tls = @stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        if ($tls !== true) smtp_fail('SMTP_TLS', 'O servidor não concluiu a negociação TLS segura.');
        smtp_command($socket, 'EHLO growmoney', [250], 'EHLO_TLS');
        smtp_command($socket, 'AUTH LOGIN', [334], 'AUTH_LOGIN');
        smtp_command($socket, base64_encode($username), [334], 'AUTH_USERNAME');
        smtp_command($socket, base64_encode($password), [235], 'AUTH_PASSWORD');
        if ($action === 'verify') {
            smtp_command($socket, 'QUIT', [221], 'QUIT');
            return;
        }
        if (!$mail || !isset($mail['to']) || !isset($mail['subject'])) {
            reply(400, ['error' => 'Mensagem SMTP inválida.', 'code' => 'INVALID_MESSAGE']);
        }
        $rawTo = is_array($mail['to']) ? $mail['to'] : [$mail['to']];
        $recipients = [];
        foreach ($rawTo as $recipient) {
            if (!is_string($recipient) || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
                reply(400, ['error' => 'Destinatário de e-mail inválido.', 'code' => 'INVALID_RECIPIENT']);
            }
            $recipients[] = strtolower($recipient);
        }
        $recipients = array_values(array_unique($recipients));
        if (count($recipients) < 1 || count($recipients) > 20) {
            reply(400, ['error' => 'A mensagem deve ter entre 1 e 20 destinatários.', 'code' => 'RECIPIENT_LIMIT']);
        }
        smtp_command($socket, 'MAIL FROM:<' . $from . '>', [250], 'MAIL_FROM');
        foreach ($recipients as $recipient) smtp_command($socket, 'RCPT TO:<' . $recipient . '>', [250, 251], 'RCPT_TO');
        smtp_command($socket, 'DATA', [354], 'DATA');

        $subject = clean_header((string)$mail['subject'], 240);
        $text = (string)($mail['text'] ?? '');
        $html = (string)($mail['html'] ?? '');
        if (strlen($text) > 500000 || strlen($html) > 1000000) smtp_fail('MESSAGE_TOO_LARGE', 'A mensagem excede o tamanho permitido.');
        $message = build_mime_message($from, $fromName, $recipients, $subject, $text, $html, (string)substr(strrchr($from, '@') ?: '', 1));
        // Replace CRLF, CR, and LF in one pass. Sequential str_replace calls
        // reprocess the CR and LF inserted by the first replacement, adding
        // blank lines between every header and causing SMTP to treat headers
        // as message body text.
        $message = preg_replace('/\r\n|\r|\n/', "\r\n", $message) ?? $message;
        $message = preg_replace('/(?m)^\./', '..', $message) ?? $message;
        smtp_write($socket, $message . ".\r\n");
        smtp_read($socket, [250], 'MESSAGE_ACCEPTANCE');
        smtp_command($socket, 'QUIT', [221], 'QUIT');
    } finally {
        if (is_resource($socket)) fclose($socket);
    }
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') reply(405, ['error' => 'Método não permitido.', 'code' => 'METHOD_NOT_ALLOWED']);
if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') reply(426, ['error' => 'Use HTTPS para acessar o serviço SMTP.', 'code' => 'HTTPS_REQUIRED']);
$configFile = __DIR__ . '/smtp-config.php';
if (!is_file($configFile)) reply(503, ['error' => 'Ponte SMTP ainda não configurada no servidor da hospedagem.', 'code' => 'BRIDGE_NOT_CONFIGURED']);
$config = require $configFile;
$expectedKey = is_array($config) ? (string)($config['api_key'] ?? '') : '';
$authorization = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? '');
if ($authorization === '' && function_exists('getallheaders')) {
    foreach (getallheaders() as $headerName => $headerValue) {
        if (strcasecmp((string)$headerName, 'Authorization') === 0) { $authorization = (string)$headerValue; break; }
    }
}
$providedKey = preg_replace('/^Bearer\s+/i', '', $authorization);
if (strlen($expectedKey) < 32 || !hash_equals($expectedKey, $providedKey)) reply(401, ['error' => 'Não autorizado.', 'code' => 'UNAUTHORIZED']);

$rawBody = file_get_contents('php://input');
if ($rawBody === false || strlen($rawBody) > 1500000) reply(413, ['error' => 'Solicitação inválida ou muito grande.', 'code' => 'REQUEST_TOO_LARGE']);
$input = json_decode($rawBody, true);
if (!is_array($input) || !is_array($input['settings'] ?? null)) reply(400, ['error' => 'Configuração da solicitação inválida.', 'code' => 'INVALID_REQUEST']);
$action = (string)($input['action'] ?? '');
if (!in_array($action, ['verify', 'send'], true)) reply(400, ['error' => 'Ação inválida.', 'code' => 'INVALID_ACTION']);
try {
    smtp_send($input['settings'], $action, is_array($input['mail'] ?? null) ? $input['mail'] : null);
    reply(200, ['ok' => true]);
} catch (Throwable $error) {
    error_log('GrowMoney SMTP bridge failure: ' . get_class($error));
    reply(502, ['error' => 'O servidor SMTP recusou a conexão ou a mensagem.', 'code' => 'SMTP_BRIDGE_FAILURE']);
}

