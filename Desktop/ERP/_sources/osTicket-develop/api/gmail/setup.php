<?php
@chdir(dirname(__FILE__).'/../../');
require_once('api/api.inc.php');
require_once(INCLUDE_DIR.'class.gmailapi.php');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Http::response(405, json_encode([
        'error' => 'POST required',
    ]), 'application/json');
}

$account = GmailApi::upsertSettings($_POST);
Http::response(200, json_encode([
    'ok' => true,
    'account' => [
        'id' => $account['id'] ?? null,
        'client_id' => $account['client_id'] ?? '',
        'redirect_uri' => $account['redirect_uri'] ?? GmailApi::defaultRedirectUri(),
        'gmail_email' => $account['gmail_email'] ?? '',
        'processed_label' => $account['processed_label'] ?? 'osTicket/Processed',
        'poll_query' => $account['poll_query'] ?? 'is:unread',
        'active' => (int) ($account['active'] ?? 1),
    ],
    'redirect_uri' => $account['redirect_uri'] ?? GmailApi::defaultRedirectUri(),
]), 'application/json');
