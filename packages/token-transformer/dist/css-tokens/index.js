import { border } from './border.js';
import { dimension } from './dimension.js';
import { fontFamily } from './font-family.js';
import { gradient } from './gradient.js';
import { defaultFormat } from './default-format.js';
import { dropShadow } from './drop-shadow.js';
import { transition } from './transition.js';
import { nullFormat } from './null-format.js';
import { gridTemplate } from './grid-template.js';
import { gap } from './gap.js';
/**
 * This formatter object will return formatters that will create content for an
 * optimized css stylesheet of css custom properties to be applied to :root
 */
export const defaultCSSFormatters = ({ $type, $value, ...rest }) => $type === 'border'
    ? border({ ...rest, $value: $value })
    : ['dimension', 'lineHeight', 'letterSpacing', 'fontSize'].includes($type)
        ? dimension({ ...rest, $value: $value })
        : $type === 'fontFamily'
            ? fontFamily({ ...rest, $value: $value })
            : $type === 'gradient'
                ? gradient({ ...rest, $value: $value })
                : $type === 'shadow'
                    ? dropShadow({ ...rest, $value: $value })
                    : $type === 'transition'
                        ? transition({ ...rest, $value: $value })
                        : $type === 'gap'
                            ? gap({ ...rest, $value: $value })
                            : $type === 'gridTemplate'
                                ? gridTemplate({ ...rest, $value: $value })
                                : ['typography', 'grid', 'flex'].includes($type)
                                    ? nullFormat()
                                    : defaultFormat({
                                        ...rest,
                                        $value: $value,
                                    });
