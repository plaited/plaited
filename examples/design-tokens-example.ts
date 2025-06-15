#!/usr/bin/env bun

/**
 * Example demonstrating the workshop design token system
 * This shows how the MCP server tools work for design token generation
 */

import { TransformDesignTokens } from '../src/workshop/design-tokens/transform-design-tokens.js'
import type { DesignTokenGroup } from '../src/workshop/design-tokens/design-token.types.js'

// Example design tokens for a button component
const buttonTokens: DesignTokenGroup = {
  colors: {
    primary: {
      $description: "Primary brand color",
      $type: "color",
      $value: "#007acc"
    },
    primaryHover: {
      $description: "Primary brand color on hover",
      $type: "color", 
      $value: "#005a99"
    },
    primaryActive: {
      $description: "Primary brand color when active",
      $type: "color",
      $value: "#004477"
    },
    text: {
      $description: "Text color for buttons",
      $type: "color",
      $value: "#ffffff"
    },
    border: {
      $description: "Border color",
      $type: "color",
      $value: "{colors.primary}"
    }
  },
  spacing: {
    base: {
      $description: "Base spacing unit",
      $type: "size",
      $value: "1rem"
    },
    buttonPadding: {
      $description: "Button padding",
      $type: "size",
      $value: ["{spacing.base}", "1.5rem"],
      $csv: true
    }
  },
  typography: {
    fontWeight: {
      $description: "Button font weight",
      $value: "600"
    },
    fontSize: {
      $description: "Button font size",
      $type: "size",
      $value: "1rem"
    }
  },
  effects: {
    transition: {
      $description: "Button transition effect",
      $type: "function",
      $value: {
        function: "transition",
        arguments: ["all", "200ms", "ease"]
      }
    },
    borderRadius: {
      $description: "Button border radius",
      $type: "size",
      $value: "0.375rem"
    }
  }
}

// Transform the tokens
console.log('🎨 Transforming design tokens...')
const transformer = new TransformDesignTokens({
  tokens: buttonTokens,
  tokenPrefix: 'btn',
})

console.log('\n📊 Token Summary:')
console.log(`Total tokens: ${transformer.entries.length}`)

const tokenTypes = transformer.entries.reduce((acc, [, entry]) => {
  const type = entry.$type || 'default'
  acc[type] = (acc[type] || 0) + 1
  return acc
}, {} as Record<string, number>)

console.log('Token types:', tokenTypes)

console.log('\n🎯 Generated CSS Variables:')
console.log(transformer.css)

console.log('\n📝 Generated TypeScript References:')
console.log(transformer.ts)

console.log('\n🔍 Token Dependencies:')
transformer.entries.forEach(([alias, entry]) => {
  if (entry.dependencies.length > 0) {
    console.log(`${alias} depends on: ${entry.dependencies.join(', ')}`)
  }
})

console.log('\n✅ Design token transformation complete!')