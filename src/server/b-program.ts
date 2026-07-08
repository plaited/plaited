import { behavioral, sync, thread } from '../behavioral.ts'
import { CONTROLLER_TO_SERVER_EVENTS } from '../controller/message.constants.ts'
import { ErrorMessageSchema, FormSubmitMessageSchema, UiEventMessageSchema } from '../controller/message.schemas.ts'
import { SERVER_TO_CONTROLLER_EVENTS } from '../server/message.constants.ts'
import { AttrsMessageSchema, DispatchCustomEventMessageSchema, RenderMessageSchema } from '../server/message.schemas.ts'

const { addThread } = behavioral()

addThread(
  'prevent improperly formatted events',
  thread([
    sync({
      block: [
        {
          type: SERVER_TO_CONTROLLER_EVENTS.attrs,
          detailMatch: 'invalid',
          detailSchema: AttrsMessageSchema.shape.detail,
        },
        {
          type: SERVER_TO_CONTROLLER_EVENTS.render,
          detailMatch: 'invalid',
          detailSchema: RenderMessageSchema.shape.detail,
        },
        {
          type: SERVER_TO_CONTROLLER_EVENTS.dispatch_custom_event,
          detailMatch: 'invalid',
          detailSchema: DispatchCustomEventMessageSchema.shape.detail,
        },
        {
          type: CONTROLLER_TO_SERVER_EVENTS.ui_event,
          detailMatch: 'invalid',
          detailSchema: UiEventMessageSchema.shape.detail,
        },
        {
          type: CONTROLLER_TO_SERVER_EVENTS.form_submit,
          detailMatch: 'invalid',
          detailSchema: FormSubmitMessageSchema.shape.detail,
        },
        {
          type: CONTROLLER_TO_SERVER_EVENTS.error,
          detailMatch: 'invalid',
          detailSchema: ErrorMessageSchema.shape.detail,
        },
      ],
    }),
  ]),
)
