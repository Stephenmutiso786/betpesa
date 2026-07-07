<?php
session_start();
require_once('assets/constants/config.php');
require_once('assets/constants/fetch-my-info.php');

function submitSupportTicket(array $payload, $apiUrl, $apiKey, &$error = null) {
    $json = json_encode($payload);
    if ($json === false) {
        $error = 'Unable to encode ticket payload.';
        return false;
    }

    if (!$apiUrl || !$apiKey) {
        $error = 'Support desk integration is not configured yet.';
        return false;
    }

    if (function_exists('curl_init')) {
        $ch = curl_init($apiUrl);
        curl_setopt_array($ch, array(
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => array(
                'Content-Type: application/json',
                'X-API-Key: ' . $apiKey,
            ),
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
        ));
        $body = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        if ($body === false || $status >= 400) {
            $error = $curlError ?: ($body ?: 'Support desk request failed.');
            return false;
        }

        return array($status, trim((string) $body));
    }

    $context = stream_context_create(array(
        'http' => array(
            'method' => 'POST',
            'header' => implode("\r\n", array(
                'Content-Type: application/json',
                'X-API-Key: ' . $apiKey,
            )),
            'content' => $json,
            'ignore_errors' => true,
            'timeout' => 20,
        ),
    ));

    $body = @file_get_contents($apiUrl, false, $context);
    $status = 0;
    if (isset($http_response_header[0]) && preg_match('{HTTP/\S+\s+(\d+)}', $http_response_header[0], $m)) {
        $status = (int) $m[1];
    }

    if ($body === false || $status >= 400) {
        $error = $body ?: 'Support desk request failed.';
        return false;
    }

    return array($status, trim((string) $body));
}

$sql = "SELECT * FROM manage_website where status='0'";
$statement = $conn->prepare($sql);
$statement->execute();
$row = $statement->fetch(PDO::FETCH_ASSOC);
extract($row);

$errors = array();
$notice = '';
$ticketNumber = '';
$values = array(
    'name' => '',
    'email' => '',
    'subject' => '',
    'message' => '',
);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    foreach ($values as $key => $value) {
        $values[$key] = trim($_POST[$key] ?? '');
    }

    if ($values['name'] === '') {
        $errors['name'] = 'Please enter your name.';
    }
    if (!filter_var($values['email'], FILTER_VALIDATE_EMAIL)) {
        $errors['email'] = 'Please enter a valid email address.';
    }
    if ($values['subject'] === '') {
        $errors['subject'] = 'Please enter a subject.';
    }
    if ($values['message'] === '') {
        $errors['message'] = 'Please enter your message.';
    }

    if (!$errors) {
        $payload = array(
            'name' => $values['name'],
            'email' => $values['email'],
            'subject' => $values['subject'],
            'message' => $values['message'],
            'topicId' => (int) $osticket_help_topic_id,
            'source' => $osticket_source ?: 'Web',
            'alert' => true,
            'autorespond' => true,
        );

        $responseError = null;
        $result = submitSupportTicket($payload, $osticket_api_url, $osticket_api_key, $responseError);
        if ($result) {
            list($httpStatus, $responseBody) = $result;
            if ((int) $httpStatus === 201 && $responseBody !== '') {
                $ticketNumber = $responseBody;
                $notice = 'Thanks. Your support ticket has been created as #' . htmlspecialchars($ticketNumber, ENT_QUOTES, 'UTF-8') . '.';
                $values = array_fill_keys(array_keys($values), '');
            } else {
                $errors['err'] = 'The support desk did not accept the request.';
            }
        } else {
            $errors['err'] = $responseError ?: 'Unable to send your request right now.';
        }
    }
}
?>
<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <title><?php echo htmlspecialchars($title); ?> - Contact Support</title>
    <link rel="stylesheet" href="admin/assets/vendor/bootstrap/css/bootstrap.min.css">
    <link href="admin/assets/vendor/fonts/circular-std/style.css" rel="stylesheet">
    <link rel="stylesheet" href="admin/assets/libs/css/style.css">
    <link rel="stylesheet" href="admin/assets/vendor/fonts/fontawesome/css/fontawesome-all.css">
    <style>
    html, body { height: 100%; }
    body {
        display: -ms-flexbox;
        display: flex;
        -ms-flex-align: center;
        align-items: center;
        padding-top: 40px;
        padding-bottom: 40px;
    }
    .support-card {
        border: 0;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.26);
    }
    .support-card .card-header {
        background: linear-gradient(135deg, rgba(27,35,46,.96), rgba(58,74,95,.96));
        color: #fff;
        border-bottom: 0;
    }
    .support-link {
        color: #fff;
        text-decoration: underline;
    }
    .support-link:hover { color: #d8e7ff; }
    .support-note {
        font-size: 0.95rem;
        color: #6c757d;
    }
    </style>
</head>
<body style="background-image: url('assets/uploadImage/Logo/<?php echo $background_login_image; ?>'); background-repeat: no-repeat; background-size: cover;">
    <div class="splash-container" style="width: 540px;">
        <div class="card support-card">
            <div class="card-header text-center">
                <a href="index.php"><img class="img-fluid" src="assets/uploadImage/Logo/<?php echo $logo; ?>" style="width:300px;height:auto;" alt="Logo"></a>
                <div class="mt-2">Contact Support</div>
            </div>
            <div class="card-body">
                <?php if ($notice) { ?>
                    <div class="alert alert-success"><?php echo $notice; ?></div>
                <?php } ?>
                <?php if (!empty($errors['err'])) { ?>
                    <div class="alert alert-danger"><?php echo htmlspecialchars($errors['err']); ?></div>
                <?php } ?>
                <p class="support-note">Send a request and we will create a real support ticket in osTicket for HR and the admins to review.</p>
                <form action="" method="POST" autocomplete="off">
                    <div class="form-group">
                        <input class="form-control form-control-lg" type="text" name="name" placeholder="Your name" value="<?php echo htmlspecialchars($values['name']); ?>">
                        <div class="text-danger small"><?php echo $errors['name'] ?? ''; ?></div>
                    </div>
                    <div class="form-group">
                        <input class="form-control form-control-lg" type="email" name="email" placeholder="Email address" value="<?php echo htmlspecialchars($values['email']); ?>">
                        <div class="text-danger small"><?php echo $errors['email'] ?? ''; ?></div>
                    </div>
                    <div class="form-group">
                        <input class="form-control form-control-lg" type="text" name="subject" placeholder="Subject" value="<?php echo htmlspecialchars($values['subject']); ?>">
                        <div class="text-danger small"><?php echo $errors['subject'] ?? ''; ?></div>
                    </div>
                    <div class="form-group">
                        <textarea class="form-control" name="message" rows="6" placeholder="How can we help?"><?php echo htmlspecialchars($values['message']); ?></textarea>
                        <div class="text-danger small"><?php echo $errors['message'] ?? ''; ?></div>
                    </div>
                    <button type="submit" class="btn btn-primary btn-lg btn-block">Send Support Request</button>
                </form>
            </div>
            <div class="card-footer bg-white text-center">
                <a href="index.php" class="footer-link">Back to Login</a>
            </div>
        </div>
    </div>
    <script src="admin/assets/vendor/jquery/jquery-3.3.1.min.js"></script>
    <script src="admin/assets/vendor/bootstrap/js/bootstrap.bundle.js"></script>
</body>
</html>
