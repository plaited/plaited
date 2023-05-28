---
author: Rachel Aliana
date: Feb 3, 2020
source: https://rachelaliana.medium.com/past-the-internet-the-emergence-of-the-modnet-6ad49b7e2ee8

---

# Past the Internet: The Emergence of the Modnet

![](images/1*vS8OUYb9y5T95LzZgOCd-A.png)

_This content is released under a Creative Commons Attributions license. Feel free to use these ideas, but please attribute._

Current online systems are constructed from the top down. Developers and designers craft and build websites which people then use. This structure gives companies power in two ways. One way is from the aggregation of user data that enables companies to more effectively market to users. The second is from the “lock-in” effect where users become increasingly tied to platforms because they have invested time and energy adding their content to them.

People have little bargaining power against these companies because they do not control their data and would lose their work if they left these platforms. This inequitable dynamic of data ownership and transference is a subtle dynamic of the global economy that has contributed to worldwide inequality.

There is a new way to architect the internet. Websites do not need to be formed from front-ends that people interact with and back-ends that companies own. Instead it is possible to create discrete  **modules**  composed of front and back-end where individuals own their own data that is separate from any one platform. These interoperable modules can be used simultaneously on many websites and can more easily transfer data across websites. They can be connected together to form modular networks, or  **modnets.**

The way information is structured in the digital world has far-reaching repercussions for social dynamics in the physical world. To give people both ownership over their data in a way that is transferable across networks and increase the ability for non-technical people to be able to create crowd-sourced networks can create a more equitable and collectively built world.

This, I believe, is the future after the internet.

## Current Structures

Traditional companies store user data within databases hosted on private servers. A user takes an action on the front-end that generates a query. Queries are sent from a user’s computer to a company’s API.  **Application Programming Interfaces**  (APIs), or APIs, serve as a bridge between the company’s databases and a user’s computer. When the information is retrieved, it is then sent back to a user’s computer where it is rendered as a cohesive web page to the individual user.

![](images/1*Ue6klcyH8F_xGH_Gu3r8zQ.png)

Information flows in a traditional website from front-end to API to database and back again.

Decentralized apps, also termed  **DApps**, instead store data on peer-to-peer networks. A web page on a Decentralized Application looks like a traditional web page, but when a person generates a query it is processed through a wallet. This wallet turns users’ requests for data into smart contracts. Several smart contracts are packaged together and added to a long list of all the transactions that together form the activity of a peer-to-peer network. Instead of one server that holds on to all of a person’s data, it is dozens or hundreds of individual servers. A blockchain or other distributed ledger technology is usually utilized with this construction to make sure no individual can alter another person’s information on the network.

![](images/1*qwsUFcyY9mO2hDaUq_DlOg.png)

Structure of Decentralized Applications shows links between interface, Wallet, and blockchain.

DApps partially solve part of the problem of corporate control of user data by decentralizing the databases that stores individuals’ data. But even though user data is no longer in the hands of corporations, once user data is posted to a network, it is no longer fully controlled by an individual and is still not transferable across networks.

## Modular Structure

We need to move past DApps towards an architecture of  **individual control**  of data that is  **transportable** across networks. This is the promise of modules.

A  **module**  can contain any set of code inside of it. But it also contains  **bridge-code** that helps distinct modules interact with each other. Each module needs five different tags to enable its code to work with other modules: content type, structure, mechanics, boundary, and scale.

**Content type**  identifies the use case for the modules. Is this a module that is meant to be for a person to upload their art, to keep track of their daily step allotment, a farmer to input their produce? Modules with the same content types can be manipulated together in the same way that similar classes in CSS can be manipulated. For example, a person can set all  _#produce_ modules into a list, or can gather all  _#art_  modules together into a portfolio.

**Structure** refers to a set of shared identifiers for the structure of the module.  [A Unified Design Language](a-unified-language-for-the-design-of-information-systems.md)  lays out the first words of a lexicon for structures of digital systems. There are small-scale structures of modules, blocks, and object-groups, as well as larger platform-wide structures such as matrices and Daisy architectures. Similarly to how all modules of a certain content type can be manipulated, a person can also manipulate all modules of a certain structure simultaneously.

**Mechanics** are cross-cutting dynamics of websites that impact user interaction. Upvote or downvote, karma, Likes, Follows, are all examples of ways to influence the user to do a certain action. Modules can contain Mechanic tags that identify whether certain mechanics can auto-populate into their interface when certain requirements are met. For example, an artist’s portfolio module on its own does not need an upvote or downvote mechanic, but if they connect their portfolio module to an exhibition platform, if their portfolio module is tagged with a m_ec.vote_ variable, their module will automatically include an upvote and downvote mechanic when connected to a structure that utilizes upvote and downvote metrics.

**Boundary** identifies what information can be shared with other modules. Some simple variables here are  **all**,  **none**, or  **ask**. If tagged with  **all,**  all information that a person places into a module can be shared with other modules.  **None**  means that no information entered into a specific module will be shared with other modules.  **Ask**  will mean that users will be asked if a network they connect to wants to use their data.

