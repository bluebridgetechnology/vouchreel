<?php
/**
 * Registers Gutenberg block and shortcode for VouchReel.
 */

if (!defined('ABSPATH')) {
    exit;
}

class VouchReel_Block {

    public function init() {
        add_action('init', array($this, 'register_block'));
        add_shortcode('vouchreel', array($this, 'render_shortcode'));
    }

    public function register_block() {
        if (!function_exists('register_block_type')) {
            return;
        }

        // Register block editor script
        wp_register_script(
            'vouchreel-block-editor',
            VOUCHREEL_PLUGIN_URL . 'blocks/vouchreel-widget/index.js',
            array('wp-blocks', 'wp-element', 'wp-editor', 'wp-components'),
            VOUCHREEL_VERSION
        );

        register_block_type('vouchreel/widget', array(
            'editor_script' => 'vouchreel-block-editor',
            'render_callback' => array($this, 'render_block'),
            'attributes' => array(
                'embedKey' => array(
                    'type' => 'string',
                    'default' => '',
                ),
            ),
        ));
    }

    /**
     * Server-side render callback for Gutenberg block.
     */
    public function render_block($attributes) {
        $key = !empty($attributes['embedKey'])
            ? sanitize_text_field($attributes['embedKey'])
            : sanitize_text_field(get_option('vouchreel_embed_key', ''));

        if (empty($key)) {
            return '<div class="vouchreel-notice">' . esc_html__('Please enter a VouchReel embed key.', 'vouchreel') . '</div>';
        }

        $api_url = esc_url(get_option('vouchreel_api_url', 'https://app.vouchreel.com'));
        $script_url = rtrim($api_url, '/') . '/widget/' . urlencode($key) . '.js';

        return sprintf(
            '<div class="vouchreel-container" data-key="%s"><script async src="%s" data-key="%s"></script></div>',
            esc_attr($key),
            esc_url($script_url),
            esc_attr($key)
        );
    }

    /**
     * Shortcode handler [vouchreel key="..."]
     */
    public function render_shortcode($atts) {
        $atts = shortcode_atts(array(
            'key' => get_option('vouchreel_embed_key', ''),
        ), $atts, 'vouchreel');

        return $this->render_block(array('embedKey' => $atts['key']));
    }
}
