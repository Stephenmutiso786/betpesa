<?php
if(!defined('OSTADMININC') || !$thisstaff || !$thisstaff->isAdmin() || !$config) die('Access Denied');
?>
<h2><?php echo __('Email Settings and Options');?></h2>
<form action="emailsettings.php" method="post" class="save">
<?php csrf_token(); ?>
<input type="hidden" name="t" value="emails" >
<table class="form_table settings_table" width="940" border="0" cellspacing="0" cellpadding="2">
    <thead>
        <tr>
            <th colspan="2">
                <em><?php echo __('Note that some of the global settings can be overridden at department/email level.');?></em>
            </th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td width="180" class="required"><?php echo __('Default Template Set'); ?>:</td>
            <td>
                <select name="default_template_id">
                    <option value="">&mdash; <?php echo __('Select Default Email Template Set'); ?> &mdash;</option>
                    <?php
                    $sql='SELECT tpl_id, name FROM '.EMAIL_TEMPLATE_GRP_TABLE
                        .' WHERE isactive =1 ORDER BY name';
                    if(($res=db_query($sql)) && db_num_rows($res)){
                        while (list($id, $name) = db_fetch_row($res)){
                            $selected = ($config['default_template_id']==$id)?'selected="selected"':''; ?>
                            <option value="<?php echo $id; ?>"<?php echo $selected; ?>><?php echo $name; ?></option>
                        <?php
                        }
                    } ?>
                </select>&nbsp;<font class="error">*&nbsp;<?php echo $errors['default_template_id']; ?></font>
                <i class="help-tip icon-question-sign" href="#default_email_templates"></i>
            </td>
        </tr>
        <tr>
            <td width="180" class="required"><?php echo __('Default System Email');?>:</td>
            <td>
                <select name="default_email_id">
                    <option value=0 disabled><?php echo __('Select One');?></option>
                    <?php
                    $sql='SELECT email_id,email,name FROM '.EMAIL_TABLE;
                    if(($res=db_query($sql)) && db_num_rows($res)){
                        while (list($id,$email,$name) = db_fetch_row($res)){
                            $email=$name?"$name &lt;$email&gt;":$email;
                            ?>
                            <option value="<?php echo $id; ?>"<?php echo ($config['default_email_id']==$id)?'selected="selected"':''; ?>><?php echo $email; ?></option>
                        <?php
                        }
                    } ?>
                 </select>
                 &nbsp;<font class="error">*&nbsp;<?php echo $errors['default_email_id']; ?></font>
                <i class="help-tip icon-question-sign" href="#default_system_email"></i>
            </td>
        </tr>
        <tr>
            <td width="180" class="required"><?php echo __('Default Alert Email');?>:</td>
            <td>
                <select name="alert_email_id">
                    <option value="0" selected="selected"><?php echo __('Use Default System Email (above)');?></option>
                    <?php
                    $sql='SELECT email_id,email,name FROM '.EMAIL_TABLE.' WHERE email_id != '.db_input($config['default_email_id']);
                    if(($res=db_query($sql)) && db_num_rows($res)){
                        while (list($id,$email,$name) = db_fetch_row($res)){
                            $email=$name?"$name &lt;$email&gt;":$email;
                            ?>
                            <option value="<?php echo $id; ?>"<?php echo ($config['alert_email_id']==$id)?'selected="selected"':''; ?>><?php echo $email; ?></option>
                        <?php
                        }
                    } ?>
                 </select>
                 &nbsp;<font class="error">*&nbsp;<?php echo $errors['alert_email_id']; ?></font>
                <i class="help-tip icon-question-sign" href="#default_alert_email"></i>
            </td>
        </tr>
        <tr>
            <td width="180" class="required"><?php echo __("Admin's Email Address");?>:</td>
            <td>
                <input type="text" size=40 name="admin_email" value="<?php echo $config['admin_email']; ?>">
                    &nbsp;<font class="error">*&nbsp;<?php echo $errors['admin_email']; ?></font>
                <i class="help-tip icon-question-sign" href="#admins_email_address"></i>
            </td>
        </tr>
        <tr>
            <td width="180" class="required"><?php echo __("Verify Email Addresses");?>:</td>
            <td>
                <input type="checkbox" name="verify_email_addrs" <?php
                    if ($config['verify_email_addrs']) echo 'checked="checked"'; ?>>
                <?php echo __('Verify email address domain'); ?>
                <i class="help-tip icon-question-sign" href="#verify_email_addrs"></i>
            </td>
        </tr>
        <tr><th colspan=2><em><strong><?php echo __('Incoming Emails'); ?>:</strong>&nbsp;
            </em></th>
        <tr>
            <td width="180"><?php echo __('Email Fetching'); ?>:</td>
            <td><input type="checkbox" name="enable_mail_polling" value=1 <?php echo $config['enable_mail_polling']? 'checked="checked"': ''; ?>>
                <?php echo __('Enable'); ?>
                <i class="help-tip icon-question-sign" href="#email_fetching"></i>
                &nbsp;
                 <input type="checkbox" name="enable_auto_cron" <?php echo $config['enable_auto_cron']?'checked="checked"':''; ?>>
                <?php echo __('Fetch on auto-cron'); ?>&nbsp;
                <i class="help-tip icon-question-sign" href="#enable_autocron_fetch"></i>
            </td>
        </tr>
        <tr>
            <td width="180"><?php echo __('Strip Quoted Reply');?>:</td>
            <td>
                <input type="checkbox" name="strip_quoted_reply" <?php echo $config['strip_quoted_reply'] ? 'checked="checked"':''; ?>>
                <?php echo __('Enable'); ?>
                <i class="help-tip icon-question-sign" href="#strip_quoted_reply"></i>
                &nbsp;<font class="error">&nbsp;<?php echo $errors['strip_quoted_reply']; ?></font>
            </td>
        </tr>
        <tr>
            <td width="180"><?php echo __('Reply Separator Tag');?>:</td>
            <td><input type="text" name="reply_separator" value="<?php echo $config['reply_separator']; ?>">
                &nbsp;<font class="error">&nbsp;<?php echo $errors['reply_separator']; ?></font>&nbsp;<i class="help-tip icon-question-sign" href="#reply_separator_tag"></i>
            </td>
        </tr>
        <tr>
            <td width="180"><?php echo __('Emailed Tickets Priority'); ?>:</td>
            <td>
                <input type="checkbox" name="use_email_priority" value="1" <?php echo $config['use_email_priority'] ?'checked="checked"':''; ?>>
                &nbsp;<?php echo __('Enable'); ?>&nbsp;
                <i class="help-tip icon-question-sign" href="#emailed_tickets_priority"></i>
            </td>
        </tr>
        <tr>
            <td width="180"><?php echo __('Accept All Emails'); ?>:</td>
            <td><input type="checkbox" name="accept_unregistered_email" <?php
                echo $config['accept_unregistered_email'] ? 'checked="checked"' : ''; ?>/>
                <?php echo __('Accept email from unknown Users'); ?>
                <i class="help-tip icon-question-sign" href="#accept_all_emails"></i>
            </td>
        </tr>
        <tr>
            <td width="180"><?php echo __('Accept Email Collaborators'); ?>:</td>
            <td><input type="checkbox" name="add_email_collabs" <?php
            echo $config['add_email_collabs'] ? 'checked="checked"' : ''; ?>/>
            <?php echo __('Automatically add collaborators from email fields'); ?>&nbsp;
            <i class="help-tip icon-question-sign" href="#accept_email_collaborators"></i>
        </tr>
        <tr><th colspan=2><em><strong><?php echo __('Outgoing Email');?></strong>: <?php echo __('Default email only applies to outgoing emails without SMTP setting.');?></em></th></tr>
        <tr><td width="180"><?php echo __('Default MTA'); ?>:</td>
            <td>
                <select name="default_smtp_id">
                    <option value=0 selected="selected"><?php echo __('None: Use PHP mail function');?></option>
                    <?php
                    $accounts = SmtpAccount::objects()->filter(['active' => 1]);
                    foreach ($accounts as $account) {
                        if (!($email=$account->getEmail()))
                            continue;

                        $id = $account->getId();
                        $addr = sprintf('%s &lt;%s&gt;',
                                $email->getName(),
                                $email->getEmail());
                        ?>
                        <option value="<?php echo $id; ?>"<?php
                            echo ($config['default_smtp_id'] == $id) ? 'selected="selected"' : ''; ?>><?php
                            echo $addr; ?></option>
                        <?php
                    }
                    ?>
                 </select>&nbsp;<font class="error">&nbsp;<?php echo $errors['default_smtp_id']; ?></font>
                 <i class="help-tip icon-question-sign" href="#default_mta"></i>
           </td>
       </tr>
        <tr>
            <td width="180"><?php echo __('Attachments');?>:</td>
            <td>
                <input type="checkbox" name="email_attachments" <?php echo $config['email_attachments']?'checked="checked"':''; ?>>
                <?php echo __('Email attachments to the user'); ?>
                <i class="help-tip icon-question-sign" href="#ticket_response_files"></i>
            </td>
        </tr>
        <tr><th colspan=2>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
                <em><strong><?php echo __('Gmail API Integration'); ?></strong>: <?php echo __('Connect Gmail to poll messages and send replies.'); ?></em>
                <span id="gmail-badge" style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;font-weight:700;font-size:12px;line-height:1;background:<?php echo !empty($gmail['refresh_token']) ? '#0f766e' : '#7c2d12'; ?>;color:#fff;">
                    <span style="width:8px;height:8px;border-radius:999px;background:#fff;display:inline-block;"></span>
                    <span id="gmail-badge-text"><?php echo !empty($gmail['refresh_token']) ? __('Connected') : __('Not connected'); ?></span>
                </span>
            </div>
        </th></tr>
        <tr>
            <td width="180"><?php echo __('Integration'); ?>:</td>
            <td>
                <label><input type="checkbox" name="gmail_active" value="1" <?php echo !empty($gmail['active']) ? 'checked="checked"' : ''; ?>>
                <?php echo __('Enable Gmail API'); ?></label>
                <div class="faded"><?php echo __('When enabled, osTicket can poll Gmail and send replies through the same mailbox.'); ?></div>
            </td>
        </tr>
        <tr>
            <td width="180"><?php echo __('Gmail Email'); ?>:</td>
            <td><input type="text" name="gmail_email" size="40" value="<?php echo Format::htmlchars($gmail['gmail_email'] ?? ''); ?>"></td>
        </tr>
        <tr>
            <td width="180"><?php echo __('OAuth Client ID'); ?>:</td>
            <td><input type="text" name="gmail_client_id" size="60" value="<?php echo Format::htmlchars($gmail['client_id'] ?? ''); ?>"></td>
        </tr>
        <tr>
            <td width="180"><?php echo __('OAuth Client Secret'); ?>:</td>
            <td><input type="password" name="gmail_client_secret" size="60" value="<?php echo Format::htmlchars($gmail['client_secret'] ?? ''); ?>"></td>
        </tr>
        <tr>
            <td width="180"><?php echo __('Redirect URI'); ?>:</td>
            <td>
                <input type="text" name="gmail_redirect_uri" size="80" value="<?php echo Format::htmlchars($gmail['redirect_uri'] ?? GmailApi::defaultRedirectUri()); ?>">
                <div class="faded"><?php echo __('Use this exact URL in Google Cloud OAuth settings.'); ?></div>
            </td>
        </tr>
        <tr>
            <td width="180"><?php echo __('Processed Label'); ?>:</td>
            <td><input type="text" name="gmail_processed_label" size="40" value="<?php echo Format::htmlchars($gmail['processed_label'] ?? 'osTicket/Processed'); ?>"></td>
        </tr>
        <tr>
            <td width="180"><?php echo __('Poll Query'); ?>:</td>
            <td>
                <input type="text" name="gmail_poll_query" size="40" value="<?php echo Format::htmlchars($gmail['poll_query'] ?? 'is:unread'); ?>">
                <div class="faded"><?php echo __('Example: is:unread newer_than:1d'); ?></div>
            </td>
        </tr>
        <tr>
            <td width="180"><?php echo __('Status'); ?>:</td>
            <td>
                <div style="display:grid;gap:6px;">
                    <div><strong><?php echo __('Last sync'); ?>:</strong> <span id="gmail-last-sync"><?php echo !empty($gmail['last_sync_at']) ? Format::datetime($gmail['last_sync_at']) : __('No sync yet'); ?></span></div>
                    <div><strong><?php echo __('Connected account'); ?>:</strong> <span id="gmail-account"><?php echo Format::htmlchars($gmail['gmail_email'] ?? __('Not connected')); ?></span></div>
                    <div id="gmail-last-error" class="error" style="<?php echo empty($gmail['last_error']) ? 'display:none;' : ''; ?>"><?php echo Format::htmlchars($gmail['last_error'] ?? ''); ?></div>
                </div>
            </td>
        </tr>
        <tr>
            <td width="180"><?php echo __('Notice'); ?>:</td>
            <td>
                <div id="gmail-inline-message" class="alert alert-info mb-0 py-2 px-3" style="display:none;"></div>
            </td>
        </tr>
    </tbody>
