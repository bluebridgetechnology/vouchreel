# Zapier Integration Guide

Connect VouchReel to over 5,000+ apps on Zapier using Webhooks by Zapier and the VouchReel REST API.

---

## Part 1: Triggers (VouchReel → Zapier)

Trigger workflows in Zapier when new testimonials are added, submissions are received, or conversions occur in VouchReel.

### 1. Create a "Catch Hook" Trigger in Zapier
1. In Zapier, click **Create Zap**.
2. For the Trigger step, choose **Webhooks by Zapier**.
3. Select the Event: **Catch Hook**.
4. Click **Continue** to view your unique **Webhook URL** (e.g. `https://hooks.zapier.com/hooks/catch/123456/abcdef/`).
5. Copy the Webhook URL.

### 2. Configure the Webhook in VouchReel
1. In your VouchReel Dashboard, go to **Settings → Webhooks**.
2. Select your Space and click **+ Add Webhook Endpoint**.
3. Paste the Zapier Webhook URL into the **Destination HTTPS URL** field.
4. Select the events you want to trigger your Zap:
   - `testimonial.created`: Fires whenever a new testimonial is added to the space.
   - `submission.received`: Fires when a customer records or submits a testimonial.
   - `submission.approved`: Fires when you approve a submission in your dashboard.
   - `conversion.tracked`: Fires when a visitor converts after watching a testimonial.
5. Click **Add Endpoint**.

### 3. Test & Connect Your Zap
1. Perform an action in VouchReel (e.g. create a test testimonial).
2. In Zapier, click **Test trigger** to verify that Zapier received the payload.
3. Add any downstream action (e.g. **Slack**, **Airtable**, **Google Sheets**, or **Notion**).

---

## Part 2: Actions (Zapier → VouchReel)

Trigger actions in VouchReel automatically based on external events in your CRM, e-commerce store, or help desk.

### Workflow Example: "Send Testimonial Request When Deal Closes in CRM"

1. **Trigger**: HubSpot / Salesforce / Pipedrive → *Deal Stage Updated to Closed Won*.
2. **Action 1 (Optional)**: Webhooks by Zapier → *GET Request*:
   - URL: `https://app.vouchreel.com/api/v1/collection-forms`
   - Headers: `Authorization: Bearer vr_live_YOUR_API_KEY`
   - Returns your space's public collection form URL (`collectionUrl`).
3. **Action 2**: Gmail / SendGrid / Slack → Send an automated email to the customer with your collection form link (`https://app.vouchreel.com/collect/your-slug`).

### Workflow Example: "Import Video Testimonial from External Webhook"

1. **Trigger**: Typeform / Google Form / Custom Form submission.
2. **Action**: Webhooks by Zapier → *POST Custom Request*:
   - Method: `POST`
   - URL: `https://app.vouchreel.com/api/v1/testimonials`
   - Headers:
     ```http
     Authorization: Bearer vr_live_YOUR_API_KEY
     Content-Type: application/json
     ```
   - Data:
     ```json
     {
       "videoUrl": "{{video_link}}",
       "customerName": "{{customer_name}}",
       "quote": "{{review_text}}",
       "tags": ["zapier-import"]
     }
     ```
3. The testimonial is immediately saved in your VouchReel Space!
