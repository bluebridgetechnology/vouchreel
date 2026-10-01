# Shopify Integration Guide for VouchReel

This guide explains how to install VouchReel video testimonials on your Shopify store, whether you want a global floating widget or product-specific testimonial matching.

---

## Method 1: Global Storefront Widget (Recommended)

To display your VouchReel widget across your entire Shopify storefront:

1. Log in to your **Shopify Admin**.
2. Go to **Online Store → Themes**.
3. Next to your live theme, click the **`...`** (Actions) menu and select **Edit code**.
4. In the left file navigation, open **`layout/theme.liquid`**.
5. Scroll down to the very bottom of the file to locate the closing `</body>` tag.
6. Paste the following script directly above `</body>`:

```liquid
{% comment %} VouchReel Video Testimonials Widget {% endcomment %}
<script async src="https://app.vouchreel.com/widget/YOUR_EMBED_KEY.js" data-key="YOUR_EMBED_KEY"></script>
```
*(Replace `YOUR_EMBED_KEY` with your actual Space embed key from your VouchReel dashboard).*

7. Click **Save** in the top right corner.

Your widget is now active!

---

## Method 2: Product-Level Testimonial Matching

You can configure VouchReel to dynamically display only testimonials relevant to the product currently being viewed.

### 1. Update the Liquid Snippet

In `layout/theme.liquid` (or inside `sections/main-product.liquid`), use this smart snippet:

```liquid
{% comment %} VouchReel Smart Product Testimonials Widget {% endcomment %}
<script
  async
  src="https://app.vouchreel.com/widget/YOUR_EMBED_KEY.js"
  data-key="YOUR_EMBED_KEY"
  {% if template contains 'product' and product %}
    data-tags="product-{{ product.id }},product-{{ product.handle }}"
  {% endif %}>
</script>
```

### 2. Tag Your Testimonials in VouchReel

1. In your VouchReel Dashboard, open your Space and go to **Testimonials**.
2. Click **Edit** on a testimonial you want tied to a specific product.
3. In the **Tags** field, enter:
   - `product-{{ product.id }}` (e.g. `product-7891234567`) OR
   - `product-{{ product.handle }}` (e.g. `product-wireless-headphones`)
4. Save the testimonial.

Whenever a shopper lands on that product page, the widget automatically filters to show only testimonials with that matching product tag.

---

## Method 3: Shopify 2.0 Custom Liquid Block

If your theme supports Shopify OS 2.0 (such as Dawn, Sense, Craft, Refresh):

1. Go to **Online Store → Themes → Customize**.
2. Using the top page selector, navigate to **Products → Default product**.
3. In the left template sidebar, click **Add section** or **Add block** and select **Custom Liquid**.
4. Paste the smart snippet into the Liquid code editor.
5. Drag the block to your preferred position (e.g., right below Product Reviews or above Product Recommendations).
6. Click **Save**.

---

## Troubleshooting

| Issue | Resolution |
|---|---|
| **Widget does not appear** | Check that you copied the exact embed key without extra spaces. Open your browser console (`F12`) to verify there are no Content-Security-Policy (CSP) blocks. |
| **Old settings appear** | Shopify and browsers cache assets aggressively. Test in an Incognito window or perform a hard refresh (`Ctrl + F5` or `Cmd + Shift + R`). |
| **Product matching not filtering** | Ensure the tag in VouchReel exactly matches `product-` followed by the Shopify product ID or handle. |
