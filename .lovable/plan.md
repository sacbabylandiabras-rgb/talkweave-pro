I will update the Instagram webhook to correctly handle story replies and mentions, which are currently not triggering the automation flows.

### Technical Details
1.  **Refactor Flow Execution**: Create a centralized `executeFlow` function in `webhook-instagram/index.ts` to handle traversing and executing nodes (DM, Response, WhatsApp, Delay).
2.  **Handle Story Replies**: Update the `messaging` event handler to detect when a message is a reply to a story or a story mention (via attachments) and trigger automations with `triggerType: "story_reply"`.
3.  **Handle DM Keywords**: Add logic to trigger flows when a regular DM matches keywords (currently only comments trigger flows).
4.  **Handle Story Mentions (Field)**: Update the `mentions` change handler to trigger the appropriate flows.
5.  **Trigger Type Filtering**: Ensure that only trigger nodes matching the current event type (comment, dm, story_reply) are activated.

### User Impact
This will enable the "Story Reply" and "Story Mention" automation templates to work as expected, allowing users to automate responses when someone interacts with their Instagram Stories.