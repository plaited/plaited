import { test, expect, jest } from 'bun:test'
import beautify from 'beautify'

import { transformTokens } from "../transform-tokens.js";
import { DesignTokenGroup } from "../types.js";

test("empty token group", () => {
  const tokens = {
    colors: {},
  };
  const { css, ts } = transformTokens({
    tokens,
  });
  expect(beautify(css, { format: 'css' })).toBe('');
  expect(ts).toBe('');
});

test("token group", () => {
  const tokens: DesignTokenGroup = {
    lineHeight: {
      xxs: { $value: 0.25, $type: "lineHeight", $description: "mock description" },
      xs: { $value: 0.5, $type: "lineHeight", $description: "mock description" },
      sm: { $value: 0.75, $type: "lineHeight", $description: "mock description" },
      md: { $value: 1, $type: "lineHeight", $description: "mock description" },
      ml: { $value: 1.25, $type: "lineHeight", $description: "mock description" },
      lg: { $value: 1.5, $type: "lineHeight", $description: "mock description" },
      xl: { $value: 2, $type: "lineHeight", $description: "mock description" },
      xxl: { $value: 3, $type: "lineHeight", $description: "mock description" },
      xxxl: { $value: 3.5, $type: "lineHeight", $description: "mock description" },
    },
  };
  const { css, ts } = transformTokens({
    tokens,
  });
  expect(beautify(css, { format: 'css' })).toMatchSnapshot();
  expect(ts).toMatchSnapshot();
});

test("nested token group", () => {
  const tokens: DesignTokenGroup = {
    colors: {
      gray: {
        10: { $value: {
          l: "97.91%",
          c: 0,
          h: 0
        }, $type: "color", $description: "mock description" },
      },
    },
  };
  const { css, ts } = transformTokens({
    tokens,
  });
  expect(beautify(css, { format: 'css' })).toMatchSnapshot();
  expect(ts).toMatchSnapshot();
});

test("context: [media-query]", () => {
  const tokens: DesignTokenGroup = {
    size: {
      dynamic: {
        100: {
          $value: {
            desktop: 3,
            tv: 4,
            mobile: 2,
          },
          $type: "dimension",
          $description: "mock description",
          $extensions: { "plaited-context": "media-query" },
        },
      },
    },
  };
  const { css, ts } = transformTokens({
    tokens,
    contexts: {
      mediaQueries: {
        desktop: "screen and (min-width: 1024px)",
        tv: "screen and (min-width: 1920px)",
        mobile: "screen and (max-width: 767px)",
      },
    },
  });
  expect(beautify(css, { format: 'css' })).toMatchSnapshot();
  expect(ts).toMatchSnapshot();
});

test("context: [color-scheme]", () => {
  const tokens: DesignTokenGroup = {
    colors: {
      background: {
        primary: {
          $value: {
            light: {
              l: "100%",
              c: 0,
              h: 0,
              a: 0.5,
            },
            dark: {
              l: "0%",
              c: 0,
              h: 0,
              a: 0.5,
            },
          },
          $type: "color",
          $extensions: { "plaited-context": "color-scheme" },
          $description: "mock description",
        },
      },
    },
  };
  const { css, ts } = transformTokens({
    tokens,
    contexts: {
      colorSchemes: {
        light: "light",
        dark: "dark",
      },
    },
  });
  expect(beautify(css, { format: 'css' })).toMatchSnapshot();
  expect(ts).toMatchSnapshot();
});

