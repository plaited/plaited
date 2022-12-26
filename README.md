# @plaited/framework

This monorepo is a framework for rapidly coding and refining web application interfaces as specifications (requirements) change and evolve. Web application interfaces are inherently reactive and complex. Business needs are not always clear at the beginning of a project. Untangling code as requirements change is a frustrating process. However what if we could begin working on new interface projects comfortable in our uncertainty and build out solid production ready code?

The framework leverages the behavioral programing algorithm, along with utility functions designed to assist with client side data storage and communication, to enable us to design flexible frontend code where iteratively adding new stuff doesn't require us to relearn or even fully understand a system for fear of regressions and breakage. This is accomplished by using behavioral strands. Using simple idioms we define our requirements and actions that are fired off when our behavioral tracks (programs) select an event to occur. 

## Learn about behavioral programing
- Article:[Behavioral Programming, 2012](https://m-cacm.acm.org/magazines/2012/7/151241-behavioral-programming/fulltext)
- Video: [Rethinking Software Systems: A friendly introduction to Behavioral Programming by Michael Bar Sinai, 2018](https://youtu.be/PW8VdWA0UcA)


## Packages
- @plaited/plait: [implicit state management](https://github.com/plaited/plaited/wiki/Plait)
- @plaited/island: island web app architecture library
- @plaited/utils: reusable utility functions and types used to build user interfaces

