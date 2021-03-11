import {updateTargets} from './updateTargets'
import {updateTriggers} from './updateTriggers'
import {dataTarget, dataTrigger} from '../constants'

const update = ({context, trigger = true, target = true}) => {
  target && updateTargets(context)
  trigger && updateTriggers(context)
}

export const observer = context => {
  update({context})
  const mo =  new MutationObserver(mutationsList => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        update({context})
      }
      if(mutation.type === 'attributes'){
        mutation.attributeName === dataTrigger || dataTarget && update({
          context,
          target: mutation.attributeName === dataTrigger,
          trigger:  mutation.attributeName === dataTarget,
        })
      }
    }
  })
  mo.observe(context, {
    attributeFilter: [ dataTarget, dataTrigger ],
    childList: true,
    subtree: true,
  })
  return mo
}
