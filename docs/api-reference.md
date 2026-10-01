# VouchReel Public REST API v1 Reference

Welcome to the VouchReel Public REST API documentation. The v1 API allows developers, agencies, and integrations to programmatically manage spaces, testimonials, collection forms, and retrieve analytics.

---

## Authentication

All requests to `/api/v1/*` must include a Bearer API key in the `Authorization` HTTP header:

```http
Authorization: Bearer vr_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

API keys are scoped to a specific Space. You can generate and revoke API keys in your VouchReel Dashboard under **Settings → API Keys**.

> **Note**: API keys are shown only once upon generation. Keep your API keys confidential and never expose them in client-side code or public repositories.

---

## Rate Limiting

The v1 API enforces rate limits per API key:
* **Standard Endpoints**: 60 requests per minute
* **Analytics Endpoints**: 30 requests per minute

When a rate limit is exceeded, the server returns an HTTP `429 Too Many Requests` status with standard rate limit headers:

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Maximum number of allowed requests in the current window |
| `X-RateLimit-Remaining` | Remaining requests in the current window |
| `X-RateLimit-Reset` | Epoch timestamp (in ms) when the window resets |
| `Retry-After` | Number of seconds to wait before retrying |

---

## Error Handling

Errors follow a uniform JSON structure across all v1 endpoints:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": {
      "videoUrl": ["Must be a valid URL"]
    }
  }
}
```

Standard error codes:
* `400 BAD_REQUEST` / `VALIDATION_ERROR`: Missing or malformed parameters.
* `401 UNAUTHORIZED`: Missing, invalid, or revoked API key.
* `403 FORBIDDEN`: Attempted access to a resource outside the API key's space.
* `404 NOT_FOUND`: Resource does not exist.
* `429 RATE_LIMITED`: Rate limit exceeded.
* `500 INTERNAL_ERROR`: Server-side processing error.

---

## Endpoints

### 1. Spaces

#### `GET /api/v1/spaces`
Lists the space associated with the current API key.

**Curl Example**:
```bash
curl -X GET "https://app.vouchreel.com/api/v1/spaces" \
  -H "Authorization: Bearer vr_live_YOUR_KEY"
```

**Response (200 OK)**:
```json
{
  "spaces": [
    {
      "id": "c1f7b0a2-1111-4444-8888-123456789abc",
      "name": "Acme SaaS",
      "embedKey": "spc_abc12345",
      "testimonialCount": 14,
      "createdAt": "2026-09-15T12:00:00.000Z"
    }
  ]
}
```

---

### 2. Testimonials

#### `GET /api/v1/testimonials`
Lists testimonials in the space.

**Query Parameters**:
* `page` (optional, default: `1`): Page number.
* `limit` (optional, default: `20`, max: `100`): Items per page.
* `includeInactive` (optional, default: `false`): Include inactive/hidden testimonials.

**Curl Example**:
```bash
curl -X GET "https://app.vouchreel.com/api/v1/testimonials?page=1&limit=20" \
  -H "Authorization: Bearer vr_live_YOUR_KEY"
```

**Response (200 OK)**:
```json
{
  "testimonials": [
    {
      "id": "d2e3f4a5-2222-4444-8888-987654321def",
      "spaceId": "c1f7b0a2-1111-4444-8888-123456789abc",
      "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      "platform": "youtube",
      "title": "Customer Review: How Acme boosted our sales",
      "thumbnailUrl": "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "durationSeconds": 142,
      "quote": "This platform increased our conversion rate by 34%!",
      "customerName": "Sarah Jenkins",
      "customerCompany": "TechFlow Inc.",
      "tags": ["enterprise", "saas"],
      "isActive": true,
      "sortOrder": 0,
      "createdAt": "2026-09-20T14:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "count": 1
  }
}
```

#### `POST /api/v1/testimonials`
Creates a new testimonial. If `videoUrl` is provided without `title`, `thumbnailUrl`, or `durationSeconds`, VouchReel will automatically fetch the oEmbed metadata.

**Request Body**:
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "quote": "Incredible experience working with Acme!",
  "customerName": "Alex Morgan",
  "customerCompany": "Horizon Media",
  "tags": ["marketing", "b2b"]
}
```

**Curl Example**:
```bash
curl -X POST "https://app.vouchreel.com/api/v1/testimonials" \
  -H "Authorization: Bearer vr_live_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "customerName": "Alex Morgan",
    "quote": "Incredible experience working with Acme!"
  }'
```

**Response (201 Created)**:
```json
{
  "testimonial": {
    "id": "e3f4a5b6-3333-4444-8888-111222333444",
    "spaceId": "c1f7b0a2-1111-4444-8888-123456789abc",
    "platform": "youtube",
    "title": "Video Testimonial",
    "customerName": "Alex Morgan",
    "quote": "Incredible experience working with Acme!",
    "isActive": true,
    "sortOrder": 1,
    "createdAt": "2026-10-01T01:00:00.000Z"
  }
}
```

#### `PUT /api/v1/testimonials/{id}`
Updates an existing testimonial.

#### `DELETE /api/v1/testimonials/{id}`
Deletes an existing testimonial.

---

### 3. Analytics

#### `GET /api/v1/analytics/overview`
Retrieves aggregated event stats (`impressions`, `plays`, `clicks`, `conversions`) for the space.

**Query Parameters**:
* `startDate` (optional, format: `YYYY-MM-DD`): Defaults to 30 days ago.
* `endDate` (optional, format: `YYYY-MM-DD`): Defaults to today.

**Curl Example**:
```bash
curl -X GET "https://app.vouchreel.com/api/v1/analytics/overview?startDate=2026-09-01&endDate=2026-09-30" \
  -H "Authorization: Bearer vr_live_YOUR_KEY"
```

**Response (200 OK)**:
```json
{
  "stats": {
    "impressions": 12450,
    "plays": 3890,
    "clicks": 980,
    "conversions": 142
  },
  "dateRange": {
    "start": "2026-09-01T00:00:00.000Z",
    "end": "2026-09-30T23:59:59.999Z"
  }
}
```

#### `GET /api/v1/analytics/testimonials`
Retrieves impression, play, and conversion performance breakdown per testimonial.

---

### 4. Collection Forms

#### `GET /api/v1/collection-forms`
Lists all active collection forms for the space, including the public URL to share with customers or trigger via Zapier/Make.

**Response (200 OK)**:
```json
{
  "collectionForms": [
    {
      "id": "f4a5b6c7-4444-5555-8888-aabbccddeeff",
      "title": "Share your review with Acme",
      "promptText": "What has been your favorite feature so far?",
      "incentiveType": "discount",
      "incentiveValue": "15% OFF",
      "slug": "acme-feedback",
      "collectionUrl": "https://app.vouchreel.com/collect/acme-feedback",
      "isActive": true,
      "createdAt": "2026-09-10T10:00:00.000Z"
    }
  ]
}
```

#### `GET /api/v1/collection-forms/{id}/submissions`
Lists customer submissions received for a specific collection form.
