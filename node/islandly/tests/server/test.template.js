"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestPageTemplate = void 0;
var _server_1 = require("$server");
var TestPageTemplate = function (_a) {
    var title = _a.title, children = _a.children, tests = _a.tests;
    var reload = !Deno.env.has('TEST') ? _server_1.livereloadTemplate : '';
    return (<html lang='en'>
      <head>
        <meta charset='UTF-8'/>
        <meta http-equiv='X-UA-Compatible' content='IE=edge'/>
        <meta name='viewport' content='width=device-width, initial-scale=1.0'/>
        <title>{title}</title>
        <link rel='icon' href='data:,'/>
      </head>
      <body trusted>
        <h1>
          <a href='' target='_blank'>{title}</a>
        </h1>
        <div id='root'>
          {children}
        </div>
        <script type='module' async trusted>
          await import('{tests}'); await import('/runner.js');
        </script>
        {reload}
      </body>
    </html>);
};
exports.TestPageTemplate = TestPageTemplate;
