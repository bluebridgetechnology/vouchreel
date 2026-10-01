<?php
/**
 * Handles WordPress admin menu and settings for VouchReel.
 */

if (!defined('ABSPATH')) {
    exit;
}

class VouchReel_Admin {

    public function init() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_init', array($this, 'register_settings'));
    }

    public function add_admin_menu() {
        add_options_page(
            __('VouchReel Settings', 'vouchreel'),
            __('VouchReel', 'vouchreel'),
            'manage_options',
            'vouchreel',
            array($this, 'render_settings_page')
        );
    }

    public function register_settings() {
        register_setting('vouchreel_settings_group', 'vouchreel_embed_key', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default' => '',
        ));

        register_setting('vouchreel_settings_group', 'vouchreel_api_url', array(
            'type' => 'string',
            'sanitize_callback' => 'esc_url_raw',
            'default' => 'https://app.vouchreel.com',
        ));

        register_setting('vouchreel_settings_group', 'vouchreel_auto_inject', array(
            'type' => 'string',
            'sanitize_callback' => 'sanitize_text_field',
            'default' => '1',
        ));
    }

    public function render_settings_page() {
        if (!current_user_can('manage_options')) {
            return;
        }

        $embed_key = get_option('vouchreel_embed_key', '');
        $api_url = get_option('vouchreel_api_url', 'https://app.vouchreel.com');
        $auto_inject = get_option('vouchreel_auto_inject', '1');
        ?>
        <div class="wrap">
            <h1><?php echo esc_html(get_admin_page_title()); ?></h1>
            <p><?php esc_html_e('Connect your WordPress website to your VouchReel Space to automatically display video testimonials.', 'vouchreel'); ?></p>

            <form method="post" action="options.php">
                <?php settings_fields('vouchreel_settings_group'); ?>

                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row">
                            <label for="vouchreel_embed_key"><?php esc_html_e('Space Embed Key', 'vouchreel'); ?></label>
                        </th>
                        <td>
                            <input
                                name="vouchreel_embed_key"
                                type="text"
                                id="vouchreel_embed_key"
                                value="<?php echo esc_attr($embed_key); ?>"
                                class="regular-text"
                                placeholder="e.g. spc_a1b2c3d4e5f6"
                            />
                            <p class="description">
                                <?php esc_html_e('Found in your VouchReel dashboard under Space Settings → Widget tab.', 'vouchreel'); ?>
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="vouchreel_auto_inject"><?php esc_html_e('Site-Wide Widget', 'vouchreel'); ?></label>
                        </th>
                        <td>
                            <label>
                                <input
                                    name="vouchreel_auto_inject"
                                    type="checkbox"
                                    id="vouchreel_auto_inject"
                                    value="1"
                                    <?php checked('1', $auto_inject); ?>
                                />
                                <?php esc_html_e('Automatically load the widget on all pages across your website', 'vouchreel'); ?>
                            </label>
                            <p class="description">
                                <?php esc_html_e('If unchecked, you can still embed the widget selectively on individual pages using the Gutenberg block or shortcode.', 'vouchreel'); ?>
                            </p>
                        </td>
                    </tr>

                    <tr>
                        <th scope="row">
                            <label for="vouchreel_api_url"><?php esc_html_e('VouchReel App URL', 'vouchreel'); ?></label>
                        </th>
                        <td>
                            <input
                                name="vouchreel_api_url"
                                type="url"
                                id="vouchreel_api_url"
                                value="<?php echo esc_attr($api_url); ?>"
                                class="regular-text"
                            />
                            <p class="description">
                                <?php esc_html_e('Default is https://app.vouchreel.com. Only change this if you are self-hosting VouchReel.', 'vouchreel'); ?>
                            </p>
                        </td>
                    </tr>
                </table>

                <?php submit_button(__('Save Settings', 'vouchreel')); ?>
            </form>

            <hr style="margin-top: 30px;" />
            <h3><?php esc_html_e('Need Help?', 'vouchreel'); ?></h3>
            <p>
                <?php esc_html_e('You can also place widgets inline anywhere using the shortcode:', 'vouchreel'); ?>
                <code>[vouchreel key="YOUR_KEY"]</code>
            </p>
        </div>
        <?php
    }
}
