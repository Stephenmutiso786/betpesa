<?php
error_reporting(0);
require_once('../assets/constants/config.php');
require_once('../assets/constants/check-login.php');
require_once('../assets/constants/fetch-my-info.php');

$conn->exec(
    "CREATE TABLE IF NOT EXISTS outbound_email_log (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        recipient_name VARCHAR(191) NOT NULL,
        recipient_email VARCHAR(191) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'sent',
        error_message TEXT DEFAULT NULL,
        sent_by_id INT DEFAULT NULL,
        sent_by_email VARCHAR(191) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at),
        INDEX idx_status (status),
        INDEX idx_recipient_email (recipient_email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
);

$stmt = $conn->prepare("SELECT * FROM admin WHERE id='" . $_SESSION['id'] . "'");
$stmt->execute();
$currentAdmin = $stmt->fetch(PDO::FETCH_ASSOC);

$employees = array();
$employeeStmt = $conn->query("SELECT id, fname, lname, email, desig FROM admin WHERE delete_status='0' ORDER BY fname, lname");
if ($employeeStmt) {
    $employees = $employeeStmt->fetchAll(PDO::FETCH_ASSOC);
}

$notice = '';
$errors = array();
$values = array(
    'recipient_id' => '',
    'recipient_name' => '',
    'recipient_email' => '',
    'subject' => '',
    'message' => '',
);

function sendHtmlMailMessage($toEmail, $toName, $subject, $message, $fromName, $fromEmail, $replyTo, &$error = null) {
    if (!function_exists('mail')) {
        $error = 'Mail function is not available on this server.';
        return false;
    }

    $safeFromName = trim((string) $fromName) !== '' ? trim((string) $fromName) : 'HR Support';
    $safeFromEmail = filter_var($fromEmail, FILTER_VALIDATE_EMAIL) ? $fromEmail : 'no-reply@' . preg_replace('/[^a-z0-9.-]/i', '', $_SERVER['SERVER_NAME'] ?? 'localhost');
    $safeReplyTo = filter_var($replyTo, FILTER_VALIDATE_EMAIL) ? $replyTo : $safeFromEmail;

    $subjectLine = trim((string) $subject);
    $htmlBody = '<!doctype html><html><body style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,sans-serif;color:#1f2937;">'
        . '<div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">'
        . '<div style="background:linear-gradient(135deg,#0f172a,#334155);color:#fff;padding:24px 28px;">'
        . '<h2 style="margin:0;font-size:20px;">' . htmlspecialchars($safeFromName, ENT_QUOTES, 'UTF-8') . '</h2>'
        . '<p style="margin:8px 0 0;color:#cbd5e1;">This message was sent from the HR admin panel.</p>'
        . '</div>'
        . '<div style="padding:28px;">'
        . '<p style="margin-top:0;">Dear ' . htmlspecialchars(trim((string) $toName) !== '' ? $toName : $toEmail, ENT_QUOTES, 'UTF-8') . ',</p>'
        . '<div style="line-height:1.7;font-size:15px;color:#334155;">' . nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8')) . '</div>'
        . '<p style="margin-top:28px;">Regards,<br>' . htmlspecialchars($safeFromName, ENT_QUOTES, 'UTF-8') . '</p>'
        . '</div></div></body></html>';

    $headers = array(
        'MIME-Version: 1.0',
        'Content-type: text/html; charset=UTF-8',
        'From: ' . $safeFromName . ' <' . $safeFromEmail . '>',
        'Reply-To: ' . $safeReplyTo,
        'X-Mailer: PHP/' . phpversion(),
    );

    $sent = @mail($toEmail, $subjectLine, $htmlBody, implode("\r\n", $headers));
    if (!$sent) {
        $error = 'The server could not send the email right now.';
        return false;
    }

    return true;
}

