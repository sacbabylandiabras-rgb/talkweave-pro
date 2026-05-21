I will fix the issue where images and other media (videos, audio, etc.) are not appearing in the chat. The problem is caused by inconsistent message logging formats and missing media handling in the webhooks.

### Changes:

#### 1. Update `send-message` Edge Function:
- In the Meta API section, update the log format for messages with media to use `[media:type:url]` instead of the descriptive `[Mídia: type]`. This ensures the UI can correctly parse and render the media.

#### 2. Update `webhook-zapi` Edge Function:
- Expand the message type detection to include media callbacks (`ImageCallback`, `VideoCallback`, `AudioCallback`, `StickerCallback`, `DocumentCallback`).
- Update the content extraction logic to detect media URLs from the webhook payload (e.g., `webhook.image.url`, `webhook.video.url`).
- Format these as `[media:type:url]` so they appear correctly in the conversation history.

#### 3. Update `webhook-meta` Edge Function:
- Add detection for media message types from the Meta WhatsApp Business API (image, video, audio, document, sticker).
- Extract media IDs and, where possible, log them so they are recognized as media in the chat (Meta requires an extra step to get URLs from IDs, but I will ensure they are at least identified as media).

#### 4. Update `webhook-meta-v2` (if applicable):
- Apply similar fixes to the v2 version of the Meta webhook to ensure consistency.

### Technical Details:
- The UI uses a regex `^\[media:(image|imagem|video|audio|document|sticker|figurinha|gif):(.+?)\]` to identify media in the message content.
- I will ensure all outgoing and incoming media messages follow this exact format.
