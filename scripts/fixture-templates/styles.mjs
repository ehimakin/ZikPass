/** Shared look for synthetic fixtures. Every fixture carries a SPECIMEN mark. */
export const base = `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Helvetica Neue", Arial, sans-serif; color: #111; background: #fff; }
  .specimen { position: absolute; inset: auto 0 10px 0; text-align: center; font-size: 11px; letter-spacing: 2px; color: #b00020; }
  .watermark { position: absolute; top: 45%; left: 0; right: 0; text-align: center; font-size: 64px; font-weight: 800;
    color: rgba(176, 0, 32, 0.12); transform: rotate(-18deg); letter-spacing: 8px; pointer-events: none; }
  .mrz { font-family: Menlo, "Courier New", monospace; font-size: 25px; letter-spacing: 1.6px; line-height: 1.5; white-space: pre; }
`;