test("context: [media-query, color-scheme]", () => {
  const tokens: DesignTokenGroup = {
    size: {
      dynamic: {
        100: {
          $value: {
            tv: 4,
            mobile: 2,
            desktop:3,
          },
          $type: "dimension",
          $description: "mock description",
          $extensions: { "plaited-context": "media-query" },
        },
      },
    },
    colors: {
      background: {
        primary: {
          $value: {
            light: {
              l: "100%",
              c: 0,
              h: 0,
              a: 0.5,
            },
            dark: {
              l: "0%",
              c: 0,
              h: 0,
              a: 0.5,
            },
          },
          $type: "color",
          $extensions: { "plaited-context": "color-scheme" },
          $description: "mock description",
        },
      },
    },
  };
  const { css, ts } = transformTokens({
    tokens,
    contexts: {
      mediaQueries: {
        desktop: "screen and (min-width: 1024px)",
        mobile: "screen and (max-width: 767px)",
        tv: "screen and (min-width: 1920px)",
      },
      colorSchemes: {
        light: "light",
        dark: "dark",
      },
    },
  });
  expect(beautify(css, { format: 'css' })).toMatchSnapshot();
  expect(ts).toMatchSnapshot();
});

test("alias", () => {
  const tokens: DesignTokenGroup = {
    colors: {
      gray: {
        100: { $value: {
          l: "98.21%",
          c: 0,
          h: 0
        }, $type: "color", $description: "mock description" },
      },
    },
    surface: {
      secondary: {
        100: {
          $value: "{colors.gray.100}",
          $type: "color",
          $description: "mock description"
        },
      },
    },
  };
  const { css, ts } = transformTokens({
    tokens,
  });
  expect(beautify(css, { format: 'css' })).toMatchSnapshot();
  expect(ts).toMatchSnapshot();
});

test("alias + context", () => {
  const tokens: DesignTokenGroup = {
    colors: {
      white: {
        100: { $value: {
          l: "97.91%",
          c: 0,
          h: 0
        }, $type: "color", $description: "mock description" },
      },
      charcoal: {
        100: { $value: {
          l: "18.31%",
          c: 0.004,
          h: 285.99
        }, $type: "color", $description: "mock description" },
      },
    },
    surface: {
      secondary: {
        100: {
          $value: {
            light: "{colors.white.100}",
            dark: "{colors.charcoal.100}",
          },
          $type: "color",
          $description: "mock description",
          $extensions: { "plaited-context": "color-scheme" },
        },
      },
    },
  };
  const { css, ts } = transformTokens({
    tokens,
    contexts: {
      colorSchemes: {
        light: "light",
        dark: "dark",
      },
    },
  });
  expect(beautify(css, { format: 'css' })).toMatchSnapshot();
  expect(ts).toMatchSnapshot();
});

