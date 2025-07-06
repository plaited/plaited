/**
 * Example: Using the Arazzo Runner as an MCP Server
 * 
 * This example demonstrates how to create an MCP server that can execute
 * Arazzo workflows, making complex API orchestrations available to AI assistants.
 */

import { defineArazzoRunner, type ArazzoDocument } from '../define-arazzo-runner.js'
// import { StdioTransport } from '@modelcontextprotocol/sdk/transport/stdio.js'

// Example Arazzo document defining a pet store workflow
const petStoreWorkflows: ArazzoDocument = {
  arazzo: '1.0.1',
  info: {
    title: 'Pet Store Workflows',
    version: '1.0.0',
    description: 'Workflows for purchasing pets with coupon support',
  },
  sourceDescriptions: [
    {
      name: 'petStoreApi',
      url: 'https://petstore.example.com/openapi.yaml',
      type: 'openapi',
    },
  ],
  workflows: [
    {
      workflowId: 'purchasePetWithCoupon',
      summary: 'Purchase a pet with an applicable coupon',
      description: 'Find an available pet, search for coupons, and complete the purchase',
      inputs: {
        type: 'object',
        properties: {
          petType: {
            type: 'string',
            description: 'Type of pet to search for (dog, cat, etc.)',
          },
          maxPrice: {
            type: 'number',
            description: 'Maximum price willing to pay',
          },
        },
        required: ['petType'],
      },
      steps: [
        {
          stepId: 'findPet',
          description: 'Search for available pets by type',
          operationId: 'findPetsByType',
          parameters: [
            {
              name: 'type',
              in: 'query',
              value: '$inputs.petType',
            },
            {
              name: 'status',
              in: 'query',
              value: 'available',
            },
          ],
          successCriteria: [
            {
              condition: '$statusCode == 200',
            },
            {
              context: '$response.body',
              condition: '$[?count(@.pets) > 0]',
              type: 'jsonpath',
            },
          ],
          outputs: {
            selectedPet: '$response.body#/pets/0',
            petId: '$response.body#/pets/0/id',
            petPrice: '$response.body#/pets/0/price',
          },
        },
        {
          stepId: 'checkPrice',
          description: 'Verify pet price is within budget',
          operationId: 'noop', // Placeholder for price check
          successCriteria: [
            {
              condition: '$steps.findPet.outputs.petPrice <= $inputs.maxPrice',
            },
          ],
          onFailure: [
            {
              name: 'priceExceeded',
              type: 'end',
              criteria: [
                {
                  condition: '$steps.findPet.outputs.petPrice > $inputs.maxPrice',
                },
              ],
            },
          ],
        },
        {
          stepId: 'findCoupons',
          description: 'Search for applicable coupons',
          operationId: 'getCouponsForPet',
          parameters: [
            {
              name: 'petId',
              in: 'path',
              value: '$steps.findPet.outputs.petId',
            },
          ],
          successCriteria: [
            {
              condition: '$statusCode == 200',
            },
          ],
          outputs: {
            couponCode: '$response.body#/coupons/0/code',
            discount: '$response.body#/coupons/0/discountPercent',
          },
        },
        {
          stepId: 'createOrder',
          description: 'Create order with coupon applied',
          operationId: 'createPetOrder',
          requestBody: {
            contentType: 'application/json',
            payload: {
              petId: '$steps.findPet.outputs.petId',
              couponCode: '$steps.findCoupons.outputs.couponCode',
              quantity: 1,
            },
          },
          successCriteria: [
            {
              condition: '$statusCode == 201',
            },
          ],
          outputs: {
            orderId: '$response.body#/orderId',
            totalPrice: '$response.body#/totalPrice',
            savings: '$response.body#/discountAmount',
          },
        },
      ],
      outputs: {
        orderId: '$steps.createOrder.outputs.orderId',
        pet: '$steps.findPet.outputs.selectedPet',
        totalPrice: '$steps.createOrder.outputs.totalPrice',
        savings: '$steps.createOrder.outputs.savings',
      },
    },
  ],
  components: {
    parameters: {
      authHeader: {
        name: 'Authorization',
        in: 'header',
        value: 'Bearer $env.PETSTORE_API_KEY',
      },
    },
    failureActions: {
      retryWithBackoff: {
        name: 'retryWithBackoff',
        type: 'retry',
        retryAfter: 2,
        retryLimit: 3,
        criteria: [
          {
            condition: '$statusCode == 429 || $statusCode == 503',
          },
        ],
      },
    },
  },
}

