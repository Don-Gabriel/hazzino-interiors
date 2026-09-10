const cursor = (body) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><g stroke="#173f36" stroke-width="1.4" stroke-linejoin="round">${body}</g></svg>`)}") 4 4, crosshair`;
export const TOOL_CURSORS = {
  pushpull: cursor(
    '<path d="M2 2v10M2 2h10" fill="none"/><path d="m8 23 10-5 11 5-10 6Z" fill="#d3e3cf"/><path d="M16 20V10h-4l7-8 7 8h-4v10" fill="#397860"/>',
  ),
  offset: cursor(
    '<path d="M2 2v10M2 2h10" fill="none"/><path d="M9 14h20v15H9Z" fill="#f7f7ed"/><path d="M14 19h10v5H14Z" fill="#c5dcc8"/><path d="m9 14 5 5m-1-5H9v4" fill="none"/>',
  ),
  eraser: cursor(
    '<path d="m5 18 13-14 11 10-13 14h-5Z" fill="#bfd8d4"/><path d="m5 18 7-7 11 10-7 7h-5Z" fill="#f9f1e1"/>',
  ),
  paint: cursor(
    '<path d="m7 9 10-7 12 17-11 8Z" fill="#d1e5dc"/><path d="M5 20c-6 8-3 11 0 11s6-3 0-11" fill="#437e62"/>',
  ),
};
