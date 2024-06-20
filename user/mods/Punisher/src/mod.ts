import { DependencyContainer } from "tsyringe";
import { IPreAkiLoadMod } from "@spt-aki/models/external/IPreAkiLoadMod";
import { IPostDBLoadMod } from "@spt-aki/models/external/IPostDBLoadMod";
import { ILogger } from "@spt-aki/models/spt/utils/ILogger";
import { PreAkiModLoader } from "@spt-aki/loaders/PreAkiModLoader";
import { DatabaseServer } from "@spt-aki/servers/DatabaseServer";
import { ImageRouter } from "@spt-aki/routers/ImageRouter";
import { ConfigServer } from "@spt-aki/servers/ConfigServer";
import { ConfigTypes } from "@spt-aki/models/enums/ConfigTypes";
import { ITraderAssort, ITraderBase } from "@spt-aki/models/eft/common/tables/ITrader";
import { ITraderConfig, UpdateTime } from "@spt-aki/models/spt/config/ITraderConfig";
import { IRagfairConfig } from "@spt-aki/models/spt/config/IRagfairConfig";
import { JsonUtil } from "@spt-aki/utils/JsonUtil";
import { IDatabaseTables } from "@spt-aki/models/spt/server/IDatabaseTables";
import * as baseJson from "../db/base.json";
import { Traders } from "@spt-aki/models/enums/Traders";
import * as assortJson from "../db/assort.json";
import * as path from "path";
import { LogTextColor } from "@spt-aki/models/spt/logging/LogTextColor";
import { LogBackgroundColor } from "@spt-aki/models/spt/logging/LogBackgroundColor";

const fs = require('fs');
const modPath = path.normalize(path.join(__dirname, '..'));

class TheMachine implements IPreAkiLoadMod, IPostDBLoadMod {
    private mod = "themachine";
    private logger: ILogger;
    private configServer: ConfigServer;
    private ragfairConfig: IRagfairConfig;

    constructor() {
        this.mod = "themachine";
    }

    public preAkiLoad(container: DependencyContainer): void {
        this.logger = container.resolve<ILogger>("WinstonLogger");
        this.logger.debug(`[${this.mod}] preAki Loading...`);

        const preAkiModLoader = container.resolve<PreAkiModLoader>("PreAkiModLoader");
        const imageRouter = container.resolve<ImageRouter>("ImageRouter");
        this.configServer = container.resolve<ConfigServer>("ConfigServer");

        const traderConfig = this.configServer.getConfig<ITraderConfig>(ConfigTypes.TRADER);
        this.ragfairConfig = this.configServer.getConfig<IRagfairConfig>(ConfigTypes.RAGFAIR);

        this.registerProfileImage(preAkiModLoader, imageRouter);
        this.setupTraderUpdateTime(traderConfig);
        this.addTraderToFleaMarket();

        this.logger.debug(`[${this.mod}] preAki Loaded`);
    }

    public postDBLoad(container: DependencyContainer): void {
        this.logger.debug(`[${this.mod}] postDb Loading...`);

        const databaseServer = container.resolve<DatabaseServer>("DatabaseServer");
        const jsonUtil = container.resolve<JsonUtil>("JsonUtil");
        const tables = databaseServer.getTables();
        const pkg = require("../package.json");

        this.addTraderToDb(baseJson, tables, jsonUtil);
        this.addTraderToLocales(tables);

        this.logger.debug(`[${this.mod}] postDb Loaded`);
        this.logger.logWithColor(`${pkg.name} [LOADED]: Punisher`, LogTextColor.BLUE, LogBackgroundColor.YELLOW);
    }

    private registerProfileImage(preAkiModLoader: PreAkiModLoader, imageRouter: ImageRouter): void {
        const imageFilepath = `./${preAkiModLoader.getModPath(this.mod)}res`;
        imageRouter.addRoute(baseJson.avatar.replace(".jpg", ""), `${imageFilepath}/punisher.jpg`);
    }

    private setupTraderUpdateTime(traderConfig: ITraderConfig): void {
        const traderRefreshRecord: UpdateTime = { traderId: baseJson._id, seconds: { min: 1000, max: 6000 } };
        traderConfig.updateTime.push(traderRefreshRecord);
    }

    private addTraderToFleaMarket(): void {
        this.ragfairConfig.traders[baseJson._id] = true;
        Traders[this.mod] = this.mod;
    }

    private addTraderToDb(traderDetails: any, tables: IDatabaseTables, jsonUtil: JsonUtil): void {
        tables.traders[traderDetails._id] = {
            assort: jsonUtil.deserialize(jsonUtil.serialize(assortJson)) as ITraderAssort,
            base: jsonUtil.deserialize(jsonUtil.serialize(traderDetails)) as ITraderBase,
            questassort: { started: {}, success: {}, fail: {} }
        };
    }

    private addTraderToLocales(tables: IDatabaseTables): void {
        const locales = Object.values(tables.locales.global) as Record<string, string>[];
        locales.forEach(locale => {
            locale[`${baseJson._id} FullName`] = baseJson.name;
            locale[`${baseJson._id} FirstName`] = "themachine";
            locale[`${baseJson._id} Nickname`] = baseJson.nickname;
            locale[`${baseJson._id} Location`] = baseJson.location;
            locale[`${baseJson._id} Description`] = "До конфликта работал наемным киллером, выполняя самые конченные заказы. Тарков стал местом, где можно спрятаться и продолжить свою спокойную жизнь. На сегодняшний день имеет подземное убежище на берегу. Из-за изобилия денежных ресурсов стал выдавать задачи, требующие особые навыки и выдержку. Не очень любит скупщика.";
        });
    }

    public loadFiles(dirPath: string, extName: string[], cb: (filePath: string) => void): void {
        if (!fs.existsSync(dirPath)) return;
        const dir = fs.readdirSync(dirPath, { withFileTypes: true });
        dir.forEach(item => {
            const itemPath = path.normalize(`${dirPath}/${item.name}`);
            if (item.isDirectory()) {
                this.loadFiles(itemPath, extName, cb);
            } else if (extName.includes(path.extname(item.name))) {
                cb(itemPath);
            }
        });
    }
}

module.exports = { mod: new TheMachine() };