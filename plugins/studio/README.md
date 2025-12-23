# Design Studio Plugin

AI design studio for Plaited templates. Creates outcome-based UI patterns for MCP (Model Context Protocol) Apps and A2UI agent-driven interfaces using generative design principles.

## Features

- **CSS-in-JS Documentation**: Comprehensive patterns for Plaited's atomic CSS system
- **Web API Patterns**: Modern HTML and Web API patterns optimized for Shadow DOM
- **Framework Knowledge**: Deep understanding of Plaited's behavioral programming paradigm
- **Template Guidance**: Best practices for creating reactive web components

## Installation

### Prerequisites

This plugin requires **TypeScript LSP** for optimal functionality:

```json
{
  "enabledPlugins": {
    "typescript-lsp@claude-plugins-official": true,
    "design-studio@plaited": true
  }
}
```

### Option 1: Install from Marketplace (Recommended)

1. Add the Plaited marketplace to your Claude Code settings:

```json
{
  "extraKnownMarketplaces": {
    "plaited": "https://raw.githubusercontent.com/plaited/plaited/main/.claude-plugin/marketplace.json"
  },
  "enabledPlugins": {
    "design-studio@plaited": true
  }
}
```

2. Restart Claude Code

### Option 2: Local Development

Clone the repository and enable the plugin locally:

```bash
git clone https://github.com/plaited/plaited.git
cd plaited
```

Add to your project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "plaited": {
      "source": {
        "source": "directory",
        "path": "."
      }
    }
  },
  "enabledPlugins": {
    "typescript-lsp@claude-plugins-official": true,
    "studio@plaited": true
  }
}
```

## Documentation

### CSS-in-JS Patterns

The plugin includes comprehensive documentation for Plaited's CSS-in-JS system:

- **Atomic CSS Generation**: Hash-based class names with automatic deduplication
- **Nested Selectors**: Media queries, pseudo-classes, attribute selectors
- **Design Tokens**: Type-safe CSS custom properties
- **Keyframe Animations**: Hash-based animation identifiers
- **SSR Support**: Server-side rendering with style collection
- **Shadow DOM Integration**: Automatic style adoption via Constructable Stylesheets

See: `plugins/studio/.claude/rules/plaited/css-in-js.md`

### Web API Patterns

Modern HTML and Web API patterns organized by category:

- **web-apis/**: Intersection Observer, Mutation Observer, Web Workers, Priority Hints
- **performance/**: Resource hints, loading strategies, code splitting
- **accessibility/**: ARIA best practices, semantic HTML, keyboard navigation
- **html-features/**: Dialog, Popover API, Invokers, Details/Summary

See: `plugins/studio/.claude/rules/patterns/`

## Usage

Once enabled, Claude will automatically use the plugin's knowledge when:

- Working with Plaited templates and components
- Creating or modifying CSS-in-JS styles
- Implementing Web API patterns
- Reviewing code for Plaited best practices

## Hooks

### SessionStart Hook

Checks if TypeScript LSP is enabled at session start and provides setup guidance if missing. This runs **once per session**, not on every prompt.

## Contributing

This plugin is part of the [Plaited](https://github.com/plaited/plaited) framework. For issues or contributions, please visit the main repository.

## License

Same license as the Plaited framework.

## Version

- **Current Version**: 0.1.0
- **Requires**: Claude Code, TypeScript LSP (recommended)

## Support

For questions or issues:
- GitHub Issues: https://github.com/plaited/plaited/issues
- Documentation: https://github.com/plaited/plaited

## Changelog

### 0.1.0 (2025-12-22)

- Initial release
- CSS-in-JS pattern documentation
- Web API patterns structure
- SessionStart hook for dependency checking
