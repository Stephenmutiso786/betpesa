<?php
@chdir(dirname(__FILE__).'/../../');
require_once('api/api.inc.php');
require_once(INCLUDE_DIR.'class.gmailapi.php');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Http::response(405, json_encode([
        'error' => 'POST required',
    ]), 'application/json');
}

Http::response(200, json_encode([
    'ok' => true,
    'status' => GmailApi::disconnect(),
]), 'application/json');
