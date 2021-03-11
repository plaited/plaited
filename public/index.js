import {register, strand} from '../src'

const strands = {
  append: strand(
    {waitFor: [{eventName: 'click->button'}]},
    {request: [{eventName: 'append'}]},
  ),  
}

const actions = target =>  ({
  ['append'](e){
    target('paragraph').append('some text should probably go here right?')
  },
})

register('plaited-fixture', {strands, actions})
