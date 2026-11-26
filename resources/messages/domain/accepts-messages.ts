/**
 * Whether a published SiteDocument offers the public contact form.
 *
 * It reads the `formEnabled` and `hidden` props of the `contact` block (`resources/blocks`), which
 * are part of the persisted SiteDocument contract.
 *
 * The check is structural on purpose: snapshots are immutable and were validated when published, so
 * a later schema change must not make an old snapshot unreadable here. Only a visible `contact`
 * block with `formEnabled === true` counts; snapshots published before the prop existed lack it and
 * therefore never accept messages.
 */
export function documentAcceptsContactMessages(document: unknown): boolean {
  if (!isRecord(document) || !Array.isArray(document.pages)) return false;
  return document.pages.some((page) => isRecord(page)
    && Array.isArray(page.blocks)
    && page.blocks.some((block) => isRecord(block)
      && block.type === 'contact'
      && isRecord(block.props)
      && block.props.formEnabled === true
      && block.props.hidden !== true));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
