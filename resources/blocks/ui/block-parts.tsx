import type { ReactNode } from 'react';
import styles from './portfolio-blocks.module.css';

/**
 * Small pieces shared by the portfolio block renderers.
 *
 * They belong to the block stylesheet, not to the dashboard: the public page and the editor canvas
 * load the same module, so a block looks identical in both surfaces.
 */

export type BlockMediaProps = {
  /** Asset id stored in the document; the URL is resolved by the surface that renders the block. */
  assetId: string;
  alt: string;
  className?: string;
};

/**
 * Renders a content image, or nothing when the block has no asset selected.
 *
 * The element reads the image from a fixed route; the block never receives a URL from the user, so
 * a document cannot point at an arbitrary host.
 */
export function BlockMedia({ assetId, alt, className }: BlockMediaProps) {
  if (!assetId) return null;

  return (
    // The asset id is only known at render time and is served by our own /api/assets route, so
    // next/image cannot be configured with a static allowlist here. Optimizing media belongs to the
    // media issue, which owns the asset pipeline; this stays a plain <img> until then.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={[styles.media, className].filter(Boolean).join(' ')}
      src={`/api/assets/${encodeURIComponent(assetId)}`}
      alt={alt}
      loading="lazy"
      decoding="async"
    />
  );
}

export type BlockActionItem = {
  label: string;
  url: string;
  style: 'button' | 'text';
  /** Marks the destination as external, so the link opens safely in a new tab. */
  external?: boolean;
};

export type BlockActionsProps = {
  items: readonly BlockActionItem[];
};

/** Renders the links of a block; nothing is rendered when the block declares no destinations. */
export function BlockActions({ items }: BlockActionsProps) {
  if (items.length === 0) return null;

  return (
    <ul className={styles.actions}>
      {items.map((item) => (
        <li key={`${item.label}-${item.url}`}>
          <a
            className={item.style === 'button' ? styles.actionButton : styles.actionLink}
            href={item.url}
            {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          >
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

export type BlockEntry = {
  title: string;
  subtitle?: string;
  period?: string;
  description?: string;
};

export type BlockEntriesProps = {
  entries: readonly BlockEntry[];
};

/** Renders the lists used by experience, projects and testimonials. */
export function BlockEntries({ entries }: BlockEntriesProps) {
  if (entries.length === 0) return null;

  return (
    <ul className={styles.entries}>
      {entries.map((entry, index) => (
        <li key={`${entry.title}-${index}`} className={styles.entry}>
          <div className={styles.entryHeading}>
            <h3 className={styles.entryTitle}>{entry.title}</h3>
            {entry.period ? <span className={styles.entryPeriod}>{entry.period}</span> : null}
          </div>
          {entry.subtitle ? <p className={styles.entrySubtitle}>{entry.subtitle}</p> : null}
          {entry.description ? <p className={styles.entryDescription}>{entry.description}</p> : null}
        </li>
      ))}
    </ul>
  );
}

export type BlockTagListProps = {
  items: readonly string[];
};

/** Renders a short inline list, used by the skills block. */
export function BlockTagList({ items }: BlockTagListProps) {
  if (items.length === 0) return null;

  return (
    <ul className={styles.tags}>
      {items.map((item) => (
        <li key={item} className={styles.tag}>{item}</li>
      ))}
    </ul>
  );
}

/** Wraps free text so every block keeps the same paragraph rhythm. */
export function BlockProse({ children }: { children: ReactNode }) {
  return <div className={styles.prose}>{children}</div>;
}

