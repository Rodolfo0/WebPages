import { createBlockRegistry, type BlockRegistry } from '../../domain/block-registry';
import { heroBlock } from './hero';
import { aboutBlock } from './about';
import { experienceBlock } from './experience';
import { projectsBlock } from './projects';
import { skillsBlock } from './skills';
import { testimonialsBlock } from './testimonials';
import { contactBlock } from './contact';
import { footerBlock } from './footer';

/**
 * The portfolio catalog offered by the MVP.
 *
 * The order matches the reading order of the portfolio template, so the editor catalog can present
 * the blocks in the sequence a visitor would see them.
 */
export const PORTFOLIO_BLOCKS = [
  heroBlock,
  aboutBlock,
  experienceBlock,
  projectsBlock,
  skillsBlock,
  testimonialsBlock,
  contactBlock,
  footerBlock,
] as const;

/**
 * The registry the editor and the public renderer share.
 *
 * It is built once: `createBlockRegistry` rejects duplicate types, so a copy-paste mistake while
 * adding a block fails immediately instead of silently overriding another one.
 */
export const portfolioBlockRegistry: BlockRegistry = createBlockRegistry(PORTFOLIO_BLOCKS);

export { heroBlock, aboutBlock, experienceBlock, projectsBlock, skillsBlock };
export { testimonialsBlock, contactBlock, footerBlock };
