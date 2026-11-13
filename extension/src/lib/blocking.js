import { ext } from './ext.js';

/**
 * Strict mode's distraction blocking, which is the one surface that can
 * actually do it.
 *
 * The web page can only keep the screen awake and warn before you leave;
 * Android can silence notifications. An extension with declarativeNetRequest
 * can genuinely stop a request to a named host, which is what issue #3's
 * "blocks distracting sites" means in practice.
 *
 * Rules are *dynamic*, created when a focus run starts and removed when it
 * ends, so the blocklist has no effect outside a session. The permission is
 * optional and requested at the point of use, in keeping with how `history`
 * and `clipboardRead` are handled here - someone who never turns strict mode
 * on never grants an extension the ability to block their browsing.
 */

/** Dynamic rule ids this module owns. Kept clear of any other feature's. */
const RULE_ID_BASE = 7_000;
const MAX_RULES = 50;

/** The blocked tab is sent here, so the block is explained rather than a dead page. */
const BLOCKED_PAGE = 'src/popup/blocked.html';

export function blockingSupported() {
    return Boolean(ext.declarativeNetRequest?.updateDynamicRules);
}

export async function hasBlockingPermission() {
    try {
        return await ext.permissions.contains({ permissions: ['declarativeNetRequest'] });
    } catch {
        return false;
    }
}

export function requestBlockingPermission() {
    return ext.permissions.request({ permissions: ['declarativeNetRequest'] });
}

/**
 * A host pattern as declarativeNetRequest's urlFilter.
 *
 * `||host^` is its own anchor syntax: match this domain and its subdomains,
 * at a domain boundary. A leading "*." in the user's pattern means the same
 * thing, so it is stripped rather than passed through as a literal.
 */
function filterFor(pattern) {
    const host = String(pattern).trim().replace(/^\*\./, '').toLowerCase();

    if (!host || !/^[a-z0-9][a-z0-9.-]*$/.test(host)) return null;

    return `||${host}^`;
}

function rulesFor(sites) {
    return sites
        .map(filterFor)
        .filter(Boolean)
        .slice(0, MAX_RULES)
        .map((urlFilter, index) => ({
            id: RULE_ID_BASE + index,
            priority: 1,
            action: {
                type: 'redirect',
                redirect: { extensionPath: `/${BLOCKED_PAGE}` },
            },
            condition: {
                urlFilter,
                // Top-level navigation only. Blocking sub-resources would
                // break unrelated pages that happen to embed something from a
                // blocked host, which is not what the user asked for.
                resourceTypes: ['main_frame'],
            },
        }));
}

/** Every id this module could have created, for an unconditional clear. */
function ownedRuleIds() {
    return Array.from({ length: MAX_RULES }, (_, index) => RULE_ID_BASE + index);
}

/**
 * Turns the blocklist on. Returns whether it took effect, so the popup can
 * say so plainly instead of implying a block that is not happening.
 */
export async function startBlocking(sites) {
    if (!blockingSupported() || !Array.isArray(sites) || sites.length === 0) return false;
    if (!(await hasBlockingPermission())) return false;

    const addRules = rulesFor(sites);
    if (addRules.length === 0) return false;

    try {
        await ext.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ownedRuleIds(),
            addRules,
        });

        return true;
    } catch (error) {
        console.warn('[jack] could not install blocking rules', error);

        return false;
    }
}

/**
 * Takes the blocklist off again. Removes every id this module owns rather
 * than only the ones it believes it added: a service worker torn down
 * mid-session has no memory of what it installed, and leaving a user's
 * browsing blocked after the timer stopped would be the worst failure here.
 */
export async function stopBlocking() {
    if (!blockingSupported()) return;

    try {
        await ext.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: ownedRuleIds(),
            addRules: [],
        });
    } catch (error) {
        console.warn('[jack] could not remove blocking rules', error);
    }
}
