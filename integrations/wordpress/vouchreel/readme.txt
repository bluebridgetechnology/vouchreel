=== VouchReel Video Testimonials ===
Contributors: vouchreel
Tags: testimonials, video testimonials, reviews, social proof, video reviews
Requires at least: 5.8
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Collect and display high-converting video testimonials and review widgets seamlessly on your WordPress site.

== Description ==

VouchReel enables business owners and creators to display interactive video testimonials, floating testimonial cards, story strips, and walls of love directly on their WordPress website.

= Features =
* **Automatic Site-Wide Embedding**: Enter your Space Embed Key once in Settings → VouchReel and the widget will auto-load in your site footer.
* **Gutenberg Block Support**: Place testimonial widgets on specific pages or posts using the built-in Gutenberg block.
* **Shortcode Support**: Use `[vouchreel key="YOUR_KEY"]` anywhere in classic editor or widgets.
* **Non-Blocking & Lightweight**: Zero dependencies, isolated Shadow DOM rendering, under 15 KB bundle size.
* **Comprehensive Analytics**: Track impressions, video plays, click-throughs, and conversions directly in your VouchReel dashboard.

== Installation ==

1. Upload the `vouchreel` folder to your `/wp-content/plugins/` directory, or install the ZIP file via WordPress Admin → Plugins → Add New → Upload Plugin.
2. Activate the plugin through the 'Plugins' menu in WordPress.
3. Go to **Settings → VouchReel** in your WordPress Admin.
4. Paste your **Space Embed Key** (found in your VouchReel dashboard under Space → Widget).
5. Click **Save Settings**. The widget will now automatically load on your website!

== Frequently Asked Questions ==

= Where do I find my Space Embed Key? =
Log in to your VouchReel dashboard, open your Space, navigate to the **Widget** tab, and copy your Embed Key.

= Will this slow down my website? =
No. The VouchReel widget is loaded asynchronously (`async`) and runs inside an isolated Shadow DOM container. It does not block page rendering.

= Can I display different testimonials on different pages? =
Yes! You can either use VouchReel's built-in Page Targeting & Tag Matching rules in your dashboard, or use the Gutenberg block with different embed keys.

== Changelog ==

= 1.0.0 =
* Initial release of the VouchReel WordPress plugin.
* Site-wide footer injection support.
* Gutenberg block and shortcode support.
