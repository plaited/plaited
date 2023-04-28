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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRoutes = void 0;
var bundler_js_1 = require("./bundler.js");
var _server_1 = require("$server");
var _plaited_1 = require("$plaited");
var dev_deps_js_1 = require("../../libs/dev-deps.js");
var deps_js_1 = require("../../libs/deps.js");
var test_template_js_1 = require("./test.template.js");
var setRoutes = function (_a) {
    var dev = _a.dev, importMap = _a.importMap, routes = _a.routes, client = _a.client;
    return __awaiter(void 0, void 0, void 0, function () {
        var entryPoints, exts, _b, _c, _d, entry, path, e_1_1, serverEntries, entries, clientEntries, _loop_1, _i, entries_1, _e, path, file, testEntries;
        var _f, e_1, _g, _h;
        return __generator(this, function (_j) {
            switch (_j.label) {
                case 0:
                    entryPoints = new Set();
                    exts = [
                        '.spec.ts',
                        '.spec.tsx',
                        'registry.ts',
                        '.template.ts',
                        '.template.tsx',
                        'runner.ts',
                        '.worker.ts',
                    ];
                    _j.label = 1;
                case 1:
                    _j.trys.push([1, 6, 7, 12]);
                    _b = true, _c = __asyncValues((0, dev_deps_js_1.walk)(client, {
                        exts: exts,
                    }));
                    _j.label = 2;
                case 2: return [4 /*yield*/, _c.next()];
                case 3:
                    if (!(_d = _j.sent(), _f = _d.done, !_f)) return [3 /*break*/, 5];
                    _h = _d.value;
                    _b = false;
                    try {
                        entry = _h;
                        path = entry.path;
                        entryPoints.add(path);
                    }
                    finally {
                        _b = true;
                    }
                    _j.label = 4;
                case 4: return [3 /*break*/, 2];
                case 5: return [3 /*break*/, 12];
                case 6:
                    e_1_1 = _j.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 12];
                case 7:
                    _j.trys.push([7, , 10, 11]);
                    if (!(!_b && !_f && (_g = _c.return))) return [3 /*break*/, 9];
                    return [4 /*yield*/, _g.call(_c)];
                case 8:
                    _j.sent();
                    _j.label = 9;
                case 9: return [3 /*break*/, 11];
                case 10:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 11: return [7 /*endfinally*/];
                case 12:
                    serverEntries = [];
                    entryPoints.forEach(function (val) {
                        if (val.endsWith('.template.tsx')) {
                            serverEntries.push({ relative: val.replace(client, ''), absolute: val });
                            entryPoints.delete(val);
                        }
                    });
                    return [4 /*yield*/, (0, bundler_js_1.bundler)({
                            dev: dev,
                            entryPoints: __spreadArray([], entryPoints, true),
                            importMap: importMap,
                        })
                        /** an array to hold paths to stor sets */
                    ];
                case 13:
                    entries = _j.sent();
                    clientEntries = [];
                    _loop_1 = function (path, file) {
                        routes.set(path, function () {
                            return new Response((0, deps_js_1.compress)(file), {
                                headers: {
                                    'content-type': (0, _server_1.mimeTypes)('js'),
                                    'content-encoding': 'br',
                                },
                            });
                        });
                        if (exts.some(function (ext) { return path.endsWith(ext.replace(/\.tsx?$/, '.js')); })) {
                            clientEntries.push(path);
                        }
                    };
                    /** create js routes for entries and push entryPoints to clientEntries */
                    for (_i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
                        _e = entries_1[_i], path = _e[0], file = _e[1];
                        _loop_1(path, file);
                    }
                    testEntries = [];
                    return [4 /*yield*/, Promise.all(clientEntries.map(function (entry) { return __awaiter(void 0, void 0, void 0, function () {
                            var url, pathParts, testFile, name_1, dir_1, registry_1, absolute, children_1, modules, mod, Child;
                            var _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        if (!entry.endsWith('.spec.js')) return [3 /*break*/, 3];
                                        url = new URL((0, deps_js_1.toFileUrl)(entry));
                                        pathParts = url.pathname.split('/');
                                        testFile = pathParts.pop();
                                        name_1 = (0, deps_js_1.startCase)(testFile === null || testFile === void 0 ? void 0 : testFile.slice(0, -8));
                                        dir_1 = pathParts.join('/');
                                        /** push path onto testEntries array */
                                        testEntries.push({ path: dir_1, name: name_1 });
                                        registry_1 = clientEntries.find(function (entry) {
                                            return entry.startsWith(dir_1) && entry.endsWith('registry.js');
                                        });
                                        absolute = ((_a = serverEntries.find(function (_a) {
                                            var relative = _a.relative;
                                            return relative.startsWith(dir_1) &&
                                                relative.endsWith('template.tsx');
                                        })) !== null && _a !== void 0 ? _a : {}).absolute;
                                        children_1 = [];
                                        if (!absolute) return [3 /*break*/, 2];
                                        return [4 /*yield*/, Promise.resolve("".concat(absolute)).then(function (s) { return require(s); })];
                                    case 1:
                                        modules = _b.sent();
                                        for (mod in modules) {
                                            Child = modules[mod];
                                            children_1.push(<Child />);
                                        }
                                        _b.label = 2;
                                    case 2:
                                        routes.set(dir_1, function () {
                                            return new Response((0, _plaited_1.ssr)(<test_template_js_1.TestPageTemplate title={name_1} registry={registry_1} children={children_1} tests={entry}/>), {
                                                headers: { 'Content-Type': 'text/html' },
                                            });
                                        });
                                        _b.label = 3;
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); }))
                        /** Set route to get stories */
                    ];
                case 14:
                    _j.sent();
                    /** Set route to get stories */
                    routes.set("GET@/tests", function () {
                        return new Response(JSON.stringify(testEntries), {
                            status: 200,
                            headers: {
                                'content-type': 'application/json',
                            },
                        });
                    });
                    return [2 /*return*/, routes];
            }
        });
    });
};
exports.setRoutes = setRoutes;