**Scale** identifies how this module should interact with other modules. Modules are designed to be nested within each other. Scale can tell different modules how to nest within each other. Scale 1 is the smallest, and goes up. A module at Scale 3 would be nested into a module that is Scale 8. People can also put a Relative Scale variable, denoted by  **scale.rel**  to signify that scale does not matter. Anywhere where a module’s type is similar it will go there.

Together these basic rules form the  [**Modnet Structural Standard**](modnet-design-standards.md) **(MSS).** These standards will form the basis of a computer language that still needs to be developed. Above is a first look at how these modules might be architected; this is the first step in a much larger conversation.

Below is a schematic of a general module.

![](images/1*3Dr_KxdFU407KTCaFqJLow.png)

Standard design structure of a module including Content, Structure, Boundary, Mechanic, and Scale.

## User-Centered Construction

Modules are very simple patterns where people can upload content. Module examples include Portfolios, Articles, Lists, and Presentation templates. People can download these simple modules from a crowd-sourced repository of patterns that it is assumed everyone will want to use. Anyone can also design their own modules to upload to this repository if they meet the design standards and include a unique content type identifier.

When a person downloads a module template they can begin adding their content to it. This data is stored either locally on their phones or on a private server.

![](images/1*bTaJGkTM4gPN48qE2uN4Og.png)

Basic Module Patterns

These modules can be connected to larger platform structures. When an individual updates information on their modules, their data is automatically updated on all of the networks that their module is connected to. The diagram below shows how one module that an individual owns can be linked to several different networks.

![](images/1*vS8OUYb9y5T95LzZgOCd-A.png)

For example, lets say a person created a presentation. They want to link this presentation to their own database of class projects. They can also link to a collaboration network of presentations from all of the students in their class. Simultaneously, they can link their presentation module to a platform for job seekers and another platform for showcasing high-quality presentations.

Any platform that accepts the scale and content type of the person’s module, they can plug their content into. The magic happens when a person wants to update their presentation. Instead of needing to edit their presentation on their computer, and then upload a new version to each platform where they initially put their work, they can edit their work and then it is altered on every network that their module is linked to. If people want to delete their work from a platform, they do not need to go to that network and delete their work. They can simply go to their module and delete the link between their module and the website.

If a website goes down or a company shuts down, a person does not lose all of the work that they did on this website. All of a sudden, the demise of a single company does not mean the disappearance of the knowledge and work that people have done on these plaforms. Few people think about how the lack of interoperability of content across websites has resulted in the loss both purely of information and the potential connections between disparate sets of knowledge. A more interoperable world is one where human knowledge is better preserved and connected.

The next two sections looks at the impact of modules on large-scale collaborations and physical spaces.

## Crowd-Sourced Networks

Modular networks can enable communities of citizen-scientists to come together easier across the world by connecting individual modules to larger platform structures. Just like there would be a central repository of individual modules, there would need to be a central repository of larger blocks designed to be interoperable with individual modules. Below are a few examples of larger network structures.

These structures that modules can be plugged into can change the way science is done. Right now, if a researcher wants to conduct a study on people’s health habits, they would need to write a grant, find participants, and track their habits for years.

With modules, a person might have a health metric module that they can share with their doctor. This module if people want can be also connected to a platform structure that tracks health metrics over time. With this model, scientists can use data that people already input  _in the past_ and they do not need to worry about re-finding these people to track their data in the future.

Another use case is connecting disparate discussions and moving discussion to action. Right now journalism and scientific studies on the topic of ocean patterns are spread across hundreds of different journals. A general research pattern that can connect all of this information in one place can help unite research to help global problems. There might not be the money or the capacity to create a special website for these kinds of discussions. With platform structures, there does not need to be a coordinating body.

![](images/1*akKfq4BVKv9sO9YudL2-XQ.png)

Larger Modnet structures

The front-end of websites in this scenario would be less of a cohesive whole that data is plugged into, and more a set of interlinked different pages. The diagram below shows three different people who each have their own modules. When they connect their modules to a block, it auto-populates their data where the block pattern indicates modules that are structure type list.

![](images/1*0fys8B42V34nZEeGoJzDuA.png)

Individual modules nested into crowd-sourced blocks is the basic idea of  **modular networks,** or  **Modnets.**  Modnets can allow communities to collaborate faster without the need for data to ever be aggregated by large tech firms. With this construction, value is captured at a smaller scale and lasts only as long as people decide to keep their modules connected to a network.

Instead of being a music artist that puts a song on a network and then hopes that they are paid, musicians can run smaller music blocks that people can connect to. The same with stories, or news journalism. All of a sudden, interoperable modules make it so that people can better bargain with larger tech firms because now there are crowd-sourced alternatives. These patterns are likely to be highly general and so potentially not tailored to highly specific community needs. However, for 80% of communities, from neighborhoods, to research, to music sharing, having a general crowd-sourced alternative is good enough.

