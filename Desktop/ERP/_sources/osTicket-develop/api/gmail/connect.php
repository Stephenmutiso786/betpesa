<?php
@chdir(dirname(__FILE__).'/../../');
require_once('api/api.inc.php');
require_once(INCLUDE_DIR.'class.gmailapi.php');

$account = GmailApi::loadAccount();
if (!$account || empty($account['client_id']) || empty($account['client_secret'])) {
    Http::response(400, json_encode([
        'error' => 'Gmail client credentials are not configured',
    ]), 'application/json');
}

$state = GmailApi::newState();
$url = GmailApi::getAuthUrl($account, $state);
Http::response(200, json_encode([
    'ok' => true,
    'authorization_url' => $url,
    'state' => $state,
]), 'application/json');
