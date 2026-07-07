<?php
error_reporting(0);
require_once('../assets/constants/config.php');
require_once('../assets/constants/check-login.php');
require_once('../assets/constants/fetch-my-info.php');

$conn->exec(
    "CREATE TABLE IF NOT EXISTS support_requests (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(191) NOT NULL,
        email VARCHAR(191) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'submitted',
        ticket_number VARCHAR(64) DEFAULT NULL,
        response_code INT DEFAULT NULL,
        response_body TEXT DEFAULT NULL,
        error_message TEXT DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_created_at (created_at),
        INDEX idx_status (status),
        INDEX idx_ticket_number (ticket_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
);

$stmt = $conn->prepare("SELECT * FROM admin WHERE id='" . $_SESSION['id'] . "'");
$stmt->execute();
$result = $stmt->fetch(PDO::FETCH_ASSOC);

$apiConfigured = !empty($osticket_api_url) && !empty($osticket_api_key);
$supportUrl = '../contact.php';

$supportStats = array(
    'total' => 0,
    'today' => 0,
    'created' => 0,
    'failed' => 0,
);
$recentRequests = array();

try {
    $supportStats['total'] = (int) $conn->query("SELECT COUNT(*) FROM support_requests")->fetchColumn();
    $supportStats['today'] = (int) $conn->query("SELECT COUNT(*) FROM support_requests WHERE DATE(created_at) = CURDATE()")->fetchColumn();
    $supportStats['created'] = (int) $conn->query("SELECT COUNT(*) FROM support_requests WHERE status = 'created'")->fetchColumn();
    $supportStats['failed'] = (int) $conn->query("SELECT COUNT(*) FROM support_requests WHERE status IN ('failed', 'rejected')")->fetchColumn();

    $recentStmt = $conn->query("SELECT id, name, email, subject, status, ticket_number, created_at FROM support_requests ORDER BY created_at DESC, id DESC LIMIT 5");
    $recentRequests = $recentStmt ? $recentStmt->fetchAll(PDO::FETCH_ASSOC) : array();
} catch (Exception $e) {
    // Keep the support page accessible even if the log table is unavailable.
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
                    <h2 class="pageheader-title">Support</h2>
                    <div class="page-breadcrumb">
                        <nav aria-label="breadcrumb">
                            <ol class="breadcrumb">
                                <li class="breadcrumb-item"><a href="index.php" class="breadcrumb-link">Home</a></li>
                                <li class="breadcrumb-item active" aria-current="page">Support</li>
                            </ol>
                        </nav>
                    </div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-xl-3 col-lg-6 col-md-6 col-sm-12 col-12">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <p class="text-muted mb-1">Total Requests</p>
                                <h2 class="mb-0"><?php echo number_format($supportStats['total']); ?></h2>
                            </div>
                            <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style="width:48px;height:48px;">
                                <i class="fas fa-inbox"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-xl-3 col-lg-6 col-md-6 col-sm-12 col-12">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <p class="text-muted mb-1">Today</p>
                                <h2 class="mb-0"><?php echo number_format($supportStats['today']); ?></h2>
                            </div>
                            <div class="rounded-circle bg-info text-white d-flex align-items-center justify-content-center" style="width:48px;height:48px;">
                                <i class="fas fa-calendar-day"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-xl-3 col-lg-6 col-md-6 col-sm-12 col-12">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <p class="text-muted mb-1">Created</p>
                                <h2 class="mb-0"><?php echo number_format($supportStats['created']); ?></h2>
                            </div>
                            <div class="rounded-circle bg-success text-white d-flex align-items-center justify-content-center" style="width:48px;height:48px;">
                                <i class="fas fa-check"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-xl-3 col-lg-6 col-md-6 col-sm-12 col-12">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <p class="text-muted mb-1">Needs Attention</p>
                                <h2 class="mb-0"><?php echo number_format($supportStats['failed']); ?></h2>
                            </div>
                            <div class="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center" style="width:48px;height:48px;">
                                <i class="fas fa-exclamation-triangle"></i>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mt-4">
            <div class="col-xl-4 col-lg-12 col-md-12 col-sm-12 col-12">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-body">
                        <h4 class="card-title">Support Desk</h4>
                        <p class="text-muted mb-4">Public requests become real tickets and can notify HR and admins by email.</p>
                        <button class="btn btn-primary btn-block mb-2" type="button" data-toggle="modal" data-target="#supportFormModal">Open Public Contact Form</button>
                        <a class="btn btn-info btn-block mb-2" href="send_email.php">Send Email to User</a>
                        <a class="btn btn-outline-secondary btn-block" href="../index.php">View Public Site</a>
                    </div>
                </div>
            </div>

            <div class="col-xl-8 col-lg-12 col-md-12 col-sm-12 col-12">
                <div class="card border-0 shadow-sm h-100">
                    <div class="card-body">
                        <div class="d-flex flex-wrap justify-content-between align-items-center mb-3">
                            <h4 class="card-title mb-0">Integration Status</h4>
                            <span class="badge badge-<?php echo $apiConfigured ? 'success' : 'warning'; ?> p-2"><?php echo $apiConfigured ? 'Connected' : 'Needs setup'; ?></span>
                        </div>
                        <?php if ($apiConfigured) { ?>
                            <div class="alert alert-success">osTicket API is configured and ready.</div>
                        <?php } else { ?>
                            <div class="alert alert-warning">osTicket API is not configured yet. Add the API URL and API key in <code>assets/constants/config.php</code>.</div>
                        <?php } ?>

                        <div class="table-responsive">
                            <table class="table table-striped mb-0">
                                <tbody>
                                    <tr>
                                        <th style="width: 220px;">API URL</th>
                                        <td><?php echo htmlspecialchars($osticket_api_url ?: 'Not set'); ?></td>
                                    </tr>
                                    <tr>
                                        <th>Help Topic ID</th>
                                        <td><?php echo htmlspecialchars((string) $osticket_help_topic_id); ?></td>
                                    </tr>
                                    <tr>
                                        <th>Ticket Source</th>
                                        <td><?php echo htmlspecialchars($osticket_source ?: 'Web'); ?></td>
                                    </tr>
                                    <tr>
                                        <th>Current Mode</th>
                                        <td>Support requests go through the contact form and become tickets in osTicket.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="row mt-4">
            <div class="col-12">
                <div class="card border-0 shadow-sm">
                    <div class="card-body">
                        <div class="d-flex flex-wrap justify-content-between align-items-center mb-3">
                            <h4 class="card-title mb-0">Recent Requests</h4>
                            <small class="text-muted">Latest submissions from the public contact form</small>
                        </div>

                        <div class="table-responsive">
                            <table class="table table-hover mb-0">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Email</th>
                                        <th>Subject</th>
                                        <th>Status</th>
                                        <th>Ticket</th>
                                        <th>Created</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php if ($recentRequests) { foreach ($recentRequests as $request) { ?>
                                        <tr>
                                            <td><?php echo htmlspecialchars($request['name']); ?></td>
                                            <td><?php echo htmlspecialchars($request['email']); ?></td>
                                            <td><?php echo htmlspecialchars($request['subject']); ?></td>
                                            <td>
                                                <span class="badge badge-<?php echo $request['status'] === 'created' ? 'success' : ($request['status'] === 'failed' ? 'danger' : 'warning'); ?>">
                                                    <?php echo htmlspecialchars(ucfirst($request['status'])); ?>
                                                </span>
                                            </td>
                                            <td><?php echo htmlspecialchars($request['ticket_number'] ?: '-'); ?></td>
                                            <td><?php echo htmlspecialchars(date('M j, Y g:i a', strtotime($request['created_at']))); ?></td>
                                        </tr>
                                    <?php } } else { ?>
                                        <tr>
                                            <td colspan="6" class="text-center text-muted py-4">No support requests yet.</td>
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

    <div class="modal fade" id="supportFormModal" tabindex="-1" role="dialog" aria-labelledby="supportFormModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl modal-dialog-centered" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <div>
                        <h5 class="modal-title" id="supportFormModalLabel">Public Contact Form</h5>
                        <small class="text-muted">Use this to submit a real support ticket from the public site</small>
                    </div>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body p-0" style="height: 78vh;">
                    <iframe src="<?php echo htmlspecialchars($supportUrl); ?>" title="Public contact form" style="border:0;width:100%;height:100%;"></iframe>
                </div>
                <div class="modal-footer">
                    <a class="btn btn-outline-secondary" href="<?php echo htmlspecialchars($supportUrl); ?>" target="_blank" rel="noopener">Open in New Tab</a>
                    <button type="button" class="btn btn-primary" data-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    </div>

    <?php include('include/footer.php'); ?>
</div>

<script src="assets/vendor/jquery/jquery-3.3.1.min.js"></script>
<script src="assets/vendor/bootstrap/js/bootstrap.bundle.js"></script>
<script src="assets/vendor/slimscroll/jquery.slimscroll.js"></script>
<script src="assets/libs/js/main-js.js"></script>
