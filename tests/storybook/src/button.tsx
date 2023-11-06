import { Component } from "plaited";

export class Button extends Component({
  tag: 'plaited-button',
  template: <button><slot></slot></button>,
  observedTriggers: { click: 'click' },
}){}