</table>
<p style="text-align:center;">
    <input class="button" type="submit" name="submit" value="<?php echo __('Save Changes');?>">
    <input class="button" type="button" id="gmail-connect" value="<?php echo __('Save and Connect Gmail');?>">
    <input class="button" type="button" id="gmail-test" value="<?php echo __('Test Poll');?>">
    <input class="button" type="button" id="gmail-disconnect" value="<?php echo __('Disconnect Gmail');?>">
    <input class="button" type="reset" name="reset" value="<?php echo __('Reset Changes');?>">
</p>
</form>
<script type="text/javascript">
$(function() {
    var rootPath = '<?php echo rtrim(ROOT_PATH, "/"); ?>/';
    function showGmailMessage(message, kind) {
        var $box = $('#gmail-inline-message');
        if (!message) {
            $box.hide().removeClass('alert-success alert-danger alert-info alert-warning').text('');
            return;
        }
        var classes = 'alert-info';
        if (kind === 'success') classes = 'alert-success';
        else if (kind === 'error') classes = 'alert-danger';
        else if (kind === 'warning') classes = 'alert-warning';
        $box.removeClass('alert-success alert-danger alert-info alert-warning').addClass(classes).text(message).show();
    }
    function renderGmailStatus(status) {
        if (!status)
            return;
        $('#gmail-badge').css('background', status.connected ? '#0f766e' : '#7c2d12');
        $('#gmail-badge-text').text(status.connected ? '<?php echo addslashes(__('Connected')); ?>' : '<?php echo addslashes(__('Not connected')); ?>');
        $('#gmail-last-sync').text(status.last_sync_at ? status.last_sync_at : '<?php echo addslashes(__('No sync yet')); ?>');
        $('#gmail-account').text(status.gmail_email || '<?php echo addslashes(__('Not connected')); ?>');
        if (status.last_error) {
            $('#gmail-last-error').text(status.last_error).show();
        } else {
            $('#gmail-last-error').text('').hide();
        }
        $('input[name="gmail_active"]').prop('checked', !!status.active);
    }
    function refreshGmailStatus() {
        $.ajax({
            url: rootPath + 'api/gmail/status.php',
            method: 'GET',
            cache: false,
            success: function(json) {
                if (json && json.status)
                    renderGmailStatus(json.status);
            }
        });
    }
    $('#gmail-connect').on('click', function() {
        var $form = $(this).closest('form');
        $.ajax({
            url: rootPath + 'api/gmail/setup.php',
            method: 'POST',
            data: $.objectifyForm($form.serializeArray()),
            cache: false,
            success: function() {
                $.ajax({
                    url: rootPath + 'api/gmail/connect.php',
                    method: 'GET',
                    cache: false,
                    success: function(json) {
                        if (json && json.authorization_url)
                            window.location.href = json.authorization_url;
                        else
                            showGmailMessage('<?php echo addslashes(__('Gmail settings saved.')); ?>', 'success');
                    }
                });
            }
        });
    });
    $('#gmail-test').on('click', function() {
        $.ajax({
            url: rootPath + 'api/gmail/test.php',
            method: 'GET',
            cache: false,
            success: function(json) {
                showGmailMessage((json && json.summary)
                    ? '<?php echo addslashes(__('Processed')); ?>: ' + json.summary.processed + ', <?php echo addslashes(__('Skipped')); ?>: ' + json.summary.skipped + ', <?php echo addslashes(__('Errors')); ?>: ' + json.summary.errors
                    : '<?php echo addslashes(__('Gmail test completed')); ?>', 'success');
                refreshGmailStatus();
            }
        });
    });
    $('#gmail-disconnect').on('click', function() {
        if (!confirm('<?php echo addslashes(__('Disconnect Gmail and clear saved tokens?')); ?>'))
            return;
        $.ajax({
            url: rootPath + 'api/gmail/disconnect.php',
            method: 'POST',
            cache: false,
            success: function() {
                showGmailMessage('<?php echo addslashes(__('Gmail disconnected and tokens cleared.')); ?>', 'warning');
                refreshGmailStatus();
            }
        });
    });
    refreshGmailStatus();
});
</script>
