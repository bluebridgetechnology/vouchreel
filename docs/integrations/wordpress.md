# WordPress Plugin Integration Guide

This guide describes how to install and configure the official VouchReel WordPress plugin to display video testimonials across your WordPress site.

---

## 1. Installing the Plugin

### Option A: Upload via WordPress Admin
1. Download or locate the `vouchreel.zip` archive (built from `integrations/wordpress/vouchreel/`).
2. Log in to your **WordPress Admin**.
3. Navigate to **Plugins → Add New → Upload Plugin**.
4. Choose the file and click **Install Now**, then click **Activate Plugin**.

### Option B: Manual Directory Installation
1. Copy the `integrations/wordpress/vouchreel/` directory directly into your site's `wp-content/plugins/` directory:
   ```bash
   cp -r integrations/wordpress/vouchreel /var/www/html/wp-content/plugins/
   ```
2. In WordPress Admin, navigate to **Plugins** and click **Activate** under VouchReel.

---

## 2. Configuration

1. In WordPress Admin, go to **Settings → VouchReel**.
2. Enter your **Space Embed Key** (found in your VouchReel Space dashboard under the Widget tab).
3. Ensure **Site-Wide Widget** is checked if you want the widget to appear automatically on all pages.
4. Click **Save Settings**.

---

## 3. Embedding on Specific Pages

### Using the Gutenberg Block
1. Edit any page or post using the Block Editor.
2. Click **+** (Add block) and search for **VouchReel Video Testimonials**.
3. (Optional) In the block sidebar inspector, you can enter an alternate Space Embed Key if you want a different collection of testimonials on this specific page.
4. Publish or Update the page.

### Using the Shortcode
You can also use the shortcode anywhere shortcodes are supported:

```text
[vouchreel]
```

To specify an alternative Space Embed Key:
```text
[vouchreel key="spc_custom_key_123"]
```

---

## 4. WordPress.org Plugin Directory Submission Checklist

When preparing to submit the plugin to the official WordPress Plugin Directory:

- [x] Follows WordPress Coding Standards (PHPCS WordPress-Extra).
- [x] All user inputs sanitized with `sanitize_text_field` / `esc_url_raw`.
- [x] All outputs escaped with `esc_html`, `esc_attr`, `esc_url`.
- [x] Standard `readme.txt` validated with the WordPress Plugin Readme Validator.
- [x] No remote external script execution in admin screens.
- [x] GPL-2.0+ license declared and compatible.
