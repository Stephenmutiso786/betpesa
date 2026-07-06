<?php
@chdir(dirname(__FILE__).'/../../');
require_once('api/api.inc.php');
require_once(INCLUDE_DIR.'class.gmailapi.php');

$limit = isset($_REQUEST['limit']) ? max(1, (int) $_REQUEST['limit']) : 5;
Http::response(200, json_encode([
    'ok' => true,
    'summary' => GmailApi::testPoll($limit),
]), 'application/json');
