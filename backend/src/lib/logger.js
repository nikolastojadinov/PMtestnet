// Simple logger wrapper to keep consistent formatting
export function log(msg) {
  const ts = new Date().toISOString();
  // Keep console.log for Render logs visibility
  console.log(`${ts} ${msg}`);
}
export default { log };
