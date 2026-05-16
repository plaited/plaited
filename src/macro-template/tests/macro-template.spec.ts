import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import {
  MacroAttrsSchema,
  MacroNodeSchema,
  UiTemplateRegisteredEventSchema,
  UiTemplateValidationFailedEventSchema,
} from '../macro-template.schemas.ts'
import { compileMacroTemplate, renderMacroTemplate, validateMacroTemplateRegistration } from '../macro-template.ts'

describe('macro template compiler', () => {
  test('valid macro template compiles through createTemplate and SSR with escaped output', () => {
    const template = compileMacroTemplate({
      template: {
        alias: 'workspace.greeting',
        ref: 'template:sha256:greeting-v1',
        node: {
          tag: 'div',
          attrs: {
            'p-target': { literal: 'main' },
          },
          children: [
            {
              text: { path: 'user.name' },
            },
          ],
        },
      },
      data: {
        user: {
          name: '<Ada>',
        },
      },
    })

    expect(template.html.join('')).toBe('<div p-target="main" >&lt;Ada&gt;</div>')
    expect(renderMacroTemplate({ template })).toContain('&lt;Ada&gt;')
  })

  test('repeat requires explicit key', () => {
    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.list',
          ref: 'template:sha256:list-v1',
          node: {
            repeat: {
              items: { path: 'items' },
              var: 'item',
              children: [
                {
                  tag: 'li',
                  children: [{ text: { var: 'item', path: 'label' } }],
                },
              ],
            },
          },
        },
        data: {
          items: [{ id: 'one', label: 'One' }],
        },
      } as unknown as Parameters<typeof compileMacroTemplate>[0]),
    ).toThrow()
  })

  test('repeat key is structurally required in macro node JSON schema', () => {
    const schema = z.toJSONSchema(MacroNodeSchema) as {
      anyOf: { properties?: { repeat?: { required?: string[] } } }[]
    }
    const repeatBranch = schema.anyOf.find((branch) => branch.properties?.repeat)

    expect(repeatBranch).toBeDefined()
    expect(repeatBranch?.properties?.repeat?.required).toContain('key')
  })

  test('repeated p-trigger element must expose key attr', () => {
    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.actions',
          ref: 'template:sha256:actions-v1',
          node: {
            repeat: {
              items: { path: 'items' },
              var: 'item',
              key: { var: 'item', path: 'id' },
              children: [
                {
                  tag: 'button',
                  attrs: {
                    'p-trigger': { literal: { click: 'item.selected' } },
                  },
                  children: [{ text: { var: 'item', path: 'label' } }],
                },
              ],
            },
          },
        },
        data: {
          items: [{ id: 'one', label: 'One' }],
        },
      }),
    ).toThrow(/data-\* attr/i)
  })

  test('repeated p-trigger fails when repeat key resolves missing', () => {
    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.actions',
          ref: 'template:sha256:actions-missing-key',
          node: {
            repeat: {
              items: { path: 'items' },
              var: 'item',
              key: { var: 'item', path: 'missingId' },
              children: [
                {
                  tag: 'button',
                  attrs: {
                    'data-item-id': { var: 'item', path: 'id' },
                    'p-trigger': { literal: { click: 'item.selected' } },
                  },
                },
              ],
            },
          },
        },
        data: {
          items: [{ id: 'one' }],
        },
      }),
    ).toThrow(/repeat key/i)
  })

  test('repeated templateRef p-trigger must expose key attr', () => {
    const child = {
      alias: 'workspace.action-button',
      ref: 'template:sha256:action-button-v1',
      node: {
        tag: 'button',
        attrs: {
          'p-trigger': { literal: { click: 'item.selected' } },
        },
        children: [{ text: { path: 'label' } }],
      },
    }

    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.actions',
          ref: 'template:sha256:actions-child-ref',
          node: {
            repeat: {
              items: { path: 'items' },
              var: 'item',
              key: { var: 'item', path: 'id' },
              children: [
                {
                  templateRef: child.ref,
                  data: {
                    label: { var: 'item', path: 'label' },
                  },
                },
              ],
            },
          },
        },
        templates: {
          [child.ref]: child,
        },
        data: {
          items: [{ id: 'one', label: 'One' }],
        },
      }),
    ).toThrow(/data-\* attr/i)
  })

  test('style objects compile through css helpers', () => {
    const template = compileMacroTemplate({
      template: {
        alias: 'workspace.card',
        ref: 'template:sha256:card-v1',
        styles: {
          tokens: {
            palette: {
              primary: { $value: '#123456' },
            },
          },
          classes: {
            card: {
              color: { token: 'palette.primary' },
              backgroundColor: {
                $default: 'white',
                ':hover': '#eeeeee',
              },
            },
          },
        },
        node: {
          tag: 'article',
          styles: ['card'],
          children: [{ text: { literal: 'Styled' } }],
        },
      },
    })

    expect(template.html.join('')).toContain('class="card cls')
    expect(template.stylesheets.join('')).toContain(':root{--palette-primary:#123456;}')
    expect(template.stylesheets.join('')).toContain(':hover')
  })

  test('unsafe attrs and scripts fail through createTemplate', () => {
    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.unsafe',
          ref: 'template:sha256:unsafe-handler',
          node: {
            tag: 'img',
            attrs: {
              src: { literal: '/avatar.png' },
              onerror: { literal: "alert('xss')" },
            },
          },
        },
      }),
    ).toThrow()

    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.unsafe',
          ref: 'template:sha256:unsafe-script',
          node: {
            tag: 'script',
            attrs: {
              src: { literal: 'main.js' },
            },
          },
        },
      }),
    ).toThrow()
  })

  test('unsafe tag and attribute names fail before rendering', () => {
    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.unsafe',
          ref: 'template:sha256:unsafe-tag',
          node: {
            tag: 'img src=x onerror=alert(1)',
          },
        },
      }),
    ).toThrow(/tag/i)

    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.unsafe',
          ref: 'template:sha256:unsafe-attr',
          node: {
            tag: 'div',
            attrs: {
              'x onclick': { literal: 'alert(1)' },
            },
          },
        },
      }),
    ).toThrow(/attribute/i)
  })

  test('uppercase macro attrs fail before rendering', () => {
    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.unsafe',
          ref: 'template:sha256:unsafe-uppercase-trigger',
          node: {
            tag: 'test-island',
            attrs: {
              'P-Trigger': { literal: 'click:evil focus:extra' },
            },
          },
        },
      }),
    ).toThrow(/attribute/i)

    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.unsafe',
          ref: 'template:sha256:unsafe-uppercase-style',
          node: {
            tag: 'test-island',
            attrs: {
              Style: { literal: 'background:url(javascript:alert(1))' },
            },
          },
        },
      }),
    ).toThrow(/attribute/i)
  })

  test('macro attr JSON schema structurally rejects event handler names', () => {
    const schema = z.toJSONSchema(MacroAttrsSchema) as {
      propertyNames?: { pattern?: string }
    }

    expect(schema.propertyNames?.pattern).toBeDefined()
    expect(new RegExp(schema.propertyNames!.pattern!).test('onerror')).toBe(false)
  })

  test('reserved renderer props and malformed p-trigger attrs fail validation', () => {
    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.unsafe',
          ref: 'template:sha256:unsafe-stylesheet',
          node: {
            tag: 'div',
            attrs: {
              stylesheets: { literal: ['body{display:none}'] },
            },
          },
        },
      }),
    ).toThrow(/reserved/i)

    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.unsafe',
          ref: 'template:sha256:unsafe-trigger',
          node: {
            tag: 'button',
            attrs: {
              'p-trigger': { literal: 'click:item.selected' },
            },
          },
        },
      }),
    ).toThrow(/p-trigger/i)
  })

  test('p-trigger rejects smuggled event bindings', () => {
    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.unsafe',
          ref: 'template:sha256:unsafe-trigger-key',
          node: {
            tag: 'button',
            attrs: {
              'p-trigger': { literal: { 'click focus': 'save' } },
            },
          },
        },
      }),
    ).toThrow(/p-trigger/i)

    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.unsafe',
          ref: 'template:sha256:unsafe-trigger-type',
          node: {
            tag: 'button',
            attrs: {
              'p-trigger': { literal: { click: 'save focus:evil' } },
            },
          },
        },
      }),
    ).toThrow(/p-trigger/i)
  })

  test('registration resolves child refs and stores dependency graph', () => {
    const child = {
      alias: 'workspace.title',
      ref: 'template:sha256:title-v1',
      node: {
        tag: 'h2',
        children: [{ text: { path: 'title' } }],
      },
    }
    const event = validateMacroTemplateRegistration({
      type: 'ui.template_registration_requested',
      detail: {
        fixtureData: {
          title: 'Overview',
        },
        templates: {
          [child.ref]: child,
        },
        template: {
          alias: 'workspace.card',
          ref: 'template:sha256:card-v2',
          node: {
            tag: 'section',
            children: [
              {
                templateRef: child.ref,
                data: {
                  title: { path: 'title' },
                },
              },
            ],
          },
        },
      },
    })

    const registered = UiTemplateRegisteredEventSchema.parse(event)
    expect(registered.detail.dependencyRefs).toEqual([child.ref])
    expect(registered.detail.validation.html).toContain('<h2 >Overview</h2>')
    expect(registered.detail.template.ref).toBe('template:sha256:card-v2')
  })

  test('templateRef cycles emit repairable validation failure', () => {
    const templateA = {
      alias: 'workspace.a',
      ref: 'template:sha256:cycle-a',
      node: {
        tag: 'section',
        children: [{ templateRef: 'template:sha256:cycle-b' }],
      },
    }
    const templateB = {
      alias: 'workspace.b',
      ref: 'template:sha256:cycle-b',
      node: {
        tag: 'section',
        children: [{ templateRef: templateA.ref }],
      },
    }

    const event = validateMacroTemplateRegistration({
      type: 'ui.template_registration_requested',
      detail: {
        template: templateA,
        templates: {
          [templateA.ref]: templateA,
          [templateB.ref]: templateB,
        },
      },
    })

    const failed = UiTemplateValidationFailedEventSchema.parse(event)
    expect(failed.detail.error.message).toContain('cycle')
  })

  test('validation failure emits structured failure detail', () => {
    const event = validateMacroTemplateRegistration({
      type: 'ui.template_registration_requested',
      detail: {
        template: {
          alias: 'workspace.bad',
          ref: 'template:sha256:bad-v1',
          node: {
            tag: 'img',
            attrs: {
              onerror: { literal: "alert('xss')" },
            },
          },
        },
      },
    })

    const failed = UiTemplateValidationFailedEventSchema.parse(event)
    expect(failed.detail.alias).toBe('workspace.bad')
    expect(failed.detail.ref).toBe('template:sha256:bad-v1')
    expect(failed.detail.repairable).toBe(true)
    expect(failed.detail.error.message).toContain('Expected a safe macro attribute name')
  })

  test('reserved macro attrs emit structured validation failure detail', () => {
    const event = validateMacroTemplateRegistration({
      type: 'ui.template_registration_requested',
      detail: {
        template: {
          alias: 'workspace.bad',
          ref: 'template:sha256:bad-reserved',
          node: {
            tag: 'div',
            attrs: {
              stylesheets: { literal: ['body{display:none}'] },
            },
          },
        },
      },
    })

    const failed = UiTemplateValidationFailedEventSchema.parse(event)
    expect(failed.detail.ref).toBe('template:sha256:bad-reserved')
    expect(failed.detail.error.message).toContain('reserved')
  })

  test('reusable templates reject fixed literal p-topic', () => {
    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.topic',
          ref: 'template:sha256:topic-v1',
          node: {
            tag: 'section',
            attrs: {
              'p-topic': { literal: 'fixed-topic' },
            },
          },
        },
      }),
    ).toThrow(/p-topic/i)

    const sessionLocal = compileMacroTemplate({
      template: {
        alias: 'workspace.topic',
        ref: 'template:sha256:topic-v2',
        metadata: {
          sessionLocal: true,
        },
        node: {
          tag: 'test-island',
          attrs: {
            'p-topic': { literal: 'fixed-topic' },
          },
        },
      },
    })

    expect(sessionLocal.html.join('')).toContain('p-topic="fixed-topic"')
  })

  test('reusable templates reject computed fixed p-topic', () => {
    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.topic',
          ref: 'template:sha256:topic-computed',
          node: {
            tag: 'test-island',
            attrs: {
              'p-topic': {
                concat: [{ literal: 'fixed' }, { literal: '-topic' }],
              },
            },
          },
        },
      }),
    ).toThrow(/p-topic/i)
  })

  test('reusable templates reject constant conditional p-topic', () => {
    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.topic',
          ref: 'template:sha256:topic-conditional',
          node: {
            tag: 'test-island',
            attrs: {
              'p-topic': {
                if: {
                  condition: { literal: true },
                  thenValue: { literal: 'fixed-topic' },
                  elseValue: { path: 'topic' },
                },
              },
            },
          },
        },
        data: {
          topic: 'bound-topic',
        },
      }),
    ).toThrow(/p-topic/i)
  })

  test('reusable templates reject fixed p-topic passed through templateRef data', () => {
    const child = {
      alias: 'workspace.topic-child',
      ref: 'template:sha256:topic-child',
      node: {
        tag: 'test-island',
        attrs: {
          'p-topic': { path: 'topic' },
        },
      },
    }

    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.topic-parent',
          ref: 'template:sha256:topic-parent',
          node: {
            tag: 'section',
            children: [
              {
                templateRef: child.ref,
                data: {
                  topic: { literal: 'fixed-topic' },
                },
              },
            ],
          },
        },
        templates: {
          [child.ref]: child,
        },
      }),
    ).toThrow(/p-topic/i)
  })

  test('reusable templates reject fixed p-topic passed through nested templateRef data', () => {
    const grandchild = {
      alias: 'workspace.topic-grandchild',
      ref: 'template:sha256:topic-grandchild',
      node: {
        tag: 'test-island',
        attrs: {
          'p-topic': { path: 'topic' },
        },
      },
    }
    const child = {
      alias: 'workspace.topic-child',
      ref: 'template:sha256:topic-forwarder',
      node: {
        templateRef: grandchild.ref,
        data: {
          topic: { path: 'topic' },
        },
      },
    }

    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.topic-parent',
          ref: 'template:sha256:topic-nested-parent',
          node: {
            tag: 'section',
            children: [
              {
                templateRef: child.ref,
                data: {
                  topic: { literal: 'fixed-topic' },
                },
              },
            ],
          },
        },
        templates: {
          [child.ref]: child,
          [grandchild.ref]: grandchild,
        },
      }),
    ).toThrow(/p-topic/i)
  })

  test('reusable templates reject fixed p-topic from static repeat items', () => {
    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.topic-repeat',
          ref: 'template:sha256:topic-repeat-static',
          node: {
            repeat: {
              items: {
                literal: [{ id: 'one', topic: 'fixed-topic' }],
              },
              var: 'item',
              key: { var: 'item', path: 'id' },
              children: [
                {
                  tag: 'test-island',
                  attrs: {
                    'p-topic': { var: 'item', path: 'topic' },
                  },
                },
              ],
            },
          },
        },
      }),
    ).toThrow(/p-topic/i)
  })

  test('reusable templates reject fixed child p-topic from static repeat data', () => {
    const child = {
      alias: 'workspace.topic-repeat-child',
      ref: 'template:sha256:topic-repeat-child',
      node: {
        repeat: {
          items: { path: 'items' },
          var: 'item',
          key: { var: 'item', path: 'id' },
          children: [
            {
              tag: 'test-island',
              attrs: {
                'p-topic': { var: 'item', path: 'topic' },
              },
            },
          ],
        },
      },
    }

    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.topic-repeat-parent',
          ref: 'template:sha256:topic-repeat-parent',
          node: {
            templateRef: child.ref,
            data: {
              items: {
                literal: [{ id: 'one', topic: 'fixed-topic' }],
              },
            },
          },
        },
        templates: {
          [child.ref]: child,
        },
      }),
    ).toThrow(/p-topic/i)
  })

  test('bound p-topic renders on reusable controller islands', () => {
    const template = compileMacroTemplate({
      template: {
        alias: 'workspace.topic',
        ref: 'template:sha256:topic-v3',
        node: {
          tag: 'test-island',
          attrs: {
            'p-topic': { path: 'topic' },
          },
        },
      },
      data: {
        topic: 'bound-topic',
      },
    })

    expect(template.html.join('')).toContain('p-topic="bound-topic"')
  })

  test('data-bound repeat p-topic renders on reusable controller islands', () => {
    const template = compileMacroTemplate({
      template: {
        alias: 'workspace.topic-repeat',
        ref: 'template:sha256:topic-repeat-bound',
        node: {
          repeat: {
            items: { path: 'items' },
            var: 'item',
            key: { var: 'item', path: 'id' },
            children: [
              {
                tag: 'test-island',
                attrs: {
                  'p-topic': { var: 'item', path: 'topic' },
                },
              },
            ],
          },
        },
      },
      data: {
        items: [{ id: 'one', topic: 'bound-topic' }],
      },
    })

    expect(template.html.join('')).toContain('p-topic="bound-topic"')
  })

  test('p-topic must resolve to a non-empty string', () => {
    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.topic',
          ref: 'template:sha256:topic-number',
          metadata: {
            sessionLocal: true,
          },
          node: {
            tag: 'test-island',
            attrs: {
              'p-topic': { literal: 0 },
            },
          },
        },
      }),
    ).toThrow(/p-topic/i)

    expect(() =>
      compileMacroTemplate({
        template: {
          alias: 'workspace.topic',
          ref: 'template:sha256:topic-empty',
          metadata: {
            sessionLocal: true,
          },
          node: {
            tag: 'test-island',
            attrs: {
              'p-topic': { literal: '' },
            },
          },
        },
      }),
    ).toThrow(/p-topic/i)
  })

  test('expression paths only read own data properties', () => {
    const template = compileMacroTemplate({
      template: {
        alias: 'workspace.prototype-safe',
        ref: 'template:sha256:prototype-safe-v1',
        node: {
          tag: 'div',
          children: [{ text: { path: 'constructor' } }],
        },
      },
      data: {},
    })

    expect(template.html.join('')).toBe('<div ></div>')
  })

  test('structured expressions resolve in repeated interactive templates', () => {
    const template = compileMacroTemplate({
      template: {
        alias: 'workspace.actions',
        ref: 'template:sha256:actions-v2',
        node: {
          repeat: {
            items: { path: 'items' },
            var: 'item',
            key: { var: 'item', path: 'id' },
            children: [
              {
                tag: 'button',
                attrs: {
                  'data-item-id': { var: 'item', path: 'id' },
                  'aria-pressed': {
                    if: {
                      condition: {
                        equals: [{ var: 'item', path: 'status' }, { literal: 'active' }],
                      },
                      thenValue: { literal: 'true' },
                      elseValue: { literal: 'false' },
                    },
                  },
                  'p-trigger': { literal: { click: 'item.selected' } },
                },
                children: [
                  {
                    text: {
                      concat: [{ literal: 'Select ' }, { var: 'item', path: 'label' }],
                    },
                  },
                ],
              },
            ],
          },
        },
      },
      data: {
        items: [
          { id: 'one', label: 'One', status: 'active' },
          { id: 'two', label: 'Two', status: 'idle' },
        ],
      },
    })

    expect(template.html.join('')).toContain('data-item-id="one"')
    expect(template.html.join('')).toContain('aria-pressed="true"')
    expect(template.html.join('')).toContain('Select Two')
  })
})