test("exercise token types", () => {
  const tokens: DesignTokenGroup = {
    fontWeight: { $value: 700, $type: "fontWeight", $description: "mock description" },
    letterSpacing: {
      $value: "normal",
      $type: "primitive",
      $description: "mock description"
    },
    border: {
      $value: {
        width: 1,
        style: "solid",
        color: {
          l: "0%",
          c: 0,
          h: 0,
        },
      },
      $type: "border",
      $description: "mock description"
    },
    dropShadow: {
      $value: {
        offsetX: 0,
        offsetY: 4,
        blur: 4,
        color: {
          l: "0%",
          c: 0,
          h: 0,
          a: 0.5,
        },
      },
      $type: "dropShadow",
      $description: "mock description"
    },
    gradient: {
      $value: {
        gradientFunction: "linear-gradient",
        angleShapePosition: "45deg",
        colorStops: [
          { color: {
            l: "0%",
            c: 0,
            h: 0,
            a: 0.5,
          }, position: "20%" },
          { color: {
            l: "100%",
            c: 0,
            h: 0,
            a: 0.5,
          }, position: "80%" },
        ],
      },
      $type: "gradient",
      $description: "mock description"
    },
    fontFamily: {
      $value: ["Roboto", "sans-serif"],
      $type: "fontFamily",
      $description: "mock description"
    },
    transition: {
      $value: {
        duration: "0.3s",
        delay: "0s",
        timingFunction: "ease-in-out",
      },
      $type: "transition",
      $description: "mock description"
    },
    transitionCubic: {
      $value: {
        duration: "0.3s",
        delay: "0s",
        timingFunction: {
          function: "cubic-bezier",
          values: [0.25, 0.1, 0.25, 1],
        },
      },
      $type: "transition",
      $description: "mock description"
    },
    gap: {
      $value: 10,
      $type: "gap",
      $description: "mock description"
    },
    gapPercent: {
      $value: "10%",
      $type: "gap",
      $description: "mock description"
    },
    gridTemplate: {
      $value: `"a a a"\n"b c c"\n"b c c"`,
      $type: "gridTemplate",
      $description: "mock description"
    },
    gridTemplateColumns: {
      $value: [60, 60],
      $type: "gridTemplate",
      $description: "mock description"
    },
    fontSize: {
      $value: 14,
      $type: "dimension",
      $description: "mock description",
    },
    lineHeight: {
      $value: 1,
      $type: "primitive",
      $description: "mock description"
    },
    typography: {
      $value: {
        fontFamily: "{fontFamily}",
        fontSize: "{fontSize}",
        fontWeight: "{fontWeight}",
        letterSpacing: "{letterSpacing}",
        lineHeight: "{lineHeight}",
      },
      $type: "typography",
      $description: "mock description"
    },
    flex: {
      $value: {
        display: "flex",
        columnGap: "{gap}",
      },
      $type: "flex",
      $description: "mock description"
    },
    grid: {
      $value: {
        display: "inline-grid",
        columnGap: "{gap}",
        rowGap: "{gapPercent}",
      },
      $type: "grid",
      $description: "mock description"
    },
    primitiveString: {
      $value: "primitive string",
      $type: "primitive",
      $description: "mock description"
    },
    primitiveNumber: {
      $value: 50,
      $type: "primitive",
      $description: "mock description"
    },
  };
  const { css, ts } = transformTokens({
    tokens,
    contexts: {
      colorSchemes: {
        light: "light",
        dark: "dark",
      },
    },
  });
  expect(beautify(css, { format: 'css' })).toMatchSnapshot();
  expect(ts).toMatchSnapshot();
});

test("invalid alias", () => {
  const tokens: DesignTokenGroup = {
    colors: {
      white: {
        100: {
          $value: {
            l: "100%",
            c: 0,
            h: 0,
            a: 0.5,
          },
          $type: "color",
          $description: "mock description"
        },
      },
    },
    surface: {
      secondary: {
        100: {
          $value: "{colors.white.200}",
          $type: "color",
          $description: "mock description"
        },
      },
    },
  };
  console.error = jest.fn();
  transformTokens({
    tokens,
  });
  //@ts-expect-error: it exist
  console.error.mock.calls.forEach((call) => {
    expect(call[0]).toBe(`Invalid token alias: {colors.white.200}`);
  });
});

test("invalid context", () => {
  const tokens: DesignTokenGroup = {
    size: {
      dynamic: {
        "1": {
          $value: {
            desktop: 2,
          },
          $type: "dimension",
          $description: "mock description",
          //@ts-expect-error: it exist
          $extensions: { "plaited-context": "media" },
        },
      },
    },
  };
  transformTokens({
    tokens,
  });
  console.error = jest.fn();
  transformTokens({
    tokens,
  });
  //@ts-expect-error: it exist
  console.error.mock.calls.forEach((call) => {
    expect(call[0]).toBe(`Context type [media] is an invalid context type`);
  });
});

test("invalid context key", () => {
  const tokens: DesignTokenGroup = {
    size: {
      dynamic: {
        "1": {
          $value: {
            tv: 4,
          },
          $type: "dimension",
          $description: "mock description",
          $extensions: { "plaited-context": "media-query" },
        },
      },
    },
  };
  console.error = jest.fn();
  transformTokens({
    tokens,
    contexts: {
      mediaQueries: {
        desktop: "screen and (min-width: 1024px)",
        mobile: "screen and (max-width: 767px)",
      },
    },
  });
  //@ts-expect-error: it exist
  console.error.mock.calls.forEach((call) => {
    expect(call[0]).toBe(`[tv] not found in mediaQueries`);
  });
});