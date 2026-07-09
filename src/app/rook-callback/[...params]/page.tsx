'use client';
// This catch-all handles the path Rook appends to our redirect_url:
// /rook-callback/client_uuid/<uuid>/user_id/<patientId>
// We just re-export the same callback page since all the logic is in the parent.
export { default } from '../page';
