<?php
if (!$info['title'])
    $info['title'] = sprintf(__('Email %s'), Format::htmlchars($user->getName()));
?>
<h3 class="drag-handle"><?php echo $info['title']; ?></h3>
<b><a class="close" href="#"><i class="icon-remove-circle"></i></a></b>
<div class="clear"></div>
<hr/>
<?php
if ($errors['err']) {
    echo sprintf('<p id="msg_error">%s</p>', $errors['err']);
}
?>
<div><p id="msg_info"><i class="icon-info-sign"></i>&nbsp;<?php
echo sprintf(__('Send a direct email to <b>%s</b> at %s.'), Format::htmlchars($user->getName()), $user->getEmail());
?></p></div>
<form method="post" class="user" action="#users/<?php echo $user->getId(); ?>/email">
    <input type="hidden" name="id" value="<?php echo $user->getId(); ?>" />
    <table width="100%">
        <tbody>
            <tr>
                <td width="180"><?php echo __('To'); ?>:</td>
                <td><?php echo $user->getEmail(); ?></td>
            </tr>
            <tr>
                <td width="180" class="required"><?php echo __('Subject'); ?>:</td>
                <td>
                    <input type="text" name="subject" size="60" value="<?php echo $info['subject']; ?>" />
                    <span class="error">&nbsp;<?php echo $errors['subject']; ?></span>
                </td>
            </tr>
            <tr>
                <td width="180" class="required"><?php echo __('Message'); ?>:</td>
                <td>
                    <textarea name="message" rows="10" cols="60" style="width:95%;"><?php echo $info['message']; ?></textarea>
                    <div class="error"><?php echo $errors['message']; ?></div>
                </td>
            </tr>
        </tbody>
    </table>
    <hr>
    <p class="full-width">
        <span class="buttons pull-left">
            <input type="button" name="cancel" class="close" value="<?php echo __('Cancel'); ?>">
        </span>
        <span class="buttons pull-right">
            <input type="submit" value="<?php echo __('Send Email'); ?>">
        </span>
    </p>
</form>
<div class="clear"></div>
