# microwave-oven-interface
POC test of plaited library
We have a microwave with:
number button 0-9
It has a start button
It has a stop/reset button
It has a 30 seconds button



## data island: microwave display
### modes
- idle
  - waitFor: number
  - waitFor: start
  - waitFor: stop, reset
    - trigger: clear time
- running
  - waitFor: add 30 seconds
    - trigger: add 30 seconds to time
  - waitFor: stop-reset
    - trigger: pause timer
  - waitFor: reset
    - trigger: clear time
  - waitFor: completion
    - trigger: blink
  - block: start
  - block: number

## data island: controls
- waitFor: click->stop/reset
  - trigger: stop
  - trigger: reset