function logOutboundEmail(PDO $conn, array $payload) {
    $stmt = $conn->prepare(
        "INSERT INTO outbound_email_log
            (recipient_name, recipient_email, subject, message, status, error_message, sent_by_id, sent_by_email)
         VALUES
            (:recipient_name, :recipient_email, :subject, :message, :status, :error_message, :sent_by_id, :sent_by_email)"
    );
    $stmt->execute(array(
        ':recipient_name' => $payload['recipient_name'],
        ':recipient_email' => $payload['recipient_email'],
        ':subject' => $payload['subject'],
        ':message' => $payload['message'],
        ':status' => $payload['status'],
        ':error_message' => $payload['error_message'],
        ':sent_by_id' => $payload['sent_by_id'],
        ':sent_by_email' => $payload['sent_by_email'],
    ));
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    foreach ($values as $key => $value) {
        $values[$key] = trim($_POST[$key] ?? '');
    }

    $logRecipientName = $values['recipient_name'];
    $logRecipientEmail = $values['recipient_email'];

    if ($values['recipient_id'] !== '') {
        $employeeStmt = $conn->prepare("SELECT id, fname, lname, email FROM admin WHERE id = :id AND delete_status='0' LIMIT 1");
        $employeeStmt->execute(array(':id' => (int) $values['recipient_id']));
        $employee = $employeeStmt->fetch(PDO::FETCH_ASSOC);
        if ($employee) {
            $values['recipient_name'] = trim($employee['fname'] . ' ' . $employee['lname']);
            $values['recipient_email'] = $employee['email'];
            $logRecipientName = $values['recipient_name'];
            $logRecipientEmail = $values['recipient_email'];
        }
    }

    if ($values['recipient_name'] === '') {
        $errors['recipient_name'] = 'Please choose a recipient.';
    }
    if (!filter_var($values['recipient_email'], FILTER_VALIDATE_EMAIL)) {
        $errors['recipient_email'] = 'Please enter a valid recipient email.';
    }
    if ($values['subject'] === '') {
        $errors['subject'] = 'Please enter a subject.';
    }
    if ($values['message'] === '') {
        $errors['message'] = 'Please enter a message.';
    }

    if (!$errors) {
        $fromName = $mail_from_name ?: ($title ?? 'HR Support');
        $fromEmail = $mail_from_email ?: ($currentAdmin['email'] ?? '');
        $replyTo = $mail_reply_to ?: $fromEmail;
        $sendError = null;
        $status = 'sent';
        $logSubject = $values['subject'];
        $logMessage = $values['message'];
        if (!sendHtmlMailMessage($values['recipient_email'], $values['recipient_name'], $values['subject'], $values['message'], $fromName, $fromEmail, $replyTo, $sendError)) {
            $status = 'failed';
            $errors['err'] = $sendError ?: 'Unable to send email.';
        } else {
            $notice = 'Email sent to ' . htmlspecialchars($values['recipient_name'], ENT_QUOTES, 'UTF-8') . '.';
            $values = array_fill_keys(array_keys($values), '');
        }

        try {
            logOutboundEmail($conn, array(
                'recipient_name' => $logRecipientName,
                'recipient_email' => $logRecipientEmail,
                'subject' => $logSubject,
                'message' => $logMessage,
                'status' => $status,
                'error_message' => $sendError ?? null,
                'sent_by_id' => $currentAdmin['id'] ?? null,
                'sent_by_email' => $currentAdmin['email'] ?? null,
            ));
        } catch (Exception $e) {
            // Keep the send flow intact even if logging fails.
        }
    }
}

$recentEmails = array();
try {
    $recentStmt = $conn->query("SELECT recipient_name, recipient_email, subject, status, error_message, created_at FROM outbound_email_log ORDER BY created_at DESC, id DESC LIMIT 6");
    $recentEmails = $recentStmt ? $recentStmt->fetchAll(PDO::FETCH_ASSOC) : array();
} catch (Exception $e) {
}

?>
<?php include('include/head.php'); ?>
<?php include('include/header.php'); ?>
<?php include('include/sidebar.php'); ?>

