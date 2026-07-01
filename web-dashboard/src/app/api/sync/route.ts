// Backward-compat alias for the pre-3.2 sync endpoint. New clients use /api/m/sync.
// Remove once the mobile client ships pointing at /api/m/sync.
export { GET, POST } from '../m/sync/route'
