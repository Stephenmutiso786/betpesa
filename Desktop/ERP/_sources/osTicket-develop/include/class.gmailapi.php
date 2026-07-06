<?php
/*********************************************************************
    class.gmailapi.php

    Gmail API integration for osTicket mail fetching and sending.

    This class keeps the Gmail transport self-contained so osTicket can
    fetch inbound mail via Gmail API and send outbound replies through the
    same Gmail account when configured.
**********************************************************************/

class GmailApi {
    const ACCOUNT_TABLE = 'gmail_api_account';
    const MESSAGE_TABLE = 'gmail_api_message';

    static function ensureSchema() {
        static $done = false;
        if ($done)
            return true;

        $accountTable = TABLE_PREFIX . self::ACCOUNT_TABLE;
        $messageTable = TABLE_PREFIX . self::MESSAGE_TABLE;

        db_query("CREATE TABLE IF NOT EXISTS `$accountTable` (
            `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
            `client_id` text DEFAULT NULL,
            `client_secret` text DEFAULT NULL,
            `redirect_uri` text DEFAULT NULL,
            `gmail_email` varchar(255) DEFAULT NULL,
            `access_token` longtext DEFAULT NULL,
            `refresh_token` longtext DEFAULT NULL,
            `token_expires_at` int(11) unsigned DEFAULT NULL,
            `processed_label` varchar(255) DEFAULT 'osTicket/Processed',
            `poll_query` varchar(255) DEFAULT 'is:unread',
            `active` tinyint(1) NOT NULL DEFAULT 1,
            `last_sync_at` datetime DEFAULT NULL,
            `last_error` text DEFAULT NULL,
            `created` datetime NOT NULL,
            `updated` datetime NOT NULL,
            PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        db_query("CREATE TABLE IF NOT EXISTS `$messageTable` (
            `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            `account_id` int(11) unsigned NOT NULL,
            `gmail_message_id` varchar(128) NOT NULL,
            `ticket_number` varchar(64) DEFAULT NULL,
            `status` varchar(32) NOT NULL DEFAULT 'processed',
            `created` datetime NOT NULL,
            PRIMARY KEY (`id`),
            UNIQUE KEY `account_message` (`account_id`,`gmail_message_id`),
            KEY `gmail_message_id` (`gmail_message_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        $done = true;
        return true;
    }

    static function loadTicketApi() {
        if (!class_exists('PipeApiController'))
            require_once(INCLUDE_DIR.'api.tickets.php');
    }

    static function gmailLabelQuery($label) {
        $label = trim((string) $label);
        if ($label === '')
            return '';
        if (preg_match('/^[A-Za-z0-9._-]+$/', $label))
            return $label;
        return sprintf('"%s"', str_replace('"', '\"', $label));
    }

    static function tableName() {
        self::ensureSchema();
        return TABLE_PREFIX . self::ACCOUNT_TABLE;
    }

    static function messageTableName() {
        self::ensureSchema();
        return TABLE_PREFIX . self::MESSAGE_TABLE;
    }

    static function defaults() {
        return [
            'client_id' => '',
            'client_secret' => '',
            'redirect_uri' => self::defaultRedirectUri(),
            'gmail_email' => '',
            'access_token' => '',
            'refresh_token' => '',
            'token_expires_at' => 0,
            'processed_label' => 'osTicket/Processed',
            'poll_query' => 'is:unread',
            'active' => 0,
            'last_sync_at' => null,
            'last_error' => null,
        ];
    }

    static function defaultRedirectUri() {
        $scheme = (class_exists('osTicket') && osTicket::is_https())
            ? 'https' : 'http';
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $port = class_exists('osTicket') ? osTicket::get_client_port() : 80;
        $base = sprintf('%s://%s', $scheme, $host);
        if ($port && $port != 80 && $port != 443 && !str_contains($base, ':'.$port))
            $base .= ':' . $port;

        $root = trim(ROOT_PATH, '/');
        return rtrim($base, '/') . '/' . ($root ? $root.'/' : '') . 'api/gmail/callback.php';
    }

    static function loadAccount() {
        self::ensureSchema();
        $row = null;
        if (($res = db_query('SELECT * FROM `'.self::tableName().'` ORDER BY `id` ASC LIMIT 1'))
                && ($row = db_fetch_array($res))) {
            return $row;
        }

        $defaults = self::defaults();
        $defaults['created'] = $defaults['updated'] = date('Y-m-d H:i:s');
        db_query(sprintf(
            'INSERT INTO `%s` (`client_id`,`client_secret`,`redirect_uri`,`gmail_email`,`access_token`,`refresh_token`,`token_expires_at`,`processed_label`,`poll_query`,`active`,`created`,`updated`)
             VALUES (%s, %s, %s, %s, %s, %s, %d, %s, %s, %d, NOW(), NOW())',
            self::tableName(),
            db_input($defaults['client_id']),
            db_input($defaults['client_secret']),
            db_input($defaults['redirect_uri']),
            db_input($defaults['gmail_email']),
            db_input($defaults['access_token']),
            db_input($defaults['refresh_token']),
            (int) $defaults['token_expires_at'],
            db_input($defaults['processed_label']),
            db_input($defaults['poll_query']),
            (int) $defaults['active']
        ));

        if (($res = db_query('SELECT * FROM `'.self::tableName().'` ORDER BY `id` ASC LIMIT 1'))
                && ($row = db_fetch_array($res))) {
            return $row;
        }

        return null;
    }

    static function saveAccount(array $data, $id=null) {
        self::ensureSchema();
        $account = $id ? self::getAccountById($id) : self::loadAccount();
        if (!$account) {
            db_query(sprintf(
                'INSERT INTO `%s` (`client_id`,`client_secret`,`redirect_uri`,`gmail_email`,`access_token`,`refresh_token`,`token_expires_at`,`processed_label`,`poll_query`,`active`,`created`,`updated`)
                 VALUES (%s, %s, %s, %s, %s, %s, %d, %s, %s, %d, NOW(), NOW())',
                self::tableName(),
                db_input($data['client_id'] ?? ''),
                db_input($data['client_secret'] ?? ''),
                db_input($data['redirect_uri'] ?? self::defaultRedirectUri()),
                db_input($data['gmail_email'] ?? ''),
                db_input($data['access_token'] ?? ''),
                db_input($data['refresh_token'] ?? ''),
                (int) ($data['token_expires_at'] ?? 0),
                db_input($data['processed_label'] ?? 'osTicket/Processed'),
                db_input($data['poll_query'] ?? 'is:unread'),
                (int) ($data['active'] ?? 1)
            ));
            return self::loadAccount();
        }

        $fields = array_merge(self::defaults(), $account, $data);
        db_query(sprintf(
            'UPDATE `%s`
                SET `client_id`=%s,
                    `client_secret`=%s,
                    `redirect_uri`=%s,
                    `gmail_email`=%s,
                    `access_token`=%s,
                    `refresh_token`=%s,
                    `token_expires_at`=%d,
                    `processed_label`=%s,
                    `poll_query`=%s,
                    `active`=%d,
                    `last_error`=%s,
                    `updated`=NOW()
              WHERE `id`=%d',
            self::tableName(),
            db_input($fields['client_id']),
            db_input($fields['client_secret']),
            db_input($fields['redirect_uri']),
            db_input($fields['gmail_email']),
            db_input($fields['access_token']),
            db_input($fields['refresh_token']),
            (int) $fields['token_expires_at'],
            db_input($fields['processed_label']),
            db_input($fields['poll_query']),
            (int) $fields['active'],
            db_input($fields['last_error']),
            (int) $fields['id']
        ));

        return self::loadAccount();
    }

    static function getAccountById($id) {
        self::ensureSchema();
        if (!($id = (int) $id))
            return null;
        $res = db_query('SELECT * FROM `'.self::tableName().'` WHERE `id`='.(int) $id.' LIMIT 1');
        return ($res && ($row = db_fetch_array($res))) ? $row : null;
    }

    static function upsertSettings(array $vars) {
        $account = self::loadAccount() ?: [];
        $account['client_id'] = trim((string) ($vars['client_id'] ?? ($vars['gmail_client_id'] ?? $account['client_id'] ?? '')));
        $account['client_secret'] = trim((string) ($vars['client_secret'] ?? ($vars['gmail_client_secret'] ?? $account['client_secret'] ?? '')));
        $account['redirect_uri'] = trim((string) ($vars['redirect_uri'] ?? ($vars['gmail_redirect_uri'] ?? $account['redirect_uri'] ?? self::defaultRedirectUri())));
        $account['processed_label'] = trim((string) ($vars['processed_label'] ?? ($vars['gmail_processed_label'] ?? $account['processed_label'] ?? 'osTicket/Processed')));
        $account['poll_query'] = trim((string) ($vars['poll_query'] ?? ($vars['gmail_poll_query'] ?? $account['poll_query'] ?? 'is:unread')));
        if (array_key_exists('active', $vars) || array_key_exists('gmail_active', $vars)) {
            $account['active'] = (!empty($vars['active']) || !empty($vars['gmail_active'])) ? 1 : 0;
        }
        $account['last_error'] = null;
        return self::saveAccount($account, $account['id'] ?? null);
    }

    static function getAuthUrl(array $account, $state=null) {
        if (empty($account['client_id']) || empty($account['client_secret']) || empty($account['redirect_uri']))
            throw new RuntimeException('Gmail OAuth credentials are incomplete');

        $query = [
            'client_id' => $account['client_id'],
            'redirect_uri' => $account['redirect_uri'],
            'response_type' => 'code',
            'scope' => implode(' ', [
                'https://www.googleapis.com/auth/gmail.modify',
                'https://www.googleapis.com/auth/gmail.send',
                'https://www.googleapis.com/auth/gmail.labels',
            ]),
            'access_type' => 'offline',
            'prompt' => 'consent',
            'include_granted_scopes' => 'true',
            'state' => $state ?: self::newState(),
        ];

        if (session_status() === PHP_SESSION_ACTIVE)
            $_SESSION['gmail_oauth_state'] = $query['state'];

        return 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    }

    static function newState() {
        return hash_hmac('sha256', session_id() . '|' . microtime(true), SECRET_SALT);
    }

    static function verifyState($state) {
        if (session_status() !== PHP_SESSION_ACTIVE)
            return true;
        if (empty($_SESSION['gmail_oauth_state']))
            return true;
        return hash_equals((string) $_SESSION['gmail_oauth_state'], (string) $state);
    }

    static function curlJson($url, array $fields, $method='POST', array $headers=[]) {
        $ch = curl_init($url);
        if (!$ch)
            throw new RuntimeException('Unable to initialize cURL');

        $headers[] = 'Content-Type: application/x-www-form-urlencoded';
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_POSTFIELDS => http_build_query($fields, '', '&', PHP_QUERY_RFC3986),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 60,
        ]);

        $response = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false)
            throw new RuntimeException($error ?: 'Unknown cURL error');

        $decoded = json_decode($response, true);
        if ($code >= 400) {
            $message = is_array($decoded)
                ? ($decoded['error_description'] ?? $decoded['error'] ?? $response)
                : $response;
            throw new RuntimeException($message, $code);
        }

        return is_array($decoded) ? $decoded : [];
    }

    static function apiRequest($method, $url, $accessToken, array $body=null) {
        $ch = curl_init($url);
        if (!$ch)
            throw new RuntimeException('Unable to initialize Gmail request');

        $headers = [
            'Authorization: Bearer '.$accessToken,
            'Accept: application/json',
        ];
        if ($body !== null)
            $headers[] = 'Content-Type: application/json';

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 60,
        ]);
        if ($body !== null)
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));

        $response = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false)
            throw new RuntimeException($error ?: 'Unknown Gmail API error');

        $decoded = json_decode($response, true);
        if ($code >= 400) {
            $message = is_array($decoded)
                ? ($decoded['error']['message'] ?? $decoded['error_description'] ?? $response)
                : $response;
            throw new RuntimeException($message, $code);
        }

        return is_array($decoded) ? $decoded : [];
    }

    static function exchangeCode(array $account, $code) {
        return self::curlJson('https://oauth2.googleapis.com/token', [
            'code' => $code,
            'client_id' => $account['client_id'],
            'client_secret' => $account['client_secret'],
            'redirect_uri' => $account['redirect_uri'],
            'grant_type' => 'authorization_code',
        ]);
    }

    static function refreshToken(array $account) {
        if (empty($account['refresh_token']))
            throw new RuntimeException('Missing Gmail refresh token');

        return self::curlJson('https://oauth2.googleapis.com/token', [
            'refresh_token' => $account['refresh_token'],
            'client_id' => $account['client_id'],
            'client_secret' => $account['client_secret'],
            'grant_type' => 'refresh_token',
        ]);
    }

    static function resolveAccessToken(array &$account) {
        if (!empty($account['access_token'])
                && !empty($account['token_expires_at'])
                && (int) $account['token_expires_at'] > (time() + 60)) {
            return $account['access_token'];
        }

        if (empty($account['refresh_token']))
            throw new RuntimeException('Gmail account is not connected yet');

        $token = self::refreshToken($account);
        $account['access_token'] = $token['access_token'] ?? '';
        if (!empty($token['expires_in']))
            $account['token_expires_at'] = time() + (int) $token['expires_in'];
        if (!empty($token['refresh_token']))
            $account['refresh_token'] = $token['refresh_token'];
        self::saveAccount($account, $account['id']);
        return $account['access_token'];
    }

    static function getProfile(array &$account) {
        $token = self::resolveAccessToken($account);
        return self::apiRequest('GET', 'https://gmail.googleapis.com/gmail/v1/users/me/profile', $token);
    }

    static function connected() {
        $account = self::loadAccount();
        return $account && !empty($account['refresh_token']);
    }

    static function summary() {
        $account = self::loadAccount() ?: self::defaults();
        return [
            'id' => $account['id'] ?? null,
            'active' => (int) ($account['active'] ?? 0),
            'connected' => !empty($account['refresh_token']),
            'gmail_email' => $account['gmail_email'] ?? '',
            'processed_label' => $account['processed_label'] ?? 'osTicket/Processed',
            'poll_query' => $account['poll_query'] ?? 'is:unread',
            'last_sync_at' => $account['last_sync_at'] ?? null,
            'last_error' => $account['last_error'] ?? null,
            'redirect_uri' => $account['redirect_uri'] ?? self::defaultRedirectUri(),
        ];
    }

    static function revokeTokenValue($token) {
        $token = trim((string) $token);
        if ($token === '')
            return true;

        try {
            self::curlJson('https://oauth2.googleapis.com/revoke', [
                'token' => $token,
            ]);
        } catch (Throwable $t) {
            return false;
        }
        return true;
    }

    static function disconnect() {
        $account = self::loadAccount();
        if (!$account)
            return self::summary();

        self::revokeTokenValue($account['refresh_token'] ?? '');
        self::revokeTokenValue($account['access_token'] ?? '');
        $account['access_token'] = '';
        $account['refresh_token'] = '';
        $account['token_expires_at'] = 0;
        $account['active'] = 0;
        $account['last_error'] = null;
        self::saveAccount($account, $account['id']);
        return self::summary();
    }

    static function testPoll($limit=5) {
        return self::run($limit);
    }

    static function ensureLabel(array &$account) {
        $labelName = trim((string) ($account['processed_label'] ?? ''));
        if ($labelName === '')
            return null;

        $token = self::resolveAccessToken($account);
        $labels = self::apiRequest('GET', 'https://gmail.googleapis.com/gmail/v1/users/me/labels', $token);
        foreach ($labels['labels'] ?? [] as $label) {
            if (!strcasecmp($label['name'] ?? '', $labelName))
                return $label['id'];
        }

        $created = self::apiRequest('POST', 'https://gmail.googleapis.com/gmail/v1/users/me/labels', $token, [
            'name' => $labelName,
            'labelListVisibility' => 'labelShow',
            'messageListVisibility' => 'show',
        ]);
        return $created['id'] ?? null;
    }

    static function listUnreadMessages(array &$account, $limit=20) {
        $token = self::resolveAccessToken($account);
        $query = trim((string) ($account['poll_query'] ?? 'is:unread'));
        if ($query === '')
            $query = 'is:unread';
        $labelQuery = self::gmailLabelQuery($account['processed_label'] ?? 'osTicket/Processed');
        if ($labelQuery !== '')
            $query .= ' -label:'.$labelQuery;
        $url = 'https://gmail.googleapis.com/gmail/v1/users/me/messages?'
            . http_build_query([
                'q' => $query,
                'maxResults' => (int) $limit,
            ], '', '&', PHP_QUERY_RFC3986);
        $result = self::apiRequest('GET', $url, $token);
        return $result['messages'] ?? [];
    }

    static function fetchRawMessage(array &$account, $messageId) {
        $token = self::resolveAccessToken($account);
        return self::apiRequest('GET',
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/'.rawurlencode($messageId).'?format=raw',
            $token);
    }

    static function decodeRawEmail($raw) {
        $raw = strtr((string) $raw, '-_', '+/');
        $pad = strlen($raw) % 4;
        if ($pad)
            $raw .= str_repeat('=', 4 - $pad);
        return base64_decode($raw, true) ?: '';
    }

    static function recordMessage($accountId, $messageId, $ticketNumber=null, $status='processed') {
        db_query(sprintf(
            'INSERT INTO `%s` (`account_id`,`gmail_message_id`,`ticket_number`,`status`,`created`)
             VALUES (%d, %s, %s, %s, NOW())
             ON DUPLICATE KEY UPDATE `status`=VALUES(`status`), `ticket_number`=VALUES(`ticket_number`)',
            self::messageTableName(),
            (int) $accountId,
            db_input($messageId),
            db_input($ticketNumber),
            db_input($status)
        ));
    }

    static function isMessageProcessed($accountId, $messageId) {
        $res = db_query(sprintf(
            'SELECT `id` FROM `%s` WHERE `account_id`=%d AND `gmail_message_id`=%s LIMIT 1',
            self::messageTableName(),
            (int) $accountId,
            db_input($messageId)
        ));
        return ($res && db_fetch_array($res)) ? true : false;
    }

    static function modifyMessageLabels(array &$account, $messageId, array $add=[], array $remove=['UNREAD']) {
        $token = self::resolveAccessToken($account);
        $payload = [];
        if ($add)
            $payload['addLabelIds'] = array_values($add);
        if ($remove)
            $payload['removeLabelIds'] = array_values($remove);
        return self::apiRequest('POST',
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/'.rawurlencode($messageId).'/modify',
            $token,
            $payload);
    }

    static function processAccount(array &$account, $limit=20) {
        global $ost;

        self::ensureSchema();
        self::loadTicketApi();

        if (empty($account['active']) || empty($account['refresh_token']) || empty($account['client_id']) || empty($account['client_secret']))
            return [
                'account_id' => (int) ($account['id'] ?? 0),
                'gmail_email' => $account['gmail_email'] ?? '',
                'processed' => 0,
                'skipped' => 0,
                'errors' => 0,
            ];

        $summary = [
            'account_id' => (int) ($account['id'] ?? 0),
            'gmail_email' => $account['gmail_email'] ?? '',
            'processed' => 0,
            'skipped' => 0,
            'errors' => 0,
        ];

        try {
            $profile = self::getProfile($account);
            if (!empty($profile['emailAddress'])) {
                $account['gmail_email'] = $profile['emailAddress'];
                self::saveAccount($account, $account['id']);
            }
            $labelId = null;
            try {
                $labelId = self::ensureLabel($account);
            } catch (Throwable $t) {
                // Labels are optional; continue without them if creation fails.
                $labelId = null;
            }

            $messages = self::listUnreadMessages($account, $limit);
            $pipe = new \PipeApiController('cli');
            foreach ($messages as $message) {
                $messageId = $message['id'] ?? null;
                if (!$messageId)
                    continue;
                if (self::isMessageProcessed($account['id'], $messageId)) {
                    $summary['skipped']++;
                    continue;
                }

                try {
                    $raw = self::fetchRawMessage($account, $messageId);
                    $email = self::decodeRawEmail($raw['raw'] ?? '');
                    if (!$email)
                        throw new RuntimeException('Unable to decode Gmail message payload');

                    $ticket = $pipe->processEmail($email, ['source' => 'Email']);
                    self::recordMessage($account['id'], $messageId,
                        is_object($ticket) && method_exists($ticket, 'getNumber') ? $ticket->getNumber() : null,
                        'processed');
                    self::modifyMessageLabels($account, $messageId,
                        $labelId ? [$labelId] : [],
                        ['UNREAD']);
                    $summary['processed']++;
                } catch (\TicketDenied $e) {
                    self::recordMessage($account['id'], $messageId, null, 'denied');
                    self::modifyMessageLabels($account, $messageId,
                        $labelId ? [$labelId] : [],
                        ['UNREAD']);
                    $summary['processed']++;
                } catch (\EmailParseError $e) {
                    self::recordMessage($account['id'], $messageId, null, 'parse_error');
                    self::modifyMessageLabels($account, $messageId,
                        $labelId ? [$labelId] : [],
                        ['UNREAD']);
                    $summary['errors']++;
                    if ($ost)
                        $ost->logWarning('Gmail API', $e->getMessage(), false);
                } catch (Throwable $t) {
                    self::recordMessage($account['id'], $messageId, null, 'error');
                    $summary['errors']++;
                    if ($ost)
                        $ost->logWarning('Gmail API', $t->getMessage(), false);
                }
            }

            $account['last_sync_at'] = date('Y-m-d H:i:s');
            $account['last_error'] = null;
            self::saveAccount($account, $account['id']);
        } catch (Throwable $t) {
            $account['last_error'] = $t->getMessage();
            self::saveAccount($account, $account['id']);
            if ($ost)
                $ost->logWarning('Gmail API', $t->getMessage(), false);
            $summary['errors']++;
        }

        return $summary;
    }

    static function run($limit=20) {
        self::ensureSchema();
        $account = self::loadAccount();
        if (!$account || empty($account['active']) || empty($account['refresh_token']))
            return ['processed' => 0, 'errors' => 0, 'skipped' => 0];

        return self::processAccount($account, $limit);
    }

    static function sendMessage(\osTicket\Mail\Message $message, $fromEmail=null) {
        self::ensureSchema();
        $account = self::loadAccount();
        if (!$account || empty($account['active']) || empty($account['refresh_token']))
            return false;

        if ($fromEmail && !empty($account['gmail_email'])
                && strcasecmp($fromEmail, $account['gmail_email']) !== 0)
            return false;

        $token = self::resolveAccessToken($account);
        $raw = $message->toString();
        $raw = rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
        $response = self::apiRequest('POST',
            'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
            $token,
            ['raw' => $raw]);

        $account['last_sync_at'] = date('Y-m-d H:i:s');
        $account['last_error'] = null;
        self::saveAccount($account, $account['id']);

        return $response['id'] ?? true;
    }

    static function log($title, $message) {
        global $ost;
        if ($ost)
            $ost->logWarning($title, $message, false);
    }
}
