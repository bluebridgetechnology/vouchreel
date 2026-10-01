<?php
/**
 * Plugin Name: VouchReel Video Testimonials
 * Plugin URI: https://vouchreel.com
 * Description: Display high-converting video testimonials and review widgets seamlessly on your WordPress website.
 * Version: 1.0.0
 * Author: VouchReel
 * Author URI: https://vouchreel.com
 * License: GPL-2.0+
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: vouchreel
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

define('VOUCHREEL_VERSION', '1.0.0');
define('VOUCHREEL_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('VOUCHREEL_PLUGIN_URL', plugin_dir_url(__FILE__));

// Require admin and block classes
require_once VOUCHREEL_PLUGIN_DIR . 'includes/class-vouchreel-admin.php';
require_once VOUCHREEL_PLUGIN_DIR . 'includes/class-vouchreel-block.php';

/**
 * Initializes the VouchReel plugin.
 */
function vouchreel_init() {
    $admin = new VouchReel_Admin();
    $admin->init();

    $block = new VouchReel_Block();
    $block->init();

    // Inject widget script in wp_footer
    add_action('wp_footer', 'vouchreel_inject_script');
}
add_action('plugins_loaded', 'vouchreel_init');

/**
 * Injects the VouchReel widget script tag in wp_footer if enabled and embed key exists.
 */
function vouchreel_inject_script() {
    $embed_key = sanitize_text_field(get_option('vouchreel_embed_key', ''));
    if (empty($embed_key)) {
        return;
    }

    $is_enabled = get_option('vouchreel_auto_inject', '1');
    if ($is_enabled !== '1') {
        return;
    }

    $api_url = esc_url(get_option('vouchreel_api_url', 'https://app.vouchreel.com'));
    $script_url = rtrim($api_url, '/') . '/widget/' . urlencode($embed_key) . '.js';

    echo sprintf(
        '<script async src="%s" data-key="%s" data-api="%s"></script>' . "\n",
        esc_url($script_url),
        esc_attr($embed_key),
        esc_url($api_url)
    );
}
