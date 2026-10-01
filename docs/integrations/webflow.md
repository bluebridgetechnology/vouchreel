# Webflow Integration Guide

Learn how to integrate the VouchReel Video Testimonials widget into your Webflow site in under two minutes.

---

## Site-Wide Custom Code Integration

The fastest way to install the widget across all pages of your Webflow site:

1. Open your project in the **Webflow Designer** or **Dashboard**.
2. Click the top-left menu and select **Site Settings** (or Project Settings).
3. In the left navigation, select **Custom Code**.
4. Scroll down to the **Footer Code** input field.
5. Paste your VouchReel script snippet:

```html
<!-- VouchReel Video Testimonials Widget -->
<script async src="https://app.vouchreel.com/widget/YOUR_EMBED_KEY.js" data-key="YOUR_EMBED_KEY"></script>
```
*(Replace `YOUR_EMBED_KEY` with your space's embed key).*

6. Click **Save Changes** and **Publish** to your custom domain or staging site.

---

## Page-Specific Embed Component

If you only want the widget on a specific landing page or high-intent checkout page:

1. Open the page in the **Webflow Designer**.
2. Press `A` or click the **+ (Add Elements)** button in the left toolbar.
3. Scroll down to the **Advanced** section and drag an **Embed** element onto your canvas (e.g. inside your Footer or near your Call-to-Action).
4. Paste the snippet into the HTML Embed Code editor.
5. Click **Save & Close** and **Publish**.

---

## Dynamic Webflow CMS Collections

If you have CMS Collection Pages (e.g., Case Studies or Products) and want to load distinct testimonials dynamically:

1. Add a Plain Text field in your CMS Collection named `Vouchreel Embed Key`.
2. On your Collection Template page, drag an **Embed** element into the layout.
3. In the embed editor, paste:
   ```html
   <script async src="https://app.vouchreel.com/widget/{{wf {&quot;path&quot;:&quot;vouchreel-embed-key&quot;,&quot;type&quot;:&quot;PlainText&quot;\} }}.js"></script>
   ```
4. Each CMS item will now render its own dedicated testimonial space!
