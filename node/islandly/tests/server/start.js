"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var _a, e_1, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
var _server_1 = require("$server");
var deps_js_1 = require("../../libs/deps.js");
var set_routes_js_1 = require("./set-routes.js");
var client = "".concat(Deno.cwd(), "/tests/client");
var importMap = (0, deps_js_1.toFileUrl)("".concat(Deno.cwd(), "/.vscode/import-map.json"));
var dev = !Deno.env.has('TEST');
var root = "".concat(Deno.cwd(), "/tests/assets");
var routes = new Map();
var _d = await (0, _server_1.server)({
    reload: dev,
    routes: routes,
    port: 3000,
    root: root,
    middleware: function (handler) { return function (req, ctx) { return __awaiter(void 0, void 0, void 0, function () {
        var res;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, _server_1.getFileHandler)({ assets: root, req: req })];
                case 1:
                    res = _a.sent();
                    if (res) {
                        return [2 /*return*/, res];
                    }
                    return [4 /*yield*/, handler(req, ctx)];
                case 2: return [2 /*return*/, _a.sent()];
            }
        });
    }); }; },
}), close = _d.close, reloadClient = _d.reloadClient, url = _d.url;
var getRoutes = function () {
    return (0, set_routes_js_1.setRoutes)({
        dev: dev,
        routes: routes,
        importMap: importMap,
        client: client,
    });
};
var log = function () { return __awaiter(void 0, void 0, void 0, function () {
    var res, data, tests;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, fetch("".concat(url, "/tests"), { method: 'GET' })];
            case 1:
                res = _a.sent();
                return [4 /*yield*/, res.json()];
            case 2:
                data = _a.sent();
                tests = data.map(function (_a) {
                    var name = _a.name, path = _a.path;
                    return "".concat(name, ": ").concat(url).concat(path);
                });
                console.log(tests);
                return [2 /*return*/];
        }
    });
}); };
await getRoutes();
await log();
// Watch for changes and reload on client on change
if (dev) {
    var watcher = Deno.watchFs(client, { recursive: true });
    try {
        for (var _e = true, watcher_1 = __asyncValues(watcher), watcher_1_1; watcher_1_1 = await watcher_1.next(), _a = watcher_1_1.done, !_a;) {
            _c = watcher_1_1.value;
            _e = false;
            try {
                var kind = _c.kind;
                if (kind === 'modify') {
                    var newRoutes = await getRoutes();
                    for (var _i = 0, _f = newRoutes.entries(); _i < _f.length; _i++) {
                        var _g = _f[_i], path = _g[0], handler = _g[1];
                        routes.set(path, handler);
                    }
                    reloadClient();
                    await log();
                }
            }
            finally {
                _e = true;
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_e && !_a && (_b = watcher_1.return)) await _b.call(watcher_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
}
Deno.addSignalListener('SIGINT', function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, close()];
            case 1:
                _a.sent();
                Deno.exit();
                return [2 /*return*/];
        }
    });
}); });
