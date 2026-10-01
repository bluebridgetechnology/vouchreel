# Make (Integromat) Integration Guide

Connect VouchReel to hundreds of business tools using Make's Webhook modules and HTTP requests.

---

## 1. Triggers (VouchReel → Make)

Receive real-time notifications in Make when testimonials or submissions arrive in VouchReel.

### Step 1: Create a Custom Webhook in Make
1. Open your Make scenario editor and click **+** to add a new module.
2. Search for and select **Webhooks → Custom webhook**.
3. Click **Add** to create a new webhook hook, give it a name (e.g. `VouchReel Testimonials`), and click **Save**.
4. Copy the webhook URL provided by Make (e.g. `https://hook.eu1.make.com/xxxxxxxxxxxxxxxx`).

### Step 2: Register in VouchReel
1. In VouchReel, navigate to **Settings → Webhooks**.
2. Select your Space and click **+ Add Webhook Endpoint**.
3. Paste the Make webhook URL into the **Destination HTTPS URL** input.
4. Select the events you want to route to Make (`testimonial.created`, `submission.received`, `conversion.tracked`).
5. Click **Add Endpoint**.

### Step 3: Determine Data Structure
1. In Make, with the webhook module listening ("Run once"), perform a test action in VouchReel or submit a test testimonial.
2. Make will detect the incoming data structure (`event`, `data`, `timestamp`).
3. Add downstream modules (e.g., Google Sheets: Add a row, Discord: Send a message, or HubSpot: Update contact).

---

## 2. Actions (Make → VouchReel)

Create testimonials or look up collection links from Make.

### Example: Create a Testimonial in VouchReel
1. Add an **HTTP → Make a request** module in your scenario.
2. Configure the module:
   - **URL**: `https://app.vouchreel.com/api/v1/testimonials`
   - **Method**: `POST`
   - **Headers**:
     - `Authorization`: `Bearer vr_live_YOUR_API_KEY`
     - `Content-Type`: `application/json`
   - **Body type**: Raw (JSON)
   - **Request content**:
     ```json
     {
       "videoUrl": "{{1.video_url}}",
       "customerName": "{{1.name}}",
       "quote": "{{1.feedback}}",
       "tags": ["make-automation"]
     }
     ```
3. Run the scenario to create the testimonial in your Space.
