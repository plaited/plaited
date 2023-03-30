import { html } from '$plaited'
// import { Benchmark } from './benchmark.island.ts'

export const LitBenchmarkTemplate = html`
<lit-benchmark-island>
  <template shadowrootmode="open" shadowrootdelegatesfocus>
    <link href="/css/currentStyle.css" rel="stylesheet" />
  <div class="container"> 
  <div class="jumbotron">
    <div class="row">
      <div class="col-md-6">
        <h1>lit templat</h1>
      </div>
      <div class="col-md-6">
        <div class="row">
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary btn-block" id="run" data-trigger="click->run">Create 1,000
              rows</button>
          </div>
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary btn-block" id="runlots"
              data-trigger="click->runLots">Create 10,000
              rows</button>
          </div>
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary
                        btn-block" id="add" data-trigger="click->add">Append 1,000 rows</button>
          </div>
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary
                        btn-block" id="update" data-trigger="click->update">Update every 10th row</button>
          </div>
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary
                        btn-block" id="clear" data-trigger="click->clear">Clear</button>
          </div>
          <div class="col-sm-6 smallpad">
            <button type="button" class="btn btn-primary
                        btn-block" id="swaprows" data-trigger="click->swapRows">Swap Rows</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <table class="table table-hover table-striped test-data">
    <tbody data-trigger="click->interact" data-target="tbody"></tbody>
  </table>
  </div>
  </template>
</lit-benchmark-island>
  `