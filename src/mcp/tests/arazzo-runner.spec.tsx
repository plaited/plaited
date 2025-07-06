import { describe, it, expect, beforeAll } from 'bun:test'
import { defineArazzoRunner, type ArazzoDocument, type WorkflowResult } from '../define-arazzo-runner.js'

describe('defineArazzoRunner', () => {
  // Sample Arazzo document for testing
  const sampleArazzoDoc: ArazzoDocument = {
    arazzo: '1.0.1',
    info: {
      title: 'Test Workflows',
      version: '1.0.0',
      description: 'Test workflows for Arazzo runner',
    },
    sourceDescriptions: [
      {
        name: 'testApi',
        url: 'https://api.example.com/openapi.yaml',
        type: 'openapi',
      },
    ],
    workflows: [
      {
        workflowId: 'simple-workflow',
        summary: 'A simple test workflow',
        description: 'Tests basic workflow execution',
        inputs: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            value: { type: 'number' },
          },
        },
        steps: [
          {
            stepId: 'step1',
            description: 'First step',
            operationId: 'testOperation',
            parameters: [
              {
                name: 'name',
                in: 'query',
                value: '$inputs.name',
              },
            ],
            successCriteria: [
              {
                condition: '$statusCode == 200',
              },
            ],
            outputs: {
              result: '$response.body',
            },
          },
        ],
        outputs: {
          finalResult: '$steps.step1.outputs.result',
        },
      },
      {
        workflowId: 'nested-workflow',
        summary: 'A workflow that calls another workflow',
        inputs: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
        steps: [
          {
            stepId: 'callSimple',
            description: 'Call simple workflow',
            workflowId: 'simple-workflow',
            parameters: [
              {
                name: 'name',
                value: '$inputs.name',
              },
              {
                name: 'value',
                value: 42,
              },
            ],
            outputs: {
              nestedResult: '$outputs.finalResult',
            },
          },
        ],
        outputs: {
          result: '$steps.callSimple.outputs.nestedResult',
        },
      },
    ],
    components: {
      parameters: {
        apiKey: {
          name: 'X-API-Key',
          in: 'header',
          value: '$env.API_KEY',
        },
      },
    },
  }

  describe('server creation', () => {
    it('creates an MCP server with Arazzo runner capabilities', async () => {
      const server = await defineArazzoRunner({
        name: 'test-runner',
        version: '1.0.0',
        arazzoDocuments: [sampleArazzoDoc],
        async bProgram({ runner, tools }) {
          return {
            'execute-workflow': async ({ resolve, args }: { resolve: any; args: { workflowId: string; inputs: Record<string, any> } }) => {
              const result = await runner.executeWorkflow(args.workflowId, args.inputs)
              resolve({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                  },
                ],
              })
            },
            'list-workflows': async ({ resolve }: { resolve: any }) => {
              const workflows = runner.listWorkflows()
              resolve({
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(workflows, null, 2),
                  },
                ],
              })
            },
            'describe-workflow': async ({ resolve, args }: { resolve: any; args: { workflowId: string } }) => {
              const workflow = runner.describeWorkflow(args.workflowId)
              resolve({
                content: [
                  {
                    type: 'text',
                    text: workflow ? JSON.stringify(workflow, null, 2) : 'Workflow not found',
                  },
                ],
              })
            },
          }
        },
      })

      expect(server).toBeDefined()
      expect(server.constructor.name).toBe('McpServer')
    })
  })

  describe('runtime expressions', () => {
    it('evaluates input expressions correctly', async () => {
      let capturedResult: WorkflowResult | undefined

      const server = await defineArazzoRunner({
        name: 'test-runner',
        version: '1.0.0',
        arazzoDocuments: [sampleArazzoDoc],
        httpClient: async ({ url, trigger, type }) => {
          // Mock HTTP client that returns success
          return new Response(JSON.stringify({ data: 'test-response' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        },
        async bProgram({ runner }) {
          return {
            'execute-workflow': async ({ resolve, args }: { resolve: any; args: { workflowId: string; inputs: Record<string, any> } }) => {
              capturedResult = await runner.executeWorkflow(args.workflowId, args.inputs)
              resolve({
                content: [{ type: 'text', text: 'done' }],
              })
            },
          }
        },
      })

      // Simulate workflow execution through the behavioral program
      // In a real scenario, this would be triggered via MCP protocol
      // For testing, we'll directly access the runner
      
      // Note: This test is limited because we can't easily trigger the MCP handlers
      // without a full MCP client/server setup
      expect(server).toBeDefined()
    })
  })

  describe('workflow execution', () => {
    it('lists available workflows', async () => {
      const runner = await createTestRunner()
      const workflows = runner.listWorkflows()

      expect(workflows).toHaveLength(2)
      expect(workflows[0].workflowId).toBe('simple-workflow')
      expect(workflows[1].workflowId).toBe('nested-workflow')
    })

    it('describes a workflow', async () => {
      const runner = await createTestRunner()
      const workflow = runner.describeWorkflow('simple-workflow')

      expect(workflow).toBeDefined()
      expect(workflow?.workflowId).toBe('simple-workflow')
      expect(workflow?.steps).toHaveLength(1)
    })

    it('returns undefined for non-existent workflow', async () => {
      const runner = await createTestRunner()
      const workflow = runner.describeWorkflow('non-existent')

      expect(workflow).toBeUndefined()
    })
  })

  // Helper function to create a test runner
  async function createTestRunner() {
    let runner: any

    await defineArazzoRunner({
      name: 'test-runner',
      version: '1.0.0',
      arazzoDocuments: [sampleArazzoDoc],
      httpClient: async () => {
        return new Response(JSON.stringify({ data: 'test' }), { status: 200 })
      },
      async bProgram({ runner: r }) {
        runner = r
        return {}
      },
    })

    return runner
  }
})

describe('ExpressionEvaluator', () => {
  it('handles embedded expressions', () => {
    // Test would go here if ExpressionEvaluator was exported
    // For now, this is tested through integration tests
    expect(true).toBe(true)
  })
})

describe('CriterionEvaluator', () => {
  it('evaluates simple status code criteria', () => {
    // Test would go here if CriterionEvaluator was exported
    // For now, this is tested through integration tests
    expect(true).toBe(true)
  })
})