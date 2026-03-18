// services/orchestrator/src/common/endpoint.ts
export function normalizeEndpoint(urlOrPath: string): string {
  // strip query string & params, keep a stable slug
  const path = urlOrPath.split('?')[0] || '/'
  // Replace UUIDs/IDs with placeholders if needed; keep dash/alnum only
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':id')
    .replace(/\/\d+(\b|$)/g, '/:id')
    .replace(/\/[^/]+/g, (seg) => seg.toLowerCase())
}
