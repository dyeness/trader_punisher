"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const ConfigTypes_1 = require("C:/snapshot/project/obj/models/enums/ConfigTypes");
const baseJson = __importStar(require("../db/base.json"));
const Traders_1 = require("C:/snapshot/project/obj/models/enums/Traders");
const assortJson = __importStar(require("../db/assort.json"));
const path = __importStar(require("path"));
const LogTextColor_1 = require("C:/snapshot/project/obj/models/spt/logging/LogTextColor");
const LogBackgroundColor_1 = require("C:/snapshot/project/obj/models/spt/logging/LogBackgroundColor");
const fs = require('fs');
const modPath = path.normalize(path.join(__dirname, '..'));
class TheMachine {
    mod = "themachine";
    logger;
    configServer;
    ragfairConfig;
    constructor() {
        this.mod = "themachine";
    }
    preAkiLoad(container) {
        this.logger = container.resolve("WinstonLogger");
        this.logger.debug(`[${this.mod}] preAki Loading...`);
        const preAkiModLoader = container.resolve("PreAkiModLoader");
        const imageRouter = container.resolve("ImageRouter");
        this.configServer = container.resolve("ConfigServer");
        const traderConfig = this.configServer.getConfig(ConfigTypes_1.ConfigTypes.TRADER);
        this.ragfairConfig = this.configServer.getConfig(ConfigTypes_1.ConfigTypes.RAGFAIR);
        this.registerProfileImage(preAkiModLoader, imageRouter);
        this.setupTraderUpdateTime(traderConfig);
        this.addTraderToFleaMarket();
        this.logger.debug(`[${this.mod}] preAki Loaded`);
    }
    postDBLoad(container) {
        this.logger.debug(`[${this.mod}] postDb Loading...`);
        const databaseServer = container.resolve("DatabaseServer");
        const jsonUtil = container.resolve("JsonUtil");
        const tables = databaseServer.getTables();
        const pkg = require("../package.json");
        this.addTraderToDb(baseJson, tables, jsonUtil);
        this.addTraderToLocales(tables);
        this.logger.debug(`[${this.mod}] postDb Loaded`);
        this.logger.logWithColor(`${pkg.name} [LOADED]: Punisher`, LogTextColor_1.LogTextColor.BLUE, LogBackgroundColor_1.LogBackgroundColor.YELLOW);
    }
    registerProfileImage(preAkiModLoader, imageRouter) {
        const imageFilepath = `./${preAkiModLoader.getModPath(this.mod)}res`;
        imageRouter.addRoute(baseJson.avatar.replace(".jpg", ""), `${imageFilepath}/themachine.jpg`);
    }
    setupTraderUpdateTime(traderConfig) {
        const traderRefreshRecord = { traderId: baseJson._id, seconds: { min: 1000, max: 6000 } };
        traderConfig.updateTime.push(traderRefreshRecord);
    }
    addTraderToFleaMarket() {
        this.ragfairConfig.traders[baseJson._id] = true;
        Traders_1.Traders[this.mod] = this.mod;
    }
    addTraderToDb(traderDetails, tables, jsonUtil) {
        tables.traders[traderDetails._id] = {
            assort: jsonUtil.deserialize(jsonUtil.serialize(assortJson)),
            base: jsonUtil.deserialize(jsonUtil.serialize(traderDetails)),
            questassort: { started: {}, success: {}, fail: {} }
        };
    }
    addTraderToLocales(tables) {
        const locales = Object.values(tables.locales.global);
        locales.forEach(locale => {
            locale[`${baseJson._id} FullName`] = baseJson.name;
            locale[`${baseJson._id} FirstName`] = "themachine";
            locale[`${baseJson._id} Nickname`] = baseJson.nickname;
            locale[`${baseJson._id} Location`] = baseJson.location;
            locale[`${baseJson._id} Description`] = "До конфликта работал наемным киллером, выполняя самые конченные заказы. Тарков стал местом, где можно спрятаться и продолжить свою спокойную жизнь. На сегодняшний день имеет подземное убежище на берегу. Из-за изобилия денежных ресурсов стал выдавать задачи, требующие особые навыки и выдержку. Не очень любит скупщика.";
        });
    }
    loadFiles(dirPath, extName, cb) {
        if (!fs.existsSync(dirPath))
            return;
        const dir = fs.readdirSync(dirPath, { withFileTypes: true });
        dir.forEach(item => {
            const itemPath = path.normalize(`${dirPath}/${item.name}`);
            if (item.isDirectory()) {
                this.loadFiles(itemPath, extName, cb);
            }
            else if (extName.includes(path.extname(item.name))) {
                cb(itemPath);
            }
        });
    }
}
module.exports = { mod: new TheMachine() };
//# sourceMappingURL=mod.js.map