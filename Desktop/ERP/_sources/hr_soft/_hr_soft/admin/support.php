<?php
error_reporting(0);
require_once('../assets/constants/config.php');
require_once('../assets/constants/check-login.php');
require_once('../assets/constants/fetch-my-info.php');

$stmt = $conn->prepare("SELECT * FROM admin WHERE id='" . $_SESSION['id'] . "'");
$stmt->execute();
$result = $stmt->fetch(PDO::FETCH_ASSOC);

$apiConfigured = !empty($osticket_api_url) && !empty($osticket_api_key);
$supportUrl = '../contact.php';
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
            <div class="col-xl-4 col-lg-4 col-md-12 col-sm-12 col-12">
                <div class="card border-0 shadow-sm">
                    <div class="card-body">
                        <h4 class="card-title">Support Desk</h4>
                        <p class="text-muted mb-4">Public requests are created as real tickets and can notify HR and admins by email.</p>
                        <a class="btn btn-primary btn-block mb-2" href="<?php echo $supportUrl; ?>" target="_blank" rel="noopener">Open Public Contact Form</a>
                        <a class="btn btn-outline-secondary btn-block" href="../index.php">View Public Site</a>
                    </div>
                </div>
            </div>

            <div class="col-xl-8 col-lg-8 col-md-12 col-sm-12 col-12">
                <div class="card border-0 shadow-sm">
                    <div class="card-body">
                        <h4 class="card-title">Integration Status</h4>
                        <?php if ($apiConfigured) { ?>
                            <div class="alert alert-success">osTicket API is configured and ready.</div>
                        <?php } else { ?>
                            <div class="alert alert-warning">osTicket API is not configured yet. Add the API URL and API key in <code>assets/constants/config.php</code>.</div>
                        <?php } ?>

                        <div class="table-responsive">
                            <table class="table table-striped">
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
    </div>
    <?php include('include/footer.php'); ?>
</div>

<script src="assets/vendor/jquery/jquery-3.3.1.min.js"></script>
<script src="assets/vendor/bootstrap/js/bootstrap.bundle.js"></script>
<script src="assets/vendor/slimscroll/jquery.slimscroll.js"></script>
<script src="assets/libs/js/main-js.js"></script>
