<?php
@chdir(dirname(__FILE__).'/../../');
require_once('api/api.inc.php');
require_once(INCLUDE_DIR.'class.gmailapi.php');

$code = $_GET['code'] ?? null;
$state = $_GET['state'] ?? null;

if (!$code) {
    Http::response(400, 'Missing OAuth code');
}

if (!GmailApi::verifyState($state)) {
    Http::response(403, 'Invalid OAuth state');
}

$account = GmailApi::loadAccount();
if (!$account) {
    Http::response(500, 'Unable to load Gmail account');
}

$token = GmailApi::exchangeCode($account, $code);
$account['access_token'] = $token['access_token'] ?? '';
$account['refresh_token'] = $token['refresh_token'] ?? ($account['refresh_token'] ?? '');
$account['token_expires_at'] = time() + (int) ($token['expires_in'] ?? 3600);

$profile = GmailApi::getProfile($account);
$account['gmail_email'] = $profile['emailAddress'] ?? ($account['gmail_email'] ?? '');
$account['active'] = 1;
$account['last_error'] = null;
GmailApi::saveAccount($account, $account['id']);

Http::response(200, json_encode([
    'ok' => true,
    'gmail_email' => $account['gmail_email'],
    'message' => 'Gmail account connected',
]), 'application/json');
