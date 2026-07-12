import { behavioral, sync, thread } from '../behavioral.ts'
import { UI_MESSAGE_TYPES } from '../ui/message.constants.ts'
import { ErrorMessageSchema, FormSubmitMessageSchema, UiEventMessageSchema } from '../ui/message.schemas.ts'
import { B_PROGRAM_MESSAGE_TYPES } from './message.constants.ts'
import { AttrsMessageSchema, DispatchCustomEventMessageSchema, RenderMessageSchema } from './message.schemas.ts'

const { addThread } = behavioral()

addThread(
  'prevent improperly formatted events',
  thread([
    sync({
      block: [
        {
          type: B_PROGRAM_MESSAGE_TYPES.attrs,
          detailMatch: 'invalid',
          detailSchema: AttrsMessageSchema.shape.detail,
        },
        {
          type: B_PROGRAM_MESSAGE_TYPES.render,
          detailMatch: 'invalid',
          detailSchema: RenderMessageSchema.shape.detail,
        },
        {
          type: B_PROGRAM_MESSAGE_TYPES.dispatch_custom_event,
          detailMatch: 'invalid',
          detailSchema: DispatchCustomEventMessageSchema.shape.detail,
        },
        {
          type: UI_MESSAGE_TYPES.ui_event,
          detailMatch: 'invalid',
          detailSchema: UiEventMessageSchema.shape.detail,
        },
        {
          type: UI_MESSAGE_TYPES.form_submit,
          detailMatch: 'invalid',
          detailSchema: FormSubmitMessageSchema.shape.detail,
        },
        {
          type: UI_MESSAGE_TYPES.error,
          detailMatch: 'invalid',
          detailSchema: ErrorMessageSchema.shape.detail,
        },
      ],
    }),
  ]),
)
