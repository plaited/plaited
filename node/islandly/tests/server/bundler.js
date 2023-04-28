"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.bundler = void 0;
var dev_deps_js_1 = require("../../libs/dev-deps.js");
var deps_js_1 = require("../../libs/deps.js");
var bundler = function (_a) {
    var dev = _a.dev, entryPoints = _a.entryPoints, importMap = _a.importMap;
    return __awaiter(void 0, void 0, void 0, function () {
        var minifyOptions, map, bundle;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    minifyOptions = dev
                        ? { minifyIdentifiers: false, minifySyntax: true, minifyWhitespace: true }
                        : { minify: true };
                    map = new Map();
                    bundle = function () { return __awaiter(void 0, void 0, void 0, function () {
                        var absWorkingDir, outputFiles, absDirUrlLength, _i, outputFiles_1, file;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    absWorkingDir = Deno.cwd();
                                    return [4 /*yield*/, (0, dev_deps_js_1.build)(__assign(__assign({ absWorkingDir: absWorkingDir, allowOverwrite: true, bundle: true, format: 'esm', outdir: '.', outfile: '', entryPoints: entryPoints, metafile: true }, minifyOptions), { platform: 'neutral', 
                                            //@ts-ignore: forcing use with newer esbuild
                                            plugins: [(0, dev_deps_js_1.denoPlugin)({ importMapURL: importMap })], sourcemap: dev ? 'linked' : false, splitting: true, target: [
                                                'chrome109',
                                                'firefox109',
                                                'safari16',
                                            ], treeShaking: true, write: false, jsx: 'automatic', jsxImportSource: '$plaited' }))];
                                case 1:
                                    outputFiles = (_a.sent()).outputFiles;
                                    absDirUrlLength = (0, deps_js_1.toFileUrl)(absWorkingDir).href.length;
                                    if (outputFiles) {
                                        for (_i = 0, outputFiles_1 = outputFiles; _i < outputFiles_1.length; _i++) {
                                            file = outputFiles_1[_i];
                                            map.set((0, deps_js_1.toFileUrl)(file.path).href.substring(absDirUrlLength), file.contents);
                                        }
                                    }
                                    (0, dev_deps_js_1.stop)();
                                    return [2 /*return*/];
                            }
                        });
                    }); };
                    return [4 /*yield*/, bundle()];
                case 1:
                    _b.sent();
                    return [2 /*return*/, __spreadArray([], map, true)];
            }
        });
    });
};
exports.bundler = bundler;