// Create and start the MCP server
async function startArazzoMCPServer() {
  const server = await defineArazzoRunner({
    name: 'petstore-workflow-runner',
    version: '1.0.0',
    arazzoDocuments: [petStoreWorkflows],
    
    // Provide environment variable resolver
    environmentResolver: (key) => {
      // In production, use actual environment variables
      const env: Record<string, string> = {
        PETSTORE_API_KEY: 'demo-api-key-12345',
      }
      return env[key]
    },

    // Configure the behavioral program
    async bProgram({ trigger, tools, resources, prompts, runner }) {
      // Set up event handlers for MCP tools
      return {
        // Execute workflow tool handler
        'execute-workflow': async ({ resolve, reject, args }: { resolve: any; reject: any; args: { workflowId: string; inputs: Record<string, any> } }) => {
          try {
            console.log(`Executing workflow: ${args.workflowId}`)
            const result = await runner.executeWorkflow(args.workflowId, args.inputs)
            
            resolve({
              content: [
                {
                  type: 'text',
                  text: `Workflow completed successfully!\n${JSON.stringify(result, null, 2)}`,
                },
              ],
            })
          } catch (error) {
            reject(error as Error)
          }
        },

        // List workflows tool handler
        'list-workflows': async ({ resolve }: { resolve: any }) => {
          const workflows = runner.listWorkflows()
          resolve({
            content: [
              {
                type: 'text',
                text: workflows
                  .map(w => `- ${w.workflowId}: ${w.summary || 'No summary'}`)
                  .join('\n'),
              },
            ],
          })
        },

        // Describe workflow tool handler
        'describe-workflow': async ({ resolve, args }: { resolve: any; args: { workflowId: string } }) => {
          const workflow = runner.describeWorkflow(args.workflowId)
          if (!workflow) {
            resolve({
              content: [{ type: 'text', text: 'Workflow not found' }],
            })
            return
          }

          const description = `
# ${workflow.workflowId}

${workflow.description || workflow.summary || 'No description'}

## Steps:
${workflow.steps.map(s => `- ${s.stepId}: ${s.description || 'No description'}`).join('\n')}

## Inputs:
${JSON.stringify(workflow.inputs, null, 2)}

## Outputs:
${JSON.stringify(workflow.outputs, null, 2)}
`
          resolve({
            content: [{ type: 'text', text: description }],
          })
        },

        // Arazzo document resource handler
        'arazzo-document': async ({ resolve }: { resolve: any }) => {
          const docs = runner.getDocuments()
          resolve({
            contents: [
              {
                text: JSON.stringify(docs, null, 2),
                mimeType: 'application/json',
              },
            ],
          })
        },

        // Workflow state resource handler
        'workflow-state': async ({ resolve, args: [url, params] }: { resolve: any; args: [URL, Record<string, string | string[]>] }) => {
          const workflowId = params?.workflowId as string
          const state = runner.getWorkflowState(workflowId)
          
          resolve({
            contents: [
              {
                text: JSON.stringify(state || { message: 'Workflow not running' }, null, 2),
                mimeType: 'application/json',
              },
            ],
          })
        },

        // Generate workflow inputs prompt handler
        'generate-workflow-inputs': async ({ resolve, args }: { resolve: any; args: { workflowId: string } }) => {
          const workflow = runner.describeWorkflow(args.workflowId)
          if (!workflow) {
            resolve({
              messages: [
                {
                  role: 'assistant',
                  content: { type: 'text', text: 'Workflow not found' },
                },
              ],
            })
            return
          }

          const exampleInputs = {
            petType: 'dog',
            maxPrice: 500,
          }

          resolve({
            messages: [
              {
                role: 'assistant',
                content: {
                  type: 'text',
                  text: `Here's an example input for the "${args.workflowId}" workflow:\n\n\`\`\`json\n${JSON.stringify(exampleInputs, null, 2)}\n\`\`\``,
                },
              },
            ],
          })
        },
      }
    },
  })

  // Connect to stdio transport for CLI usage
  // const transport = new StdioTransport()
  // await server.connect(transport)
  
  console.error('Arazzo MCP Server running on stdio')
  console.error('Available tools:')
  console.error('  - execute-workflow: Run an Arazzo workflow')
  console.error('  - list-workflows: List available workflows')
  console.error('  - describe-workflow: Get workflow details')
  console.error('Resources:')
  console.error('  - arazzo-document: Access Arazzo documents')
  console.error('  - workflow-state: Get workflow execution state')
  console.error('Prompts:')
  console.error('  - generate-workflow-inputs: Generate example inputs')
}

// Start the server if run directly
if (import.meta.main) {
  startArazzoMCPServer().catch(console.error)
}

export { startArazzoMCPServer }