## Ephemeral Networks

Modnets also have the capability to change how people interact in physical spaces. In today’s world tech companies can track people’s individual locations in a way that is highly intrusive. In a world where it is easy to be tracked and followed, technology is used as a retreat. Modnets can enable ephemeral physical networks in a way that is not as intrusive as today’s networks because the networks only last as long as people stay connected and that specific platform continues running.

To understand how this can be used, a person can run a Meeting Place block that people can connect their reading list blocks to that are within the radius of a specific wifi or Bluetooth network. When a person steps away from the plaza or courtyard that is outside of the network’s range, their data disappears entirely from the platform.

![](images/1*oKpToeMQzKkZ6NdoIAhgbw.png)

A module designed to help people meet.

Remember, this reading list follows an individual. With this set-up, if a person’s module is set to public, as a person walks their content can be connected to dozens of ephemeral communities. That same reading list module that a person used to meet people in the park can be connected to a library as they go inside.

![](images/1*HnozFedaNa4_ajv0T3Av0g.png)

Library module pattern.

While it may not seem like a lot of effort to re-type your top few books that you are reading, it might feel like effort to do so at every coffee shop and library you step foot into. By having this data already packaged into modules, it lowers the barrier for people to engage with each other in physical spaces.

This same idea for books can also happen for art. A Parks and Rec department can host an exhibition platform. As you walk through a park there might be digital screens that display the art of anyone who connects their modules. The department does not need to spend months developing a website and marketing it. On the other side of the equation, artists do not need to spend hours uploading their work onto the department’s website.

![](images/1*zzcJsmCbiULYCLACs9_wHA.png)

Portfolio of Claire Scherzinger:  [https://www.format.com/magazine/galleries/art/art-portfolio-website-examples-painters](https://www.format.com/magazine/galleries/art/art-portfolio-website-examples-painters)

Artists can immediately see their work showcased, as top-voted exhibits are showcased either digital screens or a projector. This ability for public departments to be able to create these rich cultural experiences in a way that is cheaper and demands less organizational capacity can have immensely positive impacts on the ability for government to provide high quality services. On the other end, the ability for people to immediately see their work impacting the world around them can help people immediately get feedback and feel impactful. This is a world that is more co-created and everyone feels like they have a hand in building it….because they do.

![](images/1*fcu7mfY4xZ0-lf0EmMHEiQ.jpeg)

Art exhibition in the park:  [https://www.visitljubljana.com/en/visitors/events/art-nouveau-architecture-in-slovenia/](https://www.visitljubljana.com/en/visitors/events/art-nouveau-architecture-in-slovenia/)

## Why A New Web is Needed

There are lots of reasons for the rise in inequality in America and across the world. One of the subtle reasons for this increase in inequality is the agglomeration of the additive value of data in highly centralized networks.

The internet has made it possible for large companies to obtain even more customers as acquisition can come with the click of a button rather than demanding a brick and mortar store. There is also less of a need for bank tellers,  [post office employees and travel agents](https://www.theatlantic.com/business/archive/2014/01/the-internet-is-the-greatest-legal-facilitator-of-inequality-in-human-history/283422/)  as processes can be automated.

For those left in these companies, the greater efficiencies gained can be better captured by those in the C-Suite. The result is that there are heightened inequities of monetary distribution within firms.

![](images/1*8xhXslzO3X1HV6BW3IhHxA.png)

Technology creates lop-sided value capture.

The ability for people to better keep the content and data they produce and create crowd-sourced collaborations offers an alternative to the current construction of traditional organizations.

The tools that we use to build the world have a deep impact on the world created. Our current information systems are architected in a way that enables broad reach, but also inequity.

While many see the Internet as a stable infrastructure, I think we are actually only seeing the Internet in Stage II on the technological growth curve. In Stage I of computer development, only specialists knew how to code, and computers were large and expensive. In Stage II, while millions of people are connected to the internet, only 3–5% of the population in highly developed nations are at involved in the design of the internet.

Stage III will emerge when normal people have the ability to create web structures with the ease of a child building Lego towers. This scenario will bring with it greater equity as communities can create the architecture they use and value from aggregate data can be better captured at the local and regional levels.

To read more about the structure of individual modules and the standards by which networks are built, visit  [here.](modnet-design-standards.md)  To read more about how modnets can be created using emergent design techniques, visit  [here.](living-digital-networks-the-new-field-of-emergent-network-design.md)  To join in on building the architecture of the future world, please join the  [slack channel](https://join.slack.com/t/futureofinfor-aq52459/shared_invite/enQtOTgwMDgyNTk1NjA3LTQzNWEwMzAxNzU4YTA0ZjM5NzE1YTViY2QyMmM5MWY0NDkxNmNhZDY0NjMyZjRmM2RiOWJlZDg0ZDc2NTg1YjQ).
