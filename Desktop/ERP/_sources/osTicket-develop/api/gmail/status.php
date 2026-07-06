<?php
@chdir(dirname(__FILE__).'/../../');
require_once('api/api.inc.php');
require_once(INCLUDE_DIR.'class.gmailapi.php');

Http::response(200, json_encode([
    'ok' => true,
    'status' => GmailApi::summary(),
]), 'application/json');
