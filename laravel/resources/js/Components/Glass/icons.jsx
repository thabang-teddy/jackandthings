/**
 * Shared icon set for the glass theme (rail, topbar, cards, forms).
 *
 * Each icon is a thin wrapper over FontAwesome's React component, keeping the
 * original `{ size, className }` API so call sites and Rail's string-keyed map
 * stay unchanged. Icons render as inline SVG (no webfont, no CDN) — FontAwesome's
 * runtime CSS injection is disabled in app.jsx for CSP-friendliness.
 */
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faArrowDown,
    faArrowUp,
    faBell,
    faCalendar,
    faChartColumn,
    faCheck,
    faClock,
    faClockRotateLeft,
    faCopy,
    faFileLines,
    faForwardStep,
    faHeart,
    faListUl,
    faMagnifyingGlass,
    faPause,
    faPlus,
    faRepeat,
    faRightLeft,
    faStar,
    faTableCells,
    faUser,
} from '@fortawesome/free-solid-svg-icons';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons';

/**
 * Build a named icon component that maps our `{ size, className }` API onto
 * FontAwesome. `size` is a pixel value applied via fontSize (FA scales to 1em).
 */
function makeIcon(definition) {
    return function Icon({ size = 16, className, style, ...rest }) {
        return (
            <FontAwesomeIcon
                icon={definition}
                className={className}
                style={{ fontSize: size, ...style }}
                {...rest}
            />
        );
    };
}

export const ClockIcon = makeIcon(faClock);
export const DocumentIcon = makeIcon(faFileLines);
export const BarsIcon = makeIcon(faChartColumn);
export const HeartIcon = makeIcon(faHeart);
export const CopyIcon = makeIcon(faCopy);
export const HistoryIcon = makeIcon(faClockRotateLeft);
export const SearchIcon = makeIcon(faMagnifyingGlass);
export const BellIcon = makeIcon(faBell);
export const ArrowDownIcon = makeIcon(faArrowDown);
export const ArrowUpIcon = makeIcon(faArrowUp);
export const SwapIcon = makeIcon(faRightLeft);
export const PersonIcon = makeIcon(faUser);
export const PlusIcon = makeIcon(faPlus);
export const GridIcon = makeIcon(faTableCells);
export const CheckIcon = makeIcon(faCheck);

// Added for later workstreams (default toggle, pickers, watch list, transport).
export const StarIcon = makeIcon(faStar);
export const StarOutlineIcon = makeIcon(faStarRegular);
export const CalendarIcon = makeIcon(faCalendar);
export const ListIcon = makeIcon(faListUl);
export const RepeatIcon = makeIcon(faRepeat);
export const ForwardIcon = makeIcon(faForwardStep);
export const PauseIcon = makeIcon(faPause);