<div class="dashboard-wrapper">
    <div class="container-fluid dashboard-content">
        <div class="row">
            <div class="col-xl-12 col-lg-12 col-md-12 col-sm-12 col-12">
                <div class="page-header">
                    <h2 class="pageheader-title">Send Email</h2>
                    <div class="page-breadcrumb">
                        <nav aria-label="breadcrumb">
                            <ol class="breadcrumb">
                                <li class="breadcrumb-item"><a href="index.php" class="breadcrumb-link">Home</a></li>
                                <li class="breadcrumb-item active" aria-current="page">Send Email</li>
                            </ol>
                        </nav>
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-xl-7 col-lg-12 col-md-12 col-sm-12 col-12">
                <div class="card border-0 shadow-sm">
                    <div class="card-body">
                        <h4 class="card-title">Compose Message</h4>
                        <p class="text-muted">Send one message to one employee or admin in the system.</p>

                        <?php if ($notice) { ?>
                            <div class="alert alert-success"><?php echo $notice; ?></div>
                        <?php } ?>
                        <?php if (!empty($errors['err'])) { ?>
                            <div class="alert alert-danger"><?php echo htmlspecialchars($errors['err']); ?></div>
                        <?php } ?>

                        <form method="post" autocomplete="off">
                            <div class="form-group">
                                <label for="recipient_id">Recipient</label>
                                <select class="form-control select2" id="recipient_id" name="recipient_id">
                                    <option value="">Select one user</option>
                                    <?php foreach ($employees as $employee) { ?>
                                        <?php $fullName = trim($employee['fname'] . ' ' . $employee['lname']); ?>
                                        <option value="<?php echo htmlspecialchars($employee['id']); ?>"
                                            data-name="<?php echo htmlspecialchars($fullName, ENT_QUOTES, 'UTF-8'); ?>"
                                            data-email="<?php echo htmlspecialchars($employee['email'], ENT_QUOTES, 'UTF-8'); ?>"
                                            <?php echo ($values['recipient_id'] == $employee['id']) ? 'selected' : ''; ?>>
                                            <?php echo htmlspecialchars($fullName . ' - ' . $employee['email']); ?>
                                        </option>
                                    <?php } ?>
                                </select>
                                <div class="text-danger small"><?php echo $errors['recipient_name'] ?? ''; ?></div>
                            </div>

                            <div class="form-row">
                                <div class="form-group col-md-6">
                                    <label for="recipient_name">Recipient Name</label>
                                    <input type="text" class="form-control" id="recipient_name" name="recipient_name" value="<?php echo htmlspecialchars($values['recipient_name']); ?>" placeholder="Auto-filled from the selected user">
                                </div>
                                <div class="form-group col-md-6">
                                    <label for="recipient_email">Recipient Email</label>
                                    <input type="email" class="form-control" id="recipient_email" name="recipient_email" value="<?php echo htmlspecialchars($values['recipient_email']); ?>" placeholder="Auto-filled from the selected user">
                                    <div class="text-danger small"><?php echo $errors['recipient_email'] ?? ''; ?></div>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="subject">Subject</label>
                                <input type="text" class="form-control" id="subject" name="subject" value="<?php echo htmlspecialchars($values['subject']); ?>" placeholder="Email subject">
                                <div class="text-danger small"><?php echo $errors['subject'] ?? ''; ?></div>
                            </div>

                            <div class="form-group">
                                <label for="message">Message</label>
                                <textarea class="form-control" id="message" name="message" rows="8" placeholder="Write the message here"><?php echo htmlspecialchars($values['message']); ?></textarea>
                                <div class="text-danger small"><?php echo $errors['message'] ?? ''; ?></div>
                            </div>

                            <button type="submit" class="btn btn-primary">Send Email</button>
                            <a href="support.php" class="btn btn-outline-secondary">Back to Support</a>
                        </form>
                    </div>
                </div>
            </div>

            <div class="col-xl-5 col-lg-12 col-md-12 col-sm-12 col-12">
                <div class="card border-0 shadow-sm mb-4">
                    <div class="card-body">
                        <h4 class="card-title">Delivery Setup</h4>
                        <table class="table table-sm mb-0">
                            <tbody>
                                <tr>
                                    <th>From Name</th>
                                    <td><?php echo htmlspecialchars($mail_from_name ?: 'HR Support'); ?></td>
                                </tr>
                                <tr>
                                    <th>From Email</th>
                                    <td><?php echo htmlspecialchars($mail_from_email ?: ($currentAdmin['email'] ?? 'Not set')); ?></td>
                                </tr>
                                <tr>
                                    <th>Reply-To</th>
                                    <td><?php echo htmlspecialchars($mail_reply_to ?: ($mail_from_email ?: ($currentAdmin['email'] ?? 'Not set'))); ?></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="card border-0 shadow-sm">
                    <div class="card-body">
                        <h4 class="card-title">Recent Sends</h4>
                        <div class="table-responsive">
                            <table class="table table-hover mb-0">
                                <thead>
                                    <tr>
                                        <th>Recipient</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php if ($recentEmails) { foreach ($recentEmails as $email) { ?>
                                        <tr>
                                            <td>
                                                <div><?php echo htmlspecialchars($email['recipient_name']); ?></div>
                                                <small class="text-muted"><?php echo htmlspecialchars($email['recipient_email']); ?></small>
                                            </td>
                                            <td>
                                                <span class="badge badge-<?php echo $email['status'] === 'sent' ? 'success' : 'danger'; ?>">
                                                    <?php echo htmlspecialchars(ucfirst($email['status'])); ?>
                                                </span>
                                            </td>
                                        </tr>
                                    <?php } } else { ?>
                                        <tr>
                                            <td colspan="2" class="text-center text-muted">No emails sent yet.</td>
                                        </tr>
                                    <?php } ?>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <?php include('include/footer.php'); ?>
</div>

<script src="assets/vendor/jquery/jquery-3.3.1.min.js"></script>
<script src="assets/vendor/bootstrap/js/bootstrap.bundle.js"></script>
<script src="assets/vendor/slimscroll/jquery.slimscroll.js"></script>
<script src="assets/vendor/multi-select/js/jquery.multi-select.js"></script>
<script src="assets/libs/js/main-js.js"></script>
<script src="https://cdn.jsdelivr.net/npm/select2@4.1.0-rc.0/dist/js/select2.min.js"></script>
<script>
$(function() {
    $('.select2').select2({
        width: '100%'
    });

    $('#recipient_id').on('change', function() {
        var option = this.options[this.selectedIndex];
        if (!option || !option.value) {
            $('#recipient_name').val('');
            $('#recipient_email').val('');
            return;
        }

        $('#recipient_name').val($(option).data('name') || '');
        $('#recipient_email').val($(option).data('email') || '');
    });
});
</script>
</body>
</html>
