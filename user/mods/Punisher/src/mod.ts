import { DependencyContainer } from "tsyringe";

// SPT types
import { IPreSptLoadMod } from "@spt/models/external/IPreSptLoadMod";
import { IPostDBLoadMod } from "@spt/models/external/IPostDBLoadMod";
import { ILogger } from "@spt/models/spt/utils/ILogger";
import { PreSptModLoader } from "@spt/loaders/PreSptModLoader";
import { DatabaseServer } from "@spt/servers/DatabaseServer";
import { ImageRouter } from "@spt/routers/ImageRouter";
import { ConfigServer } from "@spt/servers/ConfigServer";
import { ConfigTypes } from "@spt/models/enums/ConfigTypes";
import { IRagfairConfig } from "@spt/models/spt/config/IRagfairConfig";
import { JsonUtil } from "@spt/utils/JsonUtil";
import { Traders } from "@spt/models/enums/Traders";
import { ImporterUtil } from "@spt/utils/ImporterUtil";
import { Money } from "@spt/models/enums/Money";
import { IDatabaseTables } from "@spt/models/spt/server/IDatabaseTables";
import { ITraderBase, ITraderAssort } from "@spt/models/eft/common/tables/ITrader";
import { ITraderConfig, UpdateTime } from "@spt/models/spt/config/ITraderConfig";
import { Item } from "@spt/models/eft/common/tables/IItem";

//import custom JSON Files
//import * as WeaponPreset from "../db/presets.json";

// New trader settings
import baseJson = require("../db/base.json");


class Punisher implements IPreSptLoadMod, IPostDBLoadMod 
{
    private mod: string
    private logger: ILogger
    //private configServer: ConfigServer;
    //private ragfairConfig: IRagfairConfig; 

    constructor() {
        this.mod = "Punisher"; // Set name of mod so we can log it to console later
    }

    /**
     * Some work needs to be done prior to SPT code being loaded, registering the profile image + setting trader update time inside the trader config json
     * @param container Dependency container
     */
    public preSptLoad(container: DependencyContainer): void 
    {
        //Get a Logger
        this.logger = container.resolve<ILogger>("WinstonLogger");
        this.logger.debug(`[${this.mod}] preSpt Loading... `);

        //Get SPT Code
        const preSptModLoader: PreSptModLoader = container.resolve<PreSptModLoader>("PreSptModLoader");
        const imageRouter: ImageRouter = container.resolve<ImageRouter>("ImageRouter");
        const configServer = container.resolve<ConfigServer>("ConfigServer");
        const traderConfig: ITraderConfig = configServer.getConfig<ITraderConfig>(ConfigTypes.TRADER);
        const ragfairConfig = configServer.getConfig<IRagfairConfig>(ConfigTypes.RAGFAIR);

        //Custom Logger, Don't worry it's fake bullshit for flair
        this.logger.info("Punisher: ACTIVATED");
        
        //Meta crap i guess
        this.registerProfileImage(preSptModLoader, imageRouter);
        this.setTraderUpdateTime(traderConfig, baseJson, 3600, 4000);
        
        this.logger.debug(`[${this.mod}] preSpt Loaded`);

        // Add trader to trader enum
        Traders[baseJson._id] = baseJson._id;
        // Add trader to flea market
        ragfairConfig.traders[baseJson._id] = false; //! Добавить

    }

    /**
     * Majority of trader-related work occurs after the aki database has been loaded but prior to SPT code being run
     * @param container Dependency container
     */
    public postDBLoad(container: DependencyContainer): void {
        this.logger.debug(`[${this.mod}] postDb Loading... `);

        // Resolve SPT classes we'll use
        const databaseServer: DatabaseServer = container.resolve<DatabaseServer>("DatabaseServer");
        const jsonUtil: JsonUtil = container.resolve<JsonUtil>("JsonUtil");

        // Get a reference to the database tables
        const tables = databaseServer.getTables();

        // Add new trader to the trader dictionary in DatabaseServer
        this.addTraderToDb(baseJson, tables, jsonUtil);
        this.addTraderToLocales(tables, baseJson.name, "Каратель", baseJson.nickname, baseJson.location, "До конфликта работал наемным киллером, выполняя самые конченные заказы. Тарков стал местом, где можно спрятаться и продолжить свою спокойную жизнь. На сегодняшний день имеет подземное убежище на берегу. Из-за изобилия денежных ресурсов стал выдавать задачи, требующие особые навыки и выдержку. Не очень любит скупщика.");

        this.logger.debug(`[${this.mod}] postDb Loaded`);

    }

    /**
     * Add profile picture to our trader
     * @param preSptModLoader mod loader class - used to get the mods file path
     * @param imageRouter image router class - used to register the trader image path so we see their image on trader page
     */
    private registerProfileImage(preSptModLoader: PreSptModLoader, imageRouter: ImageRouter): void
    {
        // Reference the mod "res" folder
        const imageFilepath = `./${preSptModLoader.getModPath(this.mod)}res`;

        // Register a route to point to the profile picture
        imageRouter.addRoute(baseJson.avatar.replace(".jpg", ""), `${imageFilepath}/67b0e495292db8850f2b2b67.jpg`);
    }

    /**
     * Add record to trader config to set the refresh time of trader in seconds (default is 60 minutes)
     * @param traderConfig trader config to add our trader to
     * @param baseJson json file for trader (db/base.json)
     * @param refreshTimeSecondsMin How many seconds between trader stock refresh min time
     * @param refreshTimeSecondsMax How many seconds between trader stock refresh max time
     */
    public setTraderUpdateTime(traderConfig: ITraderConfig, baseJson: any, refreshTimeSecondsMin: number, refreshTimeSecondsMax: number): void
    {
        // Add refresh time in seconds to config
        const traderRefreshRecord: UpdateTime = {
            traderId: baseJson._id,
            seconds: {
                min: refreshTimeSecondsMin,
                max: refreshTimeSecondsMax,
            },
        };

        traderConfig.updateTime.push(traderRefreshRecord);
    }

    /**
     * Add our new trader to the database
     * @param traderDetailsToAdd trader details
     * @param tables database
     * @param jsonUtil json utility class
     */
    
    // rome-ignore lint/suspicious/noExplicitAny: traderDetailsToAdd comes from base.json, so no type
    private addTraderToDb(traderDetailsToAdd: any, tables: IDatabaseTables, jsonUtil: JsonUtil): void
    {
        // Add trader to trader table, key is the traders id
        tables.traders[traderDetailsToAdd._id] = {
            assort: this.createAssortTable(tables, jsonUtil), // assorts are the 'offers' trader sells, can be a single item (e.g. carton of milk) or multiple items as a collection (e.g. a gun)
            base: jsonUtil.deserialize(jsonUtil.serialize(traderDetailsToAdd)) as ITraderBase,
            questassort: {
                started: {},
                success: {},
                fail: {}
            } // Empty object as trader has no assorts unlocked by quests
        };
    }

    /**
     * Create assorts for trader and add milk and a gun to it
     * @returns ITraderAssort
     */
    private createAssortTable(tables: IDatabaseTables, jsonUtil: JsonUtil): ITraderAssort
    {
        // Create a blank assort object, ready to have items added
        const assortTable: ITraderAssort = {
            nextResupply: 0,
            items: [
                //? ===========================AMMO===========================
                {
                    "_id": "67b0eb8beaed4c93b7e20619",
                    "_tpl": "618a431df1eb8e24b8741deb",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 15
                    }
                },
                {
                    "_id": "67b0ec79de78ad5768e43f94",
                    "_tpl": "61962b617c6c7b169525f168",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 99999
                    }
                },
                {
                    "_id": "67b0d7cf33f19aafa59b67ef",
                    "_tpl": "5f0c892565703e5c461894e9", 
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 10
                    }
                },
                {
                    "_id": "67b0d7e37f33f30f091e3c4c",
                    "_tpl": "5c0d5e4486f77478390952fe",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 99999
                    }
                },
                {
                    "_id": "67b0d7ed486dd1971322bda7",
                    "_tpl": "5a6086ea4f39f99cd479502f",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 99999
                    }
                },
                {
                    "_id": "67b0d8028a5b012868fbdd32", 
                    "_tpl": "601aa3d2b2bcb34913271e6d",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 99999
                    }
                },
                {
                    "_id": "67b0d80f23d34bc138ca6331", 
                    "_tpl": "5efb0c1bd79ff02a1f5e68d9",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 60
                    }
                },
                {
                    "_id": "67b0d81b9b788721b0921fb2", 
                    "_tpl": "5e023d48186a883be655e551",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 240
                    }
                },
                {
                    "_id": "67b0d82535fef9417accd915", 
                    "_tpl": "5fc382a9d724d907e2077dab",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 240
                    }
                },
                //? ==========================ARMOR===========================
                {
                    "_id": "67b0d83590986e6f1487c02d",
                    "_tpl": "5e9db13186f7742f845ee9d3",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 3
                    }
                },
                {
                    "_id": "67b0d87638187b38b06e795c",
                    "_tpl": "5df8a4d786f77412672a1e3b",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 3
                    }
                },
                {
                    "_id": "67b0d884e79303fdd740f2a5",
                    "_tpl": "5a154d5cfcdbcb001a3b00da",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 3
                    }
                },
                {
                  "_id": "67b0ecd8eb71e7f869895bb1",
                  "_tpl": "657f8ec5f4c82973640b234c",
                  "parentId": "67b0d884e79303fdd740f2a5",
                  "slotId": "Helmet_top"
                },
                {
                  "_id": "67b0ecda174bec2cf194308f",
                  "_tpl": "657f8f10f4c82973640b2350",
                  "parentId": "67b0d884e79303fdd740f2a5",
                  "slotId": "Helmet_back"
                },
                {
                  "_id": "67b0ecdc7e37261ef989ba37",
                  "_tpl": "5a16b7e1fcdbcb00165aa6c9",
                  "parentId": "67b0d884e79303fdd740f2a5",
                  "slotId": "mod_equipment_000"
                },
                { // *Plates
                    "_id": "67b0d8f56f25d7662a9f1465",
                    "_tpl": "5e4abb5086f77406975c9342", // 6575e71760703324250610c3 , 6575e72660703324250610c7
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 9999999,
                        "BuyRestrictionMax": 1,
                        "BuyRestrictionCurrent": 0
                    }
                },
                {
                    "_id": "67b0ed4bb28ddae85e3d6644",
                    "_tpl": "6575e71760703324250610c3",
                    "parentId": "67b0d8f56f25d7662a9f1465",
                    "slotId": "Soft_armor_front"
                  },
                  {
                    "_id": "67b0ed4914ec853aa4dd1017",
                    "_tpl": "6575e72660703324250610c7",
                    "parentId": "67b0d8f56f25d7662a9f1465",
                    "slotId": "Soft_armor_back"
                  },
                  {
                    "_id": "67b0ed460d10f8a0620bd404",
                    "_tpl": "656fafe3498d1b7e3e071da4",
                    "parentId": "67b0d8f56f25d7662a9f1465",
                    "slotId": "Front_plate"
                  },
                  {
                    "_id": "67b0ed44b3d1fda43b31b014",
                    "_tpl": "656fafe3498d1b7e3e071da4",
                    "parentId": "67b0d8f56f25d7662a9f1465",
                    "slotId": "Back_plate"
                  },
                { // *Plates
                    "_id": "67b0d9e835826a6cc64565b6",
                    "_tpl": "6038b4ca92ec1c3103795a0d",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 9999999,
                        "BuyRestrictionMax": 1,
                        "BuyRestrictionCurrent": 0
                    }
                },
                {
                    "_id": "67b0ed3bd31255d62794688b",
                    "_tpl": "6575e71760703324250610c3",
                    "parentId": "67b0d9e835826a6cc64565b6",
                    "slotId": "Soft_armor_front"
                  },
                  {
                    "_id": "67b0ed3cb4055abf865a90ef",
                    "_tpl": "6575e72660703324250610c7",
                    "parentId": "67b0d9e835826a6cc64565b6",
                    "slotId": "Soft_armor_back"
                  },
                  {
                    "_id": "67b0ed3effc223e63c4e3d3f",
                    "_tpl": "656fafe3498d1b7e3e071da4",
                    "parentId": "67b0d9e835826a6cc64565b6",
                    "slotId": "Front_plate"
                  },
                  {
                    "_id": "67b0ed3fb06ae816508299c4",
                    "_tpl": "656fb0bd7c2d57afe200c0dc",
                    "parentId": "67b0d9e835826a6cc64565b6",
                    "slotId": "Back_plate"
                  },
                { // *Plates
                    "_id": "67b0ed271450ee8575f127e7",
                    "_tpl": "6038b4b292ec1c3103795a0b",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 9999999,
                        "BuyRestrictionMax": 1,
                        "BuyRestrictionCurrent": 0
                    }
                },
                {
                    "_id": "67b0ed2db2d4d1f222d3ab2c",
                    "_tpl": "6575e71760703324250610c3",
                    "parentId": "67b0ed271450ee8575f127e7",
                    "slotId": "Soft_armor_front"
                  },
                  {
                    "_id": "67b0ed307714168d5d3a9afd",
                    "_tpl": "6575e72660703324250610c7",
                    "parentId": "67b0ed271450ee8575f127e7",
                    "slotId": "Soft_armor_back"
                  },
                  {
                    "_id": "67b0ed32851fc3f9bb86ed8c",
                    "_tpl": "656fafe3498d1b7e3e071da4",
                    "parentId": "67b0ed271450ee8575f127e7",
                    "slotId": "Front_plate"
                  },
                  {
                    "_id": "67b0ed360ac189638af912ab",
                    "_tpl": "656fb0bd7c2d57afe200c0dc",
                    "parentId": "67b0ed271450ee8575f127e7",
                    "slotId": "Back_plate"
                  },
                {
                    "_id": "67b0da7ce97e58bca8ddea17",
                    "_tpl": "656fae5f7c2d57afe200c0d7",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 4
                    }
                },
                {
                  "_id": "67b0da75176bb93564d7e950",
                  "_tpl": "656fae5f7c2d57afe200c0d7",
                  "parentId": "hideout",
                  "slotId": "hideout",
                  "upd": {
                      "UnlimitedCount": true,
                      "StackObjectsCount": 999
                  }
              },
                {
                    "_id": "67b0dacf10c694a7644b324c",
                    "_tpl": "656f664200d62bcd2e024077",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 4
                    }
                },
                {
                  "_id": "67b0dac153279840c1d5e083",
                  "_tpl": "656f664200d62bcd2e024077",
                  "parentId": "hideout",
                  "slotId": "hideout",
                  "upd": {
                      "UnlimitedCount": true,
                      "StackObjectsCount": 999
                  }
              },
                {
                    "_id": "67b0daf50670f3ebc62aeafe",
                    "_tpl": "656fafe3498d1b7e3e071da4",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 2
                    }
                },
                {
                  "_id": "67b0daec550c9e0887169b1b",
                  "_tpl": "656fafe3498d1b7e3e071da4",
                  "parentId": "hideout",
                  "slotId": "hideout",
                  "upd": {
                      "UnlimitedCount": true,
                      "StackObjectsCount": 999
                  }
              },
                {
                  "_id": "67b0dafd81f2a8576e876f53",
                  "_tpl": "6530e8587cbfc1e309011e37",
                  "parentId": "hideout",
                  "slotId": "hideout",
                  "upd": {
                      "UnlimitedCount": false,
                      "StackObjectsCount": 1
                  }
              },
              {
                "_id": "67b0db0a86bebaf2c931b8b6",
                "_tpl": "60a283193cb70855c43a381d",
                "parentId": "hideout",
                "slotId": "hideout",
                "upd": {
                  "UnlimitedCount": false,
                  "StackObjectsCount": 2
              }
              },
              {
                "_id": "67b0db2a35276fdb9b98284d",
                "_tpl": "6575d561b15fef3dd4051670",
                "parentId": "67b0db0a86bebaf2c931b8b6",
                "slotId": "Soft_armor_front"
              },
              {
                "_id": "67b0db2dfad093d22fdd268c",
                "_tpl": "6575d56b16c2762fba005818",
                "parentId": "67b0db0a86bebaf2c931b8b6",
                "slotId": "Soft_armor_back"
              },
              {
                "_id": "67b0db301068c4ac20204b14",
                "_tpl": "6575d57a16c2762fba00581c",
                "parentId": "67b0db0a86bebaf2c931b8b6",
                "slotId": "Soft_armor_left"
              },
              {
                "_id": "67b0db32e26d135fafbb69ef",
                "_tpl": "6575d589b15fef3dd4051674",
                "parentId": "67b0db0a86bebaf2c931b8b6",
                "slotId": "soft_armor_right"
              },
              {
                "_id": "67b0db349e04116a5402224c",
                "_tpl": "6575d598b15fef3dd4051678",
                "parentId": "67b0db0a86bebaf2c931b8b6",
                "slotId": "Collar"
              },
              {
                "_id": "67b0db37f6937adb22e6d944",
                "_tpl": "6575d5b316c2762fba005824",
                "parentId": "67b0db0a86bebaf2c931b8b6",
                "slotId": "Shoulder_l"
              },
              {
                "_id": "67b0db3a46e0476da27d1b3a",
                "_tpl": "6575d5bd16c2762fba005828",
                "parentId": "67b0db0a86bebaf2c931b8b6",
                "slotId": "Shoulder_r"
              },
              {
                "_id": "67b0db46f9110d8afa69c350",
                "_tpl": "6575d5a616c2762fba005820",
                "parentId": "67b0db0a86bebaf2c931b8b6",
                "slotId": "Groin"
              },
              {
                "_id": "67b0db4e11e1e4d99f19543a",
                "_tpl": "656fa61e94b480b8a500c0e8",
                "parentId": "67b0db0a86bebaf2c931b8b6",
                "slotId": "Front_plate"
              },
              {
                "_id": "67b0db4fe7cd2fc81b22bceb",
                "_tpl": "656fa61e94b480b8a500c0e8",
                "parentId": "67b0db0a86bebaf2c931b8b6",
                "slotId": "Back_plate"
              },
              {
                "_id": "67b0db51208ec59622724712",
                "_tpl": "64afdb577bb3bfe8fe03fd1d",
                "parentId": "67b0db0a86bebaf2c931b8b6",
                "slotId": "Left_side_plate"
              },
              {
                "_id": "67b0db5c566a55749edb6a69",
                "_tpl": "64afdb577bb3bfe8fe03fd1d",
                "parentId": "67b0db0a86bebaf2c931b8b6",
                "slotId": "Right_side_plate"
              },
                //? ==========================WEAPON==========================
                {
                  "_id": "67b0db6587f6ecae45aae058",
                  "_tpl": "5a1eaa87fcdbcb001865f75e",
                  "parentId": "hideout",
                  "slotId": "hideout",
                  "upd": {
                      "UnlimitedCount": true,
                      "StackObjectsCount": 9999999,
                      "BuyRestrictionMax": 1,
                      "BuyRestrictionCurrent": 0
                  }
              },
                {
                    "_id": "67b0dfffe0c24b45fc9b57b4",
                    "_tpl": "5448bd6b4bdc2dfc2f8b4569",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 9999999,
                    }
                },
                {
                  "_id": "67b0db8064e797b67475d021",
                  "_tpl": "5448c12b4bdc2d02308b456f",
                  "parentId": "67b0dfffe0c24b45fc9b57b4",
                  "slotId": "mod_magazine"
                },
                {
                  "_id": "67b0db8064e797b67475d022",
                  "_tpl": "6374a822e629013b9c0645c8",
                  "parentId": "67b0dfffe0c24b45fc9b57b4",
                  "slotId": "mod_reciever"
                },
                {
                  "_id": "67b0db8064e797b67475d022",
                  "_tpl": "63c6adcfb4ba094317063742",
                  "parentId": "666aa319e8e00edadd0d1da7",
                  "slotId": "mod_sight_rear"
                },
                {
                  "_id": "67b0db8064e797b67475d022",
                  "_tpl": "6374a7e7417239a7bf00f042",
                  "parentId": "67b0dfffe0c24b45fc9b57b4",
                  "slotId": "mod_pistolgrip"
                },
                {
                    "_id": "67b0dd05ad813bbfb5dd6f65",
                    "_tpl": "5d1b5e94d7ad1a2b865a96b0",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 9999999,
                        "BuyRestrictionMax": 1,
                        "BuyRestrictionCurrent": 0
                    }
                },
                {
                  "_id": "67b0df40d45d3afd91ace149",
                  "_tpl": "5dcbd56fdbd3d91b3e5468d5",
                  "parentId": "hideout",
                  "slotId": "hideout",
                  "upd": {
                    "UnlimitedCount": true,
                    "StackObjectsCount": 9999999,
                    "BuyRestrictionMax": 1,
                    "BuyRestrictionCurrent": 0
                }
                },
                {
                  "_id": "3971138adbad1a65f0e60187",
                  "_tpl": "5dcbd6dddbd3d91b3e5468de",
                  "parentId": "67b0df40d45d3afd91ace149",
                  "slotId": "mod_pistol_grip"
                },
                {
                  "_id": "f887461f43722b9d019df4df",
                  "_tpl": "65293c7a17e14363030ad308",
                  "parentId": "67b0df40d45d3afd91ace149",
                  "slotId": "mod_magazine"
                },
                {
                  "_id": "9bcdefb749d70ef76257db90",
                  "_tpl": "5c48a14f2e2216152006edd7",
                  "parentId": "67b0df40d45d3afd91ace149",
                  "slotId": "mod_handguard"
                },
                {
                  "_id": "3ddf1c2494a18001dbfcf575",
                  "_tpl": "5dcbe9431e1f4616d354987e",
                  "parentId": "67b0df40d45d3afd91ace149",
                  "slotId": "mod_barrel"
                },
                {
                  "_id": "b383779282fa3b89e6e2df2e",
                  "_tpl": "60a23797a37c940de7062d02",
                  "parentId": "67b0df40d45d3afd91ace149",
                  "slotId": "mod_scope",
                },
                {
                  "_id": "5dff1da78a588a2a21c1c1a9",
                  "_tpl": "5894a81786f77427140b8347",
                  "parentId": "67b0df40d45d3afd91ace149",
                  "slotId": "mod_sight_rear",
                },
                {
                  "_id": "dbcbc1bbdb7767a9f9465e05",
                  "_tpl": "5e023e53d4353e3302577c4c",
                  "parentId": "67b0df40d45d3afd91ace149",
                  "slotId": "patron_in_weapon"
                },
                {
                  "_id": "94cb4ce09f029d26e3e8bad9",
                  "_tpl": "5b7be4895acfc400170e2dd5",
                  "parentId": "9bcdefb749d70ef76257db90",
                  "slotId": "mod_mount_000"
                },
                {
                  "_id": "732b782af6675c1ceb26d6ef",
                  "_tpl": "6269545d0e57f218e4548ca2",
                  "parentId": "9bcdefb749d70ef76257db90",
                  "slotId": "mod_mount_002"
                },
                {
                  "_id": "070493fdb23774cdcacf5a37",
                  "_tpl": "5c18b90d2e2216152142466b",
                  "parentId": "9bcdefb749d70ef76257db90",
                  "slotId": "mod_sight_front",
                },
                {
                  "_id": "9b152f1681fe874a441e505b",
                  "_tpl": "607ffb988900dc2d9a55b6e4",
                  "parentId": "3ddf1c2494a18001dbfcf575",
                  "slotId": "mod_muzzle"
                },
                {
                  "_id": "dbf8c4175e33d0d0e44f9411",
                  "_tpl": "64807a29e5ffe165600abc97",
                  "parentId": "94cb4ce09f029d26e3e8bad9",
                  "slotId": "mod_foregrip"
                },
                {
                  "_id": "67b0de085b59fdd97f601f26",
                  "_tpl": "5dcbd56fdbd3d91b3e5468d5",
                  "parentId": "hideout",
                  "slotId": "hideout",
                  "upd": {
                    "UnlimitedCount": true,
                    "StackObjectsCount": 9999999,
                    "BuyRestrictionMax": 1,
                    "BuyRestrictionCurrent": 0
                }
                },
                {
                  "_id": "67b0de75f858fa08e6b9a875",
                  "_tpl": "5dcbd6dddbd3d91b3e5468de",
                  "parentId": "67b0de085b59fdd97f601f26",
                  "slotId": "mod_pistol_grip"
                },
                {
                  "_id": "67b0de783a8d19e0e5c1eb3a",
                  "_tpl": "65293c7a17e14363030ad308",
                  "parentId": "67b0de085b59fdd97f601f26",
                  "slotId": "mod_magazine"
                },
                {
                  "_id": "67b0de085b59fdd97f601f28", //! Хуета ебаная
                  "_tpl": "5c48a14f2e2216152006edd7",
                  "parentId": "67b0de085b59fdd97f601f26",
                  "slotId": "mod_handguard"
                },
                {
                  "_id": "67b0de085b59fdd97f601f55", //! Хуета ебаная 2
                  "_tpl": "5dcbe9431e1f4616d354987e",
                  "parentId": "67b0de085b59fdd97f601f26",
                  "slotId": "mod_barrel"
                },
                {
                  "_id": "67b0de949ed701dc672fe9e8",
                  "_tpl": "60a23797a37c940de7062d02",
                  "parentId": "67b0de085b59fdd97f601f26",
                  "slotId": "mod_scope",
                },
                {
                  "_id": "67b0de957a148179055c794e",
                  "_tpl": "5894a81786f77427140b8347",
                  "parentId": "67b0de085b59fdd97f601f26",
                  "slotId": "mod_sight_rear",
                },
                {
                  "_id": "67b0de9743c923592a95c622",
                  "_tpl": "5e023e53d4353e3302577c4c",
                  "parentId": "67b0de085b59fdd97f601f26",
                  "slotId": "patron_in_weapon"
                },
                {
                  "_id": "67b0de085b59fdd97f601f58",
                  "_tpl": "5b7be4895acfc400170e2dd5",
                  "parentId": "67b0de085b59fdd97f601f28",
                  "slotId": "mod_mount_000"
                },
                {
                  "_id": "67b0dea37778d4638c92e9ad",
                  "_tpl": "6269545d0e57f218e4548ca2",
                  "parentId": "67b0de085b59fdd97f601f28",
                  "slotId": "mod_mount_002"
                },
                {
                  "_id": "67b0dea51663445217ca85bb",
                  "_tpl": "5c18b90d2e2216152142466b",
                  "parentId": "67b0de085b59fdd97f601f28",
                  "slotId": "mod_sight_front",
                },
                {
                  "_id": "67b0dea776218bd46eaeab70",
                  "_tpl": "607ffb988900dc2d9a55b6e4",
                  "parentId": "67b0de085b59fdd97f601f55",
                  "slotId": "mod_muzzle"
                },
                {
                  "_id": "67b0dea9a7b3fbea387406e0",
                  "_tpl": "64807a29e5ffe165600abc97",
                  "parentId": "67b0de085b59fdd97f601f58",
                  "slotId": "mod_foregrip"
                },
                {
                  "_id": "67b0dee890f073b776db5854",
                  "_tpl": "5447a9cd4bdc2dbd208b4567",
                  "parentId": "hideout",
                  "slotId": "hideout",
                  "upd": {
                    "UnlimitedCount": true,
                    "StackObjectsCount": 9999999,
                    "BuyRestrictionMax": 2,
                    "BuyRestrictionCurrent": 0
                }
                },
                {
                  "_id": "67b0def0814097037c44c581",
                  "_tpl": "59db3a1d86f77429e05b4e92",
                  "parentId": "67b0dee890f073b776db5854",
                  "slotId": "mod_pistol_grip"
                },
                {
                  "_id": "67b0def2287d6da74d88bad6",
                  "_tpl": "5aaa5dfee5b5b000140293d3",
                  "parentId": "67b0dee890f073b776db5854",
                  "slotId": "mod_magazine"
                },
                {
                  "_id": "67b0def9e6f4251638785d53",
                  "_tpl": "59bfe68886f7746004266202",
                  "parentId": "67b0dee890f073b776db5854",
                  "slotId": "mod_reciever"
                },
                {
                  "_id": "67b0def9e6f4251638785d55",
                  "_tpl": "5649be884bdc2d79388b4577",
                  "parentId": "67b0dee890f073b776db5854",
                  "slotId": "mod_stock"
                },
                {
                  "_id": "67b0ed86f0895fc53509b7ac",
                  "_tpl": "5b2240bf5acfc40dc528af69",
                  "parentId": "67b0dee890f073b776db5854",
                  "slotId": "mod_charge"
                },
                {
                  "_id": "67b0def9e6f4251638785d56",
                  "_tpl": "55d3632e4bdc2d972f8b4569",
                  "parentId": "67b0def9e6f4251638785d53",
                  "slotId": "mod_barrel"
                },
                {
                  "_id": "67b0def9e6f4251638785d57",
                  "_tpl": "595cfa8b86f77427437e845b",
                  "parentId": "67b0def9e6f4251638785d53",
                  "slotId": "mod_handguard"
                },
                {
                  "_id": "99c6ada725dcb09335cc6947",
                  "_tpl": "5bc09a18d4351e003562b68e",
                  "parentId": "67b0def9e6f4251638785d53",
                  "slotId": "mod_sight_rear",
                },
                {
                  "_id": "7c59d17f56d34c406082e108",
                  "_tpl": "5d44069ca4b9361ebd26fc37",
                  "parentId": "67b0def9e6f4251638785d55",
                  "slotId": "mod_stock_000"
                },
                {
                  "_id": "a2aaaf4d3ed34a6a680ec395",
                  "_tpl": "5cf6937cd7f00c056c53fb39",
                  "parentId": "67b0def9e6f4251638785d56",
                  "slotId": "mod_muzzle"
                },
                {
                  "_id": "c182324aa61417007526fb40",
                  "_tpl": "63d3ce281fe77d0f2801859e",
                  "parentId": "67b0def9e6f4251638785d56",
                  "slotId": "mod_gas_block"
                },
                {
                  "_id": "67b0def9e6f4251638785d58",
                  "_tpl": "59e0bed186f774156f04ce84",
                  "parentId": "67b0def9e6f4251638785d57",
                  "slotId": "mod_mount_000"
                },
                {
                  "_id": "ac8e304439c2d6ecda780f01",
                  "_tpl": "59e0be5d86f7742d48765bd2",
                  "parentId": "67b0def9e6f4251638785d57",
                  "slotId": "mod_mount_002"
                },
                {
                  "_id": "a2b85d66f4e2b751f5eed79a",
                  "_tpl": "59e0bdb186f774156f04ce82",
                  "parentId": "67b0def9e6f4251638785d57",
                  "slotId": "mod_mount_004"
                },
                {
                  "_id": "89ea077e39325e5e816bc42a",
                  "_tpl": "5c17804b2e2216152006c02f",
                  "parentId": "67b0def9e6f4251638785d57",
                  "slotId": "mod_sight_front",
                },
                {
                  "_id": "0f7249e978094892b46e805d",
                  "_tpl": "5b057b4f5acfc4771e1bd3e9",
                  "parentId": "67b0def9e6f4251638785d58",
                  "slotId": "mod_foregrip"
                },
                {
                    "_id": "67b0df202628cc933dd4c346",
                    "_tpl": "59d6088586f774275f37482f",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                      "UnlimitedCount": true,
                      "StackObjectsCount": 9999999,
                      "BuyRestrictionMax": 2,
                      "BuyRestrictionCurrent": 0
                  }
                  },
                  {
                    "_id": "811de0617b2c07fcacd7ff33",
                    "_tpl": "5cf656f2d7f00c06585fb6eb",
                    "parentId": "67b0df202628cc933dd4c346",
                    "slotId": "mod_gas_block"
                  },
                  {
                    "_id": "f3d7bd87d6ebabbb53380749",
                    "_tpl": "64942bfc6ee699f6890dff95",
                    "parentId": "67b0df202628cc933dd4c346",
                    "slotId": "mod_muzzle"
                  },
                  {
                    "_id": "e879faf9244c842298bf803f",
                    "_tpl": "6087e663132d4d12c81fd96b",
                    "parentId": "67b0df202628cc933dd4c346",
                    "slotId": "mod_pistol_grip"
                  },
                  {
                    "_id": "c843a0243b60f0e2c124db0c",
                    "_tpl": "5d2c76ed48f03532f2136169",
                    "parentId": "67b0df202628cc933dd4c346",
                    "slotId": "mod_reciever"
                  },
                  {
                    "_id": "66e7f6646bf879a165082a6a",
                    "_tpl": "6087e2a5232e5a31c233d552",
                    "parentId": "67b0df202628cc933dd4c346",
                    "slotId": "mod_stock"
                  },
                  {
                    "_id": "833fc60819d321e760c881b0",
                    "_tpl": "59d6272486f77466146386ff",
                    "parentId": "67b0df202628cc933dd4c346",
                    "slotId": "mod_magazine"
                  },
                  {
                    "_id": "032112e60ee4eb2b74061774",
                    "_tpl": "6130ca3fd92c473c77020dbd",
                    "parentId": "67b0df202628cc933dd4c346",
                    "slotId": "mod_charge"
                  },
                  {
                    "_id": "3ad25247aaf6d993d943360e",
                    "_tpl": "59e0d99486f7744a32234762",
                    "parentId": "67b0df202628cc933dd4c346",
                    "slotId": "patron_in_weapon"
                  },
                  {
                    "_id": "e02f572a4ba6bad6584ba035",
                    "_tpl": "5649a2464bdc2d91118b45a8",
                    "parentId": "811de0617b2c07fcacd7ff33",
                    "slotId": "mod_scope"
                  },
                  {
                    "_id": "8522752a2dd301246c9cf856",
                    "_tpl": "59e0bdb186f774156f04ce82",
                    "parentId": "811de0617b2c07fcacd7ff33",
                    "slotId": "mod_mount_001"
                  },
                  {
                    "_id": "ee4fa01ccbd74e872b33f31c",
                    "_tpl": "59e0bdb186f774156f04ce82",
                    "parentId": "811de0617b2c07fcacd7ff33",
                    "slotId": "mod_mount_002"
                  },
                  {
                    "_id": "6384635a5decc37d6bda61d6",
                    "_tpl": "5a9d6d13a2750c00164f6b03",
                    "parentId": "811de0617b2c07fcacd7ff33",
                    "slotId": "mod_foregrip"
                  },
                  {
                    "_id": "ae72db8144235c73e447a443",
                    "_tpl": "5656d7c34bdc2d9d198b4587",
                    "parentId": "833fc60819d321e760c881b0",
                    "slotId": "cartridges",
                    "location": 0,
                  },
                  {
                    "_id": "f3800838dcc8192fface2ce2",
                    "_tpl": "609bab8b455afd752b2e6138",
                    "parentId": "e02f572a4ba6bad6584ba035",
                    "slotId": "mod_scope",
                  },
                  {
                    "_id": "2f43f718877f318ffd1fa20e",
                    "_tpl": "5cc9c20cd7f00c001336c65d",
                    "parentId": "8522752a2dd301246c9cf856",
                    "slotId": "mod_tactical",
                  },
                  {
                    "_id": "4a630290f96033d72457cf9d",
                    "_tpl": "5cc9c20cd7f00c001336c65d",
                    "parentId": "ee4fa01ccbd74e872b33f31c",
                    "slotId": "mod_tactical",
                  },
                  {
                    "_id": "aca5763fa7b390cbb476863c",
                    "_tpl": "5b057b4f5acfc4771e1bd3e9",
                    "parentId": "6384635a5decc37d6bda61d6",
                    "slotId": "mod_foregrip"
                  },
                  {
                    "_id": "67b0dda771374899493c318f", //* 2000 EU
                    "_tpl": "5d43021ca4b9362eab4b5e25",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                      "UnlimitedCount": true,
                      "StackObjectsCount": 9999999,
                      "BuyRestrictionMax": 2,
                      "BuyRestrictionCurrent": 0
                   }
                  },
                  {
                    "_id": "2f2065b1999d6ac0473c888e",
                    "_tpl": "6113cc78d3a39d50044c065a",
                    "parentId": "67b0dda771374899493c318f",
                    "slotId": "mod_pistol_grip"
                  },
                  {
                    "_id": "b951ed3424ed3830a35483cb",
                    "_tpl": "61840d85568c120fdd2962a5",
                    "parentId": "67b0dda771374899493c318f",
                    "slotId": "mod_magazine"
                  },
                  {
                    "_id": "6f2656827aa03674f5f4c2b4",
                    "_tpl": "5d4405aaa4b9361e6a4e6bd3",
                    "parentId": "67b0dda771374899493c318f",
                    "slotId": "mod_reciever"
                  },
                  {
                    "_id": "8e95a444f5b7486226560110",
                    "_tpl": "5649be884bdc2d79388b4577",
                    "parentId": "67b0dda771374899493c318f",
                    "slotId": "mod_stock"
                  },
                  {
                    "_id": "ac370f3a77f909a9466a1055",
                    "_tpl": "5d44334ba4b9362b346d1948",
                    "parentId": "67b0dda771374899493c318f",
                    "slotId": "mod_charge"
                  },
                  {
                    "_id": "1c4cd9b0557cc65c5363602f",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "67b0dda771374899493c318f",
                    "slotId": "patron_in_weapon"
                  },
                  {
                    "_id": "b19a030a066d96c041aad6a5",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 0
                  },
                  {
                    "_id": "6172dfb9aff8268b261d4ccb",
                    "_tpl": "54527ac44bdc2d36668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 1
                  },
                  {
                    "_id": "899d33f8fb5754c45bc0f5f1",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 2
                  },
                  {
                    "_id": "151529dc114d00f878e315cb",
                    "_tpl": "54527ac44bdc2d36668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 3
                  },
                  {
                    "_id": "52e1fdb7fd23980730b3258a",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 4
                  },
                  {
                    "_id": "43b51f164670f67cfe2b5662",
                    "_tpl": "54527ac44bdc2d36668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 5
                  },
                  {
                    "_id": "556c2fde2a0cb9f7d1b68927",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 6
                  },
                  {
                    "_id": "85dd24a27691586047b69c11",
                    "_tpl": "54527ac44bdc2d36668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 7
                  },
                  {
                    "_id": "de3b0d948f0e1fa41741831a",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 8
                  },
                  {
                    "_id": "0122a7f413da5451a76a660b",
                    "_tpl": "54527ac44bdc2d36668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 9
                  },
                  {
                    "_id": "ee3e3fa94915230238e0bb6f",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 10
                  },
                  {
                    "_id": "358985c7197274c8423be365",
                    "_tpl": "54527ac44bdc2d36668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 11
                  },
                  {
                    "_id": "5690e4a8b7da6c411618e7dd",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 12
                  },
                  {
                    "_id": "5438d17dd181714f817f56c3",
                    "_tpl": "54527ac44bdc2d36668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 13
                  },
                  {
                    "_id": "4abc1bfdcac7bfe761962147",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 14
                  },
                  {
                    "_id": "cad216c28f1281007e96485c",
                    "_tpl": "54527ac44bdc2d36668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 15
                  },
                  {
                    "_id": "2228d66fdcb723844f96a087",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 16
                  },
                  {
                    "_id": "4147522af3edf3327f55cd6e",
                    "_tpl": "54527ac44bdc2d36668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 17
                  },
                  {
                    "_id": "418f51f3f5ac597b0c2fcb38",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 18
                  },
                  {
                    "_id": "0dde3462c41f9a83923fb3b9",
                    "_tpl": "54527ac44bdc2d36668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 19
                  },
                  {
                    "_id": "9544b38fde8fcbbe3bc3b249",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 20
                  },
                  {
                    "_id": "e8b87275df3eee7f7996440c",
                    "_tpl": "54527ac44bdc2d36668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 21
                  },
                  {
                    "_id": "0a4ac0a4eed4f65e419a346b",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 22
                  },
                  {
                    "_id": "761d4b0660dce36a689324f7",
                    "_tpl": "54527ac44bdc2d36668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 23
                  },
                  {
                    "_id": "8c9d3c14dc2d9004da86c8e5",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 24
                  },
                  {
                    "_id": "be380415a261404cf118490c",
                    "_tpl": "54527ac44bdc2d36668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 25
                  },
                  {
                    "_id": "147ca2abd486774cfd451c9f",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 26
                  },
                  {
                    "_id": "326d69f39a2daff942ccb7d1",
                    "_tpl": "54527ac44bdc2d36668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 27
                  },
                  {
                    "_id": "5d50aa84f4a99026cd50ee1f",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 28
                  },
                  {
                    "_id": "80cb890ebf30f82a8f9cb601",
                    "_tpl": "54527ac44bdc2d36668b4567",
                    "parentId": "b951ed3424ed3830a35483cb",
                    "slotId": "cartridges",
                    "location": 29
                  },
                  {
                    "_id": "0cdfeaecee3fe915628eea03",
                    "_tpl": "64785e7c19d732620e045e15",
                    "parentId": "6f2656827aa03674f5f4c2b4",
                    "slotId": "mod_scope",
                  },
                  {
                    "_id": "5b7e742ace7071b552e4941b",
                    "_tpl": "5c0e2f94d174af029f650d56",
                    "parentId": "6f2656827aa03674f5f4c2b4",
                    "slotId": "mod_barrel"
                  },
                  {
                    "_id": "20eedf09314d76d8ad557979",
                    "_tpl": "5c78f2492e221600114c9f04",
                    "parentId": "6f2656827aa03674f5f4c2b4",
                    "slotId": "mod_handguard"
                  },
                  {
                    "_id": "904d8799f713d8bb1474c971",
                    "_tpl": "5d4406a8a4b9361e4f6eb8b7",
                    "parentId": "8e95a444f5b7486226560110",
                    "slotId": "mod_stock_000"
                  },
                  {
                    "_id": "ec4f1c4847dc77fde3615482",
                    "_tpl": "615d8e2f1cb55961fa0fd9a4",
                    "parentId": "5b7e742ace7071b552e4941b",
                    "slotId": "mod_muzzle"
                  },
                  {
                    "_id": "c1fdfc8344b9447f8454cdb7",
                    "_tpl": "63d3ce281fe77d0f2801859e",
                    "parentId": "5b7e742ace7071b552e4941b",
                    "slotId": "mod_gas_block"
                  },
                  {
                    "_id": "7644222d078a52e0457ee7fe",
                    "_tpl": "5b7be4895acfc400170e2dd5",
                    "parentId": "20eedf09314d76d8ad557979",
                    "slotId": "mod_foregrip"
                  },
                  {
                    "_id": "72e88b4c318fbbb588daec1d",
                    "_tpl": "5c78f2882e22165df16b832e",
                    "parentId": "20eedf09314d76d8ad557979",
                    "slotId": "mod_muzzle"
                  },
                  {
                    "_id": "c51eb3b92a38191bd1371e83",
                    "_tpl": "6272370ee4013c5d7e31f418",
                    "parentId": "20eedf09314d76d8ad557979",
                    "slotId": "mod_tactical_002",
                  },
                  {
                    "_id": "fcade42185ef9fb38a4dac0f",
                    "_tpl": "5c1bc4812e22164bef5cfde7",
                    "parentId": "7644222d078a52e0457ee7fe",
                    "slotId": "mod_foregrip"
                  },
                  {
                    "_id": "67b0ddce0a1f5011b5747b79", //* 1 Lega
                    "_tpl": "64ca3d3954fc657e230529cc",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 9999999,
                        "BuyRestrictionMax": 2,
                        "BuyRestrictionCurrent": 0
                    }
                  },
                  {
                    "_id": "67d159386e997c97f4ee63a3",
                    "_tpl": "59e62cc886f77440d40b52a1",
                    "parentId": "67b0ddce0a1f5011b5747b79",
                    "slotId": "mod_pistolgrip"
                  },
                  {
                    "_id": "47fcdf2ab5cb33296ef73467",
                    "_tpl": "646372518610c40fc20204e8",
                    "parentId": "67b0ddce0a1f5011b5747b79",
                    "slotId": "mod_magazine"
                  },
                  {
                    "_id": "5fa269eb5fa53c8b030f0742",
                    "_tpl": "6492d7847363b8a52206bc52",
                    "parentId": "67b0ddce0a1f5011b5747b79",
                    "slotId": "mod_stock"
                  },
                  {
                    "_id": "40616b532dc14c37e16afa62",
                    "_tpl": "64639a9aab86f8fd4300146c",
                    "parentId": "67b0ddce0a1f5011b5747b79",
                    "slotId": "mod_barrel"
                  },
                  {
                    "_id": "c855c49b9d2651c3833b2ef7",
                    "_tpl": "6491c6f6ef312a876705191b",
                    "parentId": "67b0ddce0a1f5011b5747b79",
                    "slotId": "mod_handguard"
                  },
                  {
                    "_id": "b49279af3d7fb0abd6b1aed1",
                    "_tpl": "6492fb8253acae0af00a29b6",
                    "parentId": "67b0ddce0a1f5011b5747b79",
                    "slotId": "mod_sight_rear",
                  },
                  {
                    "_id": "2580d8d003becdb98a56ec7b",
                    "_tpl": "5a0c59791526d8dba737bba7",
                    "parentId": "5fa269eb5fa53c8b030f0742",
                    "slotId": "mod_stock_000"
                  },
                  {
                    "_id": "e28ceca94e313523e5452200",
                    "_tpl": "646f6322f43d0c5d62063715",
                    "parentId": "c855c49b9d2651c3833b2ef7",
                    "slotId": "mod_tactical_000"
                  },
                  {
                    "_id": "c3c4faaa04d506fc8a4b8740",
                    "_tpl": "6492c8bba6e68e06fb0bae87",
                    "parentId": "c855c49b9d2651c3833b2ef7",
                    "slotId": "mod_mount"
                  },
                  {
                    "_id": "b40112c7640a0db97124d6d2",
                    "_tpl": "5c1cd46f2e22164bef5cfedb",
                    "parentId": "c855c49b9d2651c3833b2ef7",
                    "slotId": "mod_foregrip"
                  },
                  {
                    "_id": "2a3aa3d8c58c6abaf5936cb1",
                    "_tpl": "646f62fee779812413011ab7",
                    "parentId": "e28ceca94e313523e5452200",
                    "slotId": "mod_tactical",
                  },
                  {
                    "_id": "0271644378eb16d9530a1304",
                    "_tpl": "584924ec24597768f12ae244",
                    "parentId": "c3c4faaa04d506fc8a4b8740",
                    "slotId": "mod_scope",
                  },
                  {
                    "_id": "67b0dfa828a82ee9cc57e550", //* 1 LEGA
                    "_tpl": "5a7828548dc32e5a9c28b516",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 9999999,
                        "BuyRestrictionMax": 2,
                        "BuyRestrictionCurrent": 0
                    }
                  },
                  {
                    "_id": "2bdc925be5c4ce51a0d802fb",
                    "_tpl": "5a787f7ac5856700177af660",
                    "parentId": "67b0dfa828a82ee9cc57e550",
                    "slotId": "mod_barrel",
                  },
                  {
                    "_id": "2a912d6f2fc2f99d3d368861",
                    "_tpl": "5a788068c5856700137e4c8f",
                    "parentId": "67b0dfa828a82ee9cc57e550",
                    "slotId": "mod_handguard"
                  },
                  {
                    "_id": "b1dfa44594c86d3a2263fa01",
                    "_tpl": "5a78832ec5856700155a6ca3",
                    "parentId": "67b0dfa828a82ee9cc57e550",
                    "slotId": "mod_magazine"
                  },
                  {
                    "_id": "d7e3f58a22db8111136fae66",
                    "_tpl": "5ae35b315acfc4001714e8b0",
                    "parentId": "67b0dfa828a82ee9cc57e550",
                    "slotId": "mod_stock"
                  },
                  {
                    "_id": "77de5bb6ada4b7d1792d2f4c",
                    "_tpl": "5a7893c1c585673f2b5c374d",
                    "parentId": "67b0dfa828a82ee9cc57e550",
                    "slotId": "mod_mount"
                  },
                  {
                    "_id": "c026fe92271c1ed06fbd6fa3",
                    "_tpl": "560838c94bdc2d77798b4569",
                    "parentId": "2bdc925be5c4ce51a0d802fb",
                    "slotId": "mod_muzzle"
                  },
                  {
                    "_id": "2b937c5baf18548361d6a386",
                    "_tpl": "5a789261c5856700186c65d3",
                    "parentId": "2bdc925be5c4ce51a0d802fb",
                    "slotId": "mod_mount"
                  },
                  {
                    "_id": "77ebb03a8c1fbadb96d82494",
                    "_tpl": "5b7be4895acfc400170e2dd5",
                    "parentId": "2a912d6f2fc2f99d3d368861",
                    "slotId": "mod_foregrip"
                  },
                  {
                    "_id": "4ad8103083c5f1866616e83e",
                    "_tpl": "6269220d70b6c02e665f2635",
                    "parentId": "2a912d6f2fc2f99d3d368861",
                    "slotId": "mod_mount_000"
                  },
                  {
                    "_id": "bfb4e2600408a6433cfcad43",
                    "_tpl": "6269220d70b6c02e665f2635",
                    "parentId": "2a912d6f2fc2f99d3d368861",
                    "slotId": "mod_mount_001"
                  },
                  {
                    "_id": "6910ab7eed7dad83172add0d",
                    "_tpl": "602e620f9b513876d4338d9a",
                    "parentId": "d7e3f58a22db8111136fae66",
                    "slotId": "mod_stock"
                  },
                  {
                    "_id": "2e493275418993b2aa44d99b",
                    "_tpl": "6113cc78d3a39d50044c065a",
                    "parentId": "d7e3f58a22db8111136fae66",
                    "slotId": "mod_pistol_grip"
                  },
                  {
                    "_id": "9e3f46de69693c522a91c31f",
                    "_tpl": "570fd721d2720bc5458b4596",
                    "parentId": "77de5bb6ada4b7d1792d2f4c",
                    "slotId": "mod_scope",
                  },
                  {
                    "_id": "9beb02996338cd1fa3fea7d1",
                    "_tpl": "560d657b4bdc2da74d8b4572",
                    "parentId": "2b937c5baf18548361d6a386",
                    "slotId": "mod_tactical_000",
                  },
                  {
                    "_id": "497ae275ecc4b8b639948034",
                    "_tpl": "560d657b4bdc2da74d8b4572",
                    "parentId": "2b937c5baf18548361d6a386",
                    "slotId": "mod_tactical_001",
                  },
                  {
                    "_id": "8079c4a631055efe0da960f9",
                    "_tpl": "5c1bc5af2e221602b412949b",
                    "parentId": "77ebb03a8c1fbadb96d82494",
                    "slotId": "mod_foregrip"
                  },
                  {
                    "_id": "beb6626f034e001d5746f45c",
                    "_tpl": "560d657b4bdc2da74d8b4572",
                    "parentId": "4ad8103083c5f1866616e83e",
                    "slotId": "mod_tactical",
                  },
                  {
                    "_id": "6a870f527209f6c0c6f7d02f",
                    "_tpl": "560d657b4bdc2da74d8b4572",
                    "parentId": "bfb4e2600408a6433cfcad43",
                    "slotId": "mod_tactical",
                  },
                {
                    "_id": "67b0df7abb5114bf3891d1a0",
                    "_tpl": "5bb2475ed4351e00853264e3",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 9999999,
                        "BuyRestrictionMax": 2,
                        "BuyRestrictionCurrent": 0
                    }
                  },
                  {
                    "_id": "34e18d150609607b60777317",
                    "_tpl": "59db3a1d86f77429e05b4e92",
                    "parentId": "67b0df7abb5114bf3891d1a0",
                    "slotId": "mod_pistol_grip"
                  },
                  {
                    "_id": "8f63314d39445aaf32ad26e6",
                    "_tpl": "5c05413a0db834001c390617",
                    "parentId": "67b0df7abb5114bf3891d1a0",
                    "slotId": "mod_magazine"
                  },
                  {
                    "_id": "550d0ef7da310f08bcff3d5a",
                    "_tpl": "5bb20d53d4351e4502010a69",
                    "parentId": "67b0df7abb5114bf3891d1a0",
                    "slotId": "mod_reciever"
                  },
                  {
                    "_id": "d4c37979ef006adde9d8e1af",
                    "_tpl": "5bb20e58d4351e00320205d7",
                    "parentId": "67b0df7abb5114bf3891d1a0",
                    "slotId": "mod_stock"
                  },
                  {
                    "_id": "691a38dc451cedefaf68f1fd",
                    "_tpl": "651bf5617b3b552ef6712cb7",
                    "parentId": "67b0df7abb5114bf3891d1a0",
                    "slotId": "mod_charge"
                  },
                  {
                    "_id": "046dd58368011ebfe114be49",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "67b0df7abb5114bf3891d1a0",
                    "slotId": "patron_in_weapon"
                  },
                  {
                    "_id": "a4118ddc6ef69fd9bc66f621",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "8f63314d39445aaf32ad26e6",
                    "slotId": "cartridges",
                    "location": 0,
                  },
                  {
                    "_id": "adde72fae021fc0b579706c1",
                    "_tpl": "64785e7c19d732620e045e15",
                    "parentId": "550d0ef7da310f08bcff3d5a",
                    "slotId": "mod_scope",
                  },
                  {
                    "_id": "ab6112bb0facd80bb5b8056f",
                    "_tpl": "5bb20d9cd4351e00334c9d8a",
                    "parentId": "550d0ef7da310f08bcff3d5a",
                    "slotId": "mod_barrel"
                  },
                  {
                    "_id": "5e3789b6828184922e68d2ed",
                    "_tpl": "5c6d10fa2e221600106f3f23",
                    "parentId": "550d0ef7da310f08bcff3d5a",
                    "slotId": "mod_handguard"
                  },
                  {
                    "_id": "b1861726125998da049876d5",
                    "_tpl": "602e620f9b513876d4338d9a",
                    "parentId": "d4c37979ef006adde9d8e1af",
                    "slotId": "mod_stock_000"
                  },
                  {
                    "_id": "94e0ad5a593eddce6911a72c",
                    "_tpl": "5cf6937cd7f00c056c53fb39",
                    "parentId": "ab6112bb0facd80bb5b8056f",
                    "slotId": "mod_muzzle"
                  },
                  {
                    "_id": "3677f449869f687312b2f485",
                    "_tpl": "5bb20dcad4351e3bac1212da",
                    "parentId": "ab6112bb0facd80bb5b8056f",
                    "slotId": "mod_gas_block"
                  },
                  {
                    "_id": "5ce6f5470623f3930a8f6c3b",
                    "_tpl": "5b7be47f5acfc400170e2dd2",
                    "parentId": "5e3789b6828184922e68d2ed",
                    "slotId": "mod_mount_001"
                  },
                  {
                    "_id": "0fb331f8865be1e0dc5f8d76",
                    "_tpl": "5b7be4895acfc400170e2dd5",
                    "parentId": "5e3789b6828184922e68d2ed",
                    "slotId": "mod_foregrip"
                  },
                  {
                    "_id": "2f28686dff277323b3a31a66",
                    "_tpl": "6272370ee4013c5d7e31f418",
                    "parentId": "5ce6f5470623f3930a8f6c3b",
                    "slotId": "mod_tactical",
                  },
                  {
                    "_id": "f427d595d4cf040b5e9c1f9d",
                    "_tpl": "5c1cd46f2e22164bef5cfedb",
                    "parentId": "0fb331f8865be1e0dc5f8d76",
                    "slotId": "mod_foregrip"
                  },
                  {
                    "_id": "67b0dfc47ad2e84630374ea3",
                    "_tpl": "59e6152586f77473dc057aa1",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                      "UnlimitedCount": true,
                      "StackObjectsCount": 9999999,
                      "BuyRestrictionMax": 2,
                      "BuyRestrictionCurrent": 0
                  }
                  },
                  {
                    "_id": "cf4a872f91b11e653b0f0dfe",
                    "_tpl": "59e649f986f77411d949b246",
                    "parentId": "67b0dfc47ad2e84630374ea3",
                    "slotId": "mod_gas_block"
                  },
                  {
                    "_id": "bafbc576f7ae3050ef78456c",
                    "_tpl": "5c878ebb2e2216001219d48a",
                    "parentId": "67b0dfc47ad2e84630374ea3",
                    "slotId": "mod_muzzle"
                  },
                  {
                    "_id": "dccc1f2a008382ad3c5c1269",
                    "_tpl": "6087e663132d4d12c81fd96b",
                    "parentId": "67b0dfc47ad2e84630374ea3",
                    "slotId": "mod_pistol_grip"
                  },
                  {
                    "_id": "c064de6a9575309d3d367cfb",
                    "_tpl": "59e6449086f7746c9f75e822",
                    "parentId": "67b0dfc47ad2e84630374ea3",
                    "slotId": "mod_reciever"
                  },
                  {
                    "_id": "701ca1bdf8f67b9be571b784",
                    "_tpl": "5649d9a14bdc2d79388b4580",
                    "parentId": "67b0dfc47ad2e84630374ea3",
                    "slotId": "mod_sight_rear",
                  },
                  {
                    "_id": "3170c24e89c9deb0d02b564d",
                    "_tpl": "5e217ba4c1434648c13568cd",
                    "parentId": "67b0dfc47ad2e84630374ea3",
                    "slotId": "mod_stock"
                  },
                  {
                    "_id": "64a37904b4749154318ea303",
                    "_tpl": "59d625f086f774661516605d",
                    "parentId": "67b0dfc47ad2e84630374ea3",
                    "slotId": "mod_magazine"
                  },
                  {
                    "_id": "70620e5dbb09f2b877dd9213",
                    "_tpl": "6130ca3fd92c473c77020dbd",
                    "parentId": "67b0dfc47ad2e84630374ea3",
                    "slotId": "mod_charge"
                  },
                  {
                    "_id": "6ce12f28bc16254bff8c9201",
                    "_tpl": "64b7af734b75259c590fa895",
                    "parentId": "67b0dfc47ad2e84630374ea3",
                    "slotId": "patron_in_weapon"
                  },
                  {
                    "_id": "5f226dbc44a69fd91a400f63",
                    "_tpl": "5b80242286f77429445e0b47",
                    "parentId": "cf4a872f91b11e653b0f0dfe",
                    "slotId": "mod_handguard"
                  },
                  {
                    "_id": "782836c4dcd183622fa97e92",
                    "_tpl": "58491f3324597764bc48fa02",
                    "parentId": "701ca1bdf8f67b9be571b784",
                    "slotId": "mod_scope",
                  },
                  {
                    "_id": "5eb2b31d282cf68b60c607da",
                    "_tpl": "5b8403a086f7747ff856f4e2",
                    "parentId": "5f226dbc44a69fd91a400f63",
                    "slotId": "mod_mount_000"
                  },
                  {
                    "_id": "d8afd5d6bee02a480160a8af",
                    "_tpl": "5b84038986f774774913b0c1",
                    "parentId": "5f226dbc44a69fd91a400f63",
                    "slotId": "mod_mount_001"
                  },
                  {
                    "_id": "c34116c08e90c19110614883",
                    "_tpl": "65169d5b30425317755f8e25",
                    "parentId": "5eb2b31d282cf68b60c607da",
                    "slotId": "mod_foregrip"
                  },
                  {
                    "_id": "12f56224f64a250a836f59b1",
                    "_tpl": "5cc9c20cd7f00c001336c65d",
                    "parentId": "d8afd5d6bee02a480160a8af",
                    "slotId": "mod_tactical",
                  },
                {
                    "_id": "67b0df8727be1d9c1bdea6bc",
                    "_tpl": "6176aca650224f204c1da3fb",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                      "UnlimitedCount": true,
                      "StackObjectsCount": 9999999,
                      "BuyRestrictionMax": 2,
                      "BuyRestrictionCurrent": 0
                  }
                  },
                  {
                    "_id": "2fb9ba40c7ed4a9a68d32f34",
                    "_tpl": "5d025cc1d7ad1a53845279ef",
                    "parentId": "67b0df8727be1d9c1bdea6bc",
                    "slotId": "mod_pistol_grip"
                  },
                  {
                    "_id": "81f4c2cf5af23a0e78113f36",
                    "_tpl": "617131a4568c120fdd29482d",
                    "parentId": "67b0df8727be1d9c1bdea6bc",
                    "slotId": "mod_magazine"
                  },
                  {
                    "_id": "4806b6b2a9412c28031969a6",
                    "_tpl": "617153016c780c1e710c9a2f",
                    "parentId": "67b0df8727be1d9c1bdea6bc",
                    "slotId": "mod_stock"
                  },
                  {
                    "_id": "9a5124209191b9c421502385",
                    "_tpl": "61713a8fd92c473c770214a4",
                    "parentId": "67b0df8727be1d9c1bdea6bc",
                    "slotId": "mod_reciever"
                  },
                  {
                    "_id": "267960a2016f1717a336abe8",
                    "_tpl": "61702d8a67085e45ef140b24",
                    "parentId": "67b0df8727be1d9c1bdea6bc",
                    "slotId": "mod_charge"
                  },
                  {
                    "_id": "a35980bb4d3160863fae98c9",
                    "_tpl": "617155ee50224f204c1da3cd",
                    "parentId": "4806b6b2a9412c28031969a6",
                    "slotId": "mod_stock_000"
                  },
                  {
                    "_id": "ecf655f3985728890f1cf2f3",
                    "_tpl": "6171407e50224f204c1da3c5",
                    "parentId": "9a5124209191b9c421502385",
                    "slotId": "mod_scope"
                  },
                  {
                    "_id": "7351ea208d9b29fa48e0c522",
                    "_tpl": "61702be9faa1272e431522c3",
                    "parentId": "9a5124209191b9c421502385",
                    "slotId": "mod_barrel"
                  },
                  {
                    "_id": "f1a681f0c583de480605c7ec",
                    "_tpl": "61712eae6c780c1e710c9a1d",
                    "parentId": "9a5124209191b9c421502385",
                    "slotId": "mod_handguard"
                  },
                  {
                    "_id": "0b4ec6f400227781b584ab91",
                    "_tpl": "5c18b9192e2216398b5a8104",
                    "parentId": "9a5124209191b9c421502385",
                    "slotId": "mod_sight_rear",
                  },
                  {
                    "_id": "fab633ee5ef25682ffa74284",
                    "_tpl": "61715e7e67085e45ef140b33",
                    "parentId": "a35980bb4d3160863fae98c9",
                    "slotId": "mod_stock_000"
                  },
                  {
                    "_id": "932f557be4719f46c5091dfd",
                    "_tpl": "617151c1d92c473c770214ab",
                    "parentId": "ecf655f3985728890f1cf2f3",
                    "slotId": "mod_scope_000",
                  },
                  {
                    "_id": "b9b3ec33f9c0551cd1c40021",
                    "_tpl": "57ae0171245977343c27bfcf",
                    "parentId": "ecf655f3985728890f1cf2f3",
                    "slotId": "mod_scope_002",
                  },
                  {
                    "_id": "bb0642e6721a3ebbc59d5cce",
                    "_tpl": "5cf78496d7f00c065703d6ca",
                    "parentId": "7351ea208d9b29fa48e0c522",
                    "slotId": "mod_muzzle"
                  },
                  {
                    "_id": "27acda5e938e70edfc7541bd",
                    "_tpl": "61702f1b67085e45ef140b26",
                    "parentId": "7351ea208d9b29fa48e0c522",
                    "slotId": "mod_gas_block"
                  },
                  {
                    "_id": "ef21e735701c77e0de9e10b9",
                    "_tpl": "5c1bc5af2e221602b412949b",
                    "parentId": "f1a681f0c583de480605c7ec",
                    "slotId": "mod_foregrip"
                  },
                  {
                    "_id": "fe24131df2706db2c3fcfc40",
                    "_tpl": "5cc9c20cd7f00c001336c65d",
                    "parentId": "f1a681f0c583de480605c7ec",
                    "slotId": "mod_tactical_001",
                  },
                  {
                    "_id": "f049448b2b69577d99f9055d",
                    "_tpl": "5c878e9d2e2216000f201903",
                    "parentId": "bb0642e6721a3ebbc59d5cce",
                    "slotId": "mod_muzzle_000"
                  },
                  {
                    "_id": "23e75673965151807c1e5a8e",
                    "_tpl": "5cf78720d7f00c06595bc93e",
                    "parentId": "bb0642e6721a3ebbc59d5cce",
                    "slotId": "mod_muzzle_001"
                  },
                {
                    "_id": "67b0df963268dd03be003a3c",
                    "_tpl": "5a0ec13bfcdbcb00165aa685",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 9999999,
                        "BuyRestrictionMax": 2,
                        "BuyRestrictionCurrent": 0
                    }
                  },
                  {
                    "_id": "61987ada611e2ea871427324",
                    "_tpl": "59d64ec286f774171d1e0a42",
                    "parentId": "67b0df963268dd03be003a3c",
                    "slotId": "mod_gas_block"
                  },
                  {
                    "_id": "daf22c574b2652486fdcca53",
                    "_tpl": "64942bfc6ee699f6890dff95",
                    "parentId": "67b0df963268dd03be003a3c",
                    "slotId": "mod_muzzle"
                  },
                  {
                    "_id": "807e7aa9885df18e1e913a54",
                    "_tpl": "5f6341043ada5942720e2dc5",
                    "parentId": "67b0df963268dd03be003a3c",
                    "slotId": "mod_pistol_grip"
                  },
                  {
                    "_id": "adf5657e151af526bd391369",
                    "_tpl": "5d2c772c48f0355d95672c25",
                    "parentId": "67b0df963268dd03be003a3c",
                    "slotId": "mod_reciever"
                  },
                  {
                    "_id": "449d1f9901dbf16291e6910b",
                    "_tpl": "6087e2a5232e5a31c233d552",
                    "parentId": "67b0df963268dd03be003a3c",
                    "slotId": "mod_stock"
                  },
                  {
                    "_id": "0eecd592b0f0bee44b7b3873",
                    "_tpl": "59d6272486f77466146386ff",
                    "parentId": "67b0df963268dd03be003a3c",
                    "slotId": "mod_magazine"
                  },
                  {
                    "_id": "5404c51ee64af446070af6b3",
                    "_tpl": "6130ca3fd92c473c77020dbd",
                    "parentId": "67b0df963268dd03be003a3c",
                    "slotId": "mod_charge"
                  },
                  {
                    "_id": "9cf1e179196e8fecd7048813",
                    "_tpl": "5c9a1c422e221600106f69f0",
                    "parentId": "61987ada611e2ea871427324",
                    "slotId": "mod_handguard"
                  },
                  {
                    "_id": "80c4e79a892a3e7e088c909d",
                    "_tpl": "5c0505e00db834001b735073",
                    "parentId": "adf5657e151af526bd391369",
                    "slotId": "mod_scope",
                  },
                  {
                    "_id": "a9fe598e0d43d4009de78ec4",
                    "_tpl": "5b7be4895acfc400170e2dd5",
                    "parentId": "9cf1e179196e8fecd7048813",
                    "slotId": "mod_foregrip"
                  },
                  {
                    "_id": "622b12ce75216920479d1d60",
                    "_tpl": "64806bdd26c80811d408d37a",
                    "parentId": "a9fe598e0d43d4009de78ec4",
                    "slotId": "mod_foregrip"
                  },
                {
                    "_id": "67b0dbe8296b6432b4e00d73",
                    "_tpl": "5926bb2186f7744b1c6c6e60",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 9999999,
                        "BuyRestrictionMax": 2,
                        "BuyRestrictionCurrent": 0
                    }
                  },
                  {
                    "_id": "3fa4225104b43ab48b9e41c0",
                    "_tpl": "5a351711c4a282000b1521a4",
                    "parentId": "67b0dbe8296b6432b4e00d73",
                    "slotId": "mod_magazine"
                  },
                  {
                    "_id": "a79ea618f142e62d7c0e6e7e",
                    "_tpl": "5926f2e086f7745aae644231",
                    "parentId": "67b0dbe8296b6432b4e00d73",
                    "slotId": "mod_reciever"
                  },
                  {
                    "_id": "c3d15bf36f7be7cf473416f9",
                    "_tpl": "5926c32286f774616e42de99",
                    "parentId": "67b0dbe8296b6432b4e00d73",
                    "slotId": "mod_charge",
                  },
                  {
                    "_id": "5af6720baeb5027040cf784b",
                    "_tpl": "5926f34786f77469195bfe92",
                    "parentId": "a79ea618f142e62d7c0e6e7e",
                    "slotId": "mod_handguard"
                  },
                  {
                    "_id": "5fd3d7bc44282bb380a41480",
                    "_tpl": "5926d2be86f774134d668e4e",
                    "parentId": "a79ea618f142e62d7c0e6e7e",
                    "slotId": "mod_sight_rear",
                  },
                  {
                    "_id": "c4cde088dedf14ff95b6d9c4",
                    "_tpl": "5926d3c686f77410de68ebc8",
                    "parentId": "a79ea618f142e62d7c0e6e7e",
                    "slotId": "mod_stock"
                  },
                  {
                    "_id": "2f7819522b7f0cf302141dc2",
                    "_tpl": "5926d33d86f77410de68ebc0",
                    "parentId": "a79ea618f142e62d7c0e6e7e",
                    "slotId": "mod_muzzle"
                  },
                  {
                    "_id": "270c3fe1c9da3d83730a5f97",
                    "_tpl": "59c63b4486f7747afb151c1c",
                    "parentId": "2f7819522b7f0cf302141dc2",
                    "slotId": "mod_mount"
                  },
                  {
                    "_id": "bcb89a559c6ae4cf2ae08974",
                    "_tpl": "5a5f1ce64f39f90b401987bc",
                    "parentId": "270c3fe1c9da3d83730a5f97",
                    "slotId": "mod_tactical_001",
                  },
                //? ==========================OTHER===========================
                {
                    "_id": "67b0dbf271dc9ed8b7d71d49",
                    "_tpl": "5c94bbff86f7747ee735c08f",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 9,
                        "BuyRestrictionMax": 1,
                        "BuyRestrictionCurrent": 0
                    }
                },
                {
                    "_id": "67b0dc09e41e35479a2950be",
                    "_tpl": "5c1d0f4986f7744bb01837fa",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 1
                    }
                },
                {
                    "_id": "67b0dd8de622d9e99ac09769",
                    "_tpl": "62178c4d4ecf221597654e3d",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 3
                    }
                },
                {
                    "_id": "67b0e00b4e239fa303d05876",
                    "_tpl": "5c0a840b86f7742ffa4f2482",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 2
                    }
                },
                {
                    "_id": "67b0dcf01d6aadb4fc136d1c",
                    "_tpl": "5c0a840b86f7742ffa4f2482",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 1 
                    }
                },
                {
                    "_id": "67b0dcfa83c59c8870603329",
                    "_tpl": "5b6d9ce188a4501afc1b2b25",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 1 
                    }
                },
                { //* 6 leg
                  "_id": "67b0df40d45d3afd91ace557", //30000/5=6
                  "_tpl": "5d80c62a86f7744036212b3f",
                  "parentId": "hideout",
                  "slotId": "hideout",
                  "upd": {
                      "UnlimitedCount": true,
                      "StackObjectsCount": 1 
                  }
              },
              { //* 9 leg
                "_id": "67b0df40d45d3afd91ace556",
                "_tpl": "5d80c60f86f77440373c4ece",
                "parentId": "hideout",
                "slotId": "hideout",
                "upd": {
                    "UnlimitedCount": true,
                    "StackObjectsCount": 1 
                }
              },
              { //* 4 leg
                "_id": "67b0dba82117a873013ad1e9",
                "_tpl": "5ede7a8229445733cb4c18e2",
                "parentId": "hideout",
                "slotId": "hideout",
                "upd": {
                    "UnlimitedCount": true,
                    "StackObjectsCount": 1
                }
              },
              { //* 5 leg
                "_id": "67b0df40d45d3afd91ace555",
                "_tpl": "5780cf7f2459777de4559322",
                "parentId": "hideout",
                "slotId": "hideout",
                "upd": {
                    "UnlimitedCount": true,
                    "StackObjectsCount": 1 
                }
              },
              { //* 4 leg
                "_id": "67b0dfb400aefff2fd851011",
                "_tpl": "59fb042886f7746c5005a7b2",
                "parentId": "hideout",
                "slotId": "hideout",
                "upd": {
                    "UnlimitedCount": false,
                    "StackObjectsCount": 1 
                }
              },
                {
                    "_id": "67b0dfe3f1b61d565763e7be",
                    "_tpl": "6656560053eaaa7a23349c86",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 1000
                    }
                }
            ],
            "barter_scheme": { //* BARTER ==========================================================================================================================
                //? ===========================AMMO===========================
                "67b0ec79de78ad5768e43f94": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 1
                        },
                        {
                            "_tpl": "56dff061d2720bb5668b4567",
                            "count": 1
                        }
                    ]
                ],
                "67b0d7cf33f19aafa59b67ef": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568",
                            "count": 200
                        },
                        {
                            "_tpl": "60391b0fb847c71012789415",
                            "count": 1
                        }
                    ]
                ],
                "67b0d7e37f33f30f091e3c4c": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568",
                            "count": 5
                        },
                        {
                            "_tpl": "56dff061d2720bb5668b4567",
                            "count": 2
                        }
                    ]
                ],
                "67b0d7ed486dd1971322bda7": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568",
                            "count": 5
                        },
                        {
                            "_tpl": "58dd3ad986f77403051cba8f",
                            "count": 1
                        }
                    ]
                ],
                "67b0eb8beaed4c93b7e20619": [
                    [
                        {
                            "_tpl": "5cc9c20cd7f00c001336c65d",
                            "count": 3
                        },
                        {
                            "_tpl": "5448be9a4bdc2dfd2f8b456a",
                            "count": 3
                        }
                    ]
                ],
                "67b0d8028a5b012868fbdd32": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568",
                            "count": 5
                        },
                        {
                            "_tpl": "64b7af434b75259c590fa893",
                            "count": 2
                        }
                    ]
                ],
                "67b0d80f23d34bc138ca6331": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568",
                            "count": 5
                        },
                        {
                            "_tpl": "5a6086ea4f39f99cd479502f",
                            "count": 1
                        }
                    ]
                ],
                "67b0d81b9b788721b0921fb2": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568",
                            "count": 5
                        },
                        {
                            "_tpl": "5a6086ea4f39f99cd479502f",
                            "count": 3
                        }
                    ]
                ],
                "67b0d82535fef9417accd915": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568",
                            "count": 5
                        },
                        {
                            "_tpl": "5fc382b6d6fa9c00c571bbc3",
                            "count": 5
                        }
                    ]
                ],
                //? ==========================ARMOR===========================
                "67b0d83590986e6f1487c02d": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568",
                            "count": 600
                        }
                    ]
                ],
                "67b0d87638187b38b06e795c": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568",
                            "count": 500
                        },
                        {
                            "_tpl": "5f5e46b96bdad616ad46d613",
                            "count": 1
                        }
                    ]
                ],
                "67b0d884e79303fdd740f2a5": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86",
                            "count": 1
                        },
                        {
                            "_tpl": "5ac8d6885acfc400180ae7b0",
                            "count": 1
                        }
                    ]
                ],
                "67b0d8f56f25d7662a9f1465": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86",
                            "count": 1
                        },
                        {
                            "_tpl": "5c0e774286f77468413cc5b2",
                            "count": 1
                        }
                    ]
                ],
                "67b0d9e835826a6cc64565b6": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86",
                            "count": 1
                        }
                    ]
                ],
                "67b0ed271450ee8575f127e7": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86",
                            "count": 1
                        }
                    ]
                ],
                "67b0da7ce97e58bca8ddea17": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568",
                            "count": 1850
                        }
                    ]
                ],
                "67b0da75176bb93564d7e950": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86",
                          "count": 1
                      }
                  ]
              ],
                "67b0dacf10c694a7644b324c": [
                    [
                        {
                            "_tpl": "5f0c892565703e5c461894e9",
                            "count": 20
                        }
                    ]
                ],
                "67b0dac153279840c1d5e083": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86",
                          "count": 1
                      }
                  ]
              ],
                "67b0daf50670f3ebc62aeafe": [
                    [
                        {
                            "_tpl": "656fae5f7c2d57afe200c0d7",
                            "count": 2
                        }
                    ]
                ],
                "67b0daec550c9e0887169b1b": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86",
                          "count": 1
                      }
                  ]
              ],
              "67b0db0a86bebaf2c931b8b6": [
                [
                    {
                        "_tpl": "6656560053eaaa7a23349c86",
                        "count": 4
                    }
                ]
            ],
                "67b0dafd81f2a8576e876f53": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86",
                          "count": 4
                      }
                  ]
              ],
                //? ==========================WEAPON==========================
                "67b0dfffe0c24b45fc9b57b4": [
                    [
                        {
                            "_tpl": "5448be9a4bdc2dfd2f8b456a", // 5d235b4d86f7742e017bc88a - gp
                            "count": 1
                        }
                    ]
                ],
                "67b0dd05ad813bbfb5dd6f65": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86",
                            "count": 2
                        }
                    ]
                ],
                "67b0db6587f6ecae45aae058": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86",
                          "count": 3
                      }
                  ]
              ],
                "67b0dbe8296b6432b4e00d73": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 600
                        },
                    ]
                ],
                "67b0de085b59fdd97f601f26": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86", 
                          "count": 1
                      },
                  ]
              ],
                "67b0df40d45d3afd91ace149": [
                  [
                      {
                          "_tpl": "569668774bdc2da2298b4568", 
                          "count": 2000
                      },
                  ]
              ],
                "67b0dee890f073b776db5854": [
                  [
                      {
                          "_tpl": "569668774bdc2da2298b4568", 
                          "count": 2000
                      },
                  ]
              ],
                "67b0df963268dd03be003a3c": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 1900
                        },
                    ]
                ],
                "67b0df8727be1d9c1bdea6bc": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 2900
                        },
                    ]
                ],
                "67b0df7abb5114bf3891d1a0": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 2600
                        },
                    ]
                ],
                "67b0df202628cc933dd4c346": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 2400
                        },
                    ]
                ],
                "67b0dfc47ad2e84630374ea3": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 950
                        },
                    ]
                ],
                "67b0dda771374899493c318f": [
                  [
                      {
                          "_tpl": "569668774bdc2da2298b4568", 
                          "count": 2150
                      },
                  ]
              ],
                "67b0dfa828a82ee9cc57e550": [
                  [
                      {
                          "_tpl": "569668774bdc2da2298b4568", 
                          "count": 1666
                      },
                  ]
              ],
                "67b0ddce0a1f5011b5747b79": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86", 
                          "count": 1
                      },
                  ]
              ],
                //? ==========================OTHER===========================
                "67b0dbf271dc9ed8b7d71d49": [
                    [
                        {
                            "_tpl": "5c0e874186f7745dc7616606",
                            "count": 2
                        }
                    ]
                ],
                "67b0dc09e41e35479a2950be": [
                    [
                        {
                            "_tpl": "5c0e874186f7745dc7616606",
                            "count": 1
                        },
                        {
                            "_tpl": "60a7ad2a2198820d95707a2e",
                            "count": 1
                        },
                        {
                            "_tpl": "6656560053eaaa7a23349c86", // LEGA
                            "count": 3
                        },
                    ]
                ],
                "67b0dd8de622d9e99ac09769": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86",
                            "count": 1
                        }
                    ]
                ],
                "67b0e00b4e239fa303d05876": [
                    [
                        {
                            "_tpl": "59faff1d86f7746c51718c9c",
                            "count": 40
                        }
                    ]
                ],
                "67b0dcfa83c59c8870603329": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86",
                            "count": 6
                        }
                    ]
                ],
                "67b0dcf01d6aadb4fc136d1c": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86", 
                            "count": 20
                        }
                    ]
                ],
                "67b0df40d45d3afd91ace557": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86", 
                            "count": 6
                        }
                    ]
                ],
                "67b0df40d45d3afd91ace556": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86", 
                          "count": 9
                      }
                  ]
              ],
              "67b0dba82117a873013ad1e9": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86", 
                          "count": 4
                      }
                  ]
              ],
              "67b0df40d45d3afd91ace555": [
                [
                    {
                        "_tpl": "6656560053eaaa7a23349c86", 
                        "count": 5
                    }
                ]
            ],
            "67b0dfb400aefff2fd851011": [
              [
                  {
                      "_tpl": "6656560053eaaa7a23349c86", 
                      "count": 4
                  }
              ]
          ],
                "67b0dfe3f1b61d565763e7be": [
                    [
                        {
                            "_tpl": "59faff1d86f7746c51718c9c", 
                            "count": 2
                        }
                    ]
                ]
            },
            "loyal_level_items": { //! Добавить TXdml = g28/1L 
              //* === LVL1 ===
              "67b0dfffe0c24b45fc9b57b4":1,
              "67b0eb8beaed4c93b7e20619":1,
              "67b0d87638187b38b06e795c":1,
              "67b0dfe3f1b61d565763e7be":1,
              "67b0dbe8296b6432b4e00d73":1,
              "67b0dfc47ad2e84630374ea3":1,
              "67b0dfb400aefff2fd851011":1,
              "67b0dac153279840c1d5e083":1,
              "67b0da75176bb93564d7e950":1,
              "67b0de085b59fdd97f601f26":1,
              "67b0dfa828a82ee9cc57e550":1,
              //* === LVL2 ===
              "67b0df963268dd03be003a3c":2,
              "67b0df202628cc933dd4c346":2,
              "67b0df8727be1d9c1bdea6bc":2,
              "67b0df7abb5114bf3891d1a0":2,
              "67b0dbf271dc9ed8b7d71d49":2,
              "67b0dc09e41e35479a2950be":2,
              "67b0ec79de78ad5768e43f94":2,
              "67b0d7cf33f19aafa59b67ef":2,
              "67b0d7e37f33f30f091e3c4c":2,
              "67b0d8f56f25d7662a9f1465":2,
              "67b0d9e835826a6cc64565b6":2,
              "67b0ed271450ee8575f127e7":2,
              "67b0d83590986e6f1487c02d":2,
              "67b0da7ce97e58bca8ddea17":2,
              "67b0dacf10c694a7644b324c":2,
              "67b0df40d45d3afd91ace557":2,
              "67b0df40d45d3afd91ace556":2,
              "67b0df40d45d3afd91ace555":2,
              "67b0dba82117a873013ad1e9":2,
              "67b0dee890f073b776db5854":2,
              "67b0df40d45d3afd91ace149":2,
              "67b0ddce0a1f5011b5747b79":2,
              "67b0dda771374899493c318f":2,
              //* === LVL3 ===
              "67b0d7ed486dd1971322bda7":3,
              "67b0d8028a5b012868fbdd32":3,
              "67b0d80f23d34bc138ca6331":3,
              "67b0d81b9b788721b0921fb2":3,
              "67b0d82535fef9417accd915":3,
              "67b0dd8de622d9e99ac09769": 3,
              "67b0dcf01d6aadb4fc136d1c":3,
              "67b0daf50670f3ebc62aeafe":3,
              "67b0daec550c9e0887169b1b":3,
              "67b0dd05ad813bbfb5dd6f65":3,
              "67b0db6587f6ecae45aae058":3,
              "67b0dcfa83c59c8870603329":3,
              "67b0dafd81f2a8576e876f53":3,
              "67b0db0a86bebaf2c931b8b6":3,
              "67b0d884e79303fdd740f2a5":3,
              //* === LVL4 ===
              "67b0e00b4e239fa303d05876":4
          }
        }
        return assortTable;
    }


    /**
     * Add item to assortTable + barter scheme + loyalty level objects
     * @param assortTable trader assorts to add item to
     * @param itemTpl Items tpl to add to traders assort
     * @param unlimitedCount Can an unlimited number of this item be purchased from trader
     * @param stackCount Total size of item stack trader sells
     * @param loyaltyLevel Loyalty level item can be purchased at
     * @param currencyType What currency does item sell for
     * @param currencyValue Amount of currency item can be purchased for
     */
    private addSingleItemToAssort(assortTable: ITraderAssort, itemTpl: string, unlimitedCount: boolean, stackCount: number, loyaltyLevel: number, currencyType: Money, currencyValue: number)
    {
        // Define item in the table
        const newItem: Item = {
            _id: itemTpl,
            _tpl: itemTpl,
            parentId: "hideout",
            slotId: "hideout",
            upd: {
                UnlimitedCount: unlimitedCount,
                StackObjectsCount: stackCount
            }
        };
        assortTable.items.push(newItem);

        // Barter scheme holds the cost of the item + the currency needed (doesnt need to be currency, can be any item, this is how barter traders are made)
        assortTable.barter_scheme[itemTpl] = [
            [
                {
                    count: currencyValue,
                    _tpl: currencyType
                }
            ]
        ];

        // Set loyalty level needed to unlock item
        assortTable.loyal_level_items[itemTpl] = loyaltyLevel;
    }

    /**
     * Add a complex item to trader assort (item with child items)
     * @param assortTable trader assorts to add items to
     * @param jsonUtil JSON utility class
     * @param items Items array to add to assort
     * @param unlimitedCount Can an unlimited number of this item be purchased from trader
     * @param stackCount Total size of item stack trader sells
     * @param loyaltyLevel Loyalty level item can be purchased at
     * @param currencyType What currency does item sell for
     * @param currencyValue Amount of currency item can be purchased for
     */
    private addCollectionToAssort(jsonUtil: JsonUtil, assortTable: ITraderAssort, items: Item[], unlimitedCount: boolean, stackCount: number, loyaltyLevel: number, currencyType: Money, currencyValue: number): void
    {
        // Deserialize and serialize to ensure we dont alter the original data
        const collectionToAdd: Item[] = jsonUtil.deserialize(jsonUtil.serialize(items));

        // Update item base with values needed to make item sellable by trader
        collectionToAdd[0].upd = {
            UnlimitedCount: unlimitedCount,
            StackObjectsCount: stackCount
        }
        collectionToAdd[0].parentId = "hideout";
        collectionToAdd[0].slotId = "hideout";

        // Push all the items into the traders assort table
        assortTable.items.push(...collectionToAdd);

        // Barter scheme holds the cost of the item + the currency needed (doesnt need to be currency, can be any item, this is how barter traders are made)
        assortTable.barter_scheme[collectionToAdd[0]._id] = [
            [
                {
                    count: currencyValue,
                    _tpl: currencyType
                }
            ]
        ];

        // Set loyalty level needed to unlock item
        assortTable.loyal_level_items[collectionToAdd[0]._id] = loyaltyLevel;
    }
    /**
     * Add traders name/location/description to the locale table
     * @param tables database tables
     * @param fullName fullname of trader
     * @param firstName first name of trader
     * @param nickName nickname of trader
     * @param location location of trader
     * @param description description of trader
     */
    private addTraderToLocales(tables: IDatabaseTables, fullName: string, firstName: string, nickName: string, location: string, description: string)
    {
        // For each language, add locale for the new trader
        const locales = Object.values(tables.locales.global) as Record<string, string>[];
        for (const locale of locales) {
            locale[`${baseJson._id} FullName`] = fullName;
            locale[`${baseJson._id} FirstName`] = firstName;
            locale[`${baseJson._id} Nickname`] = nickName;
            locale[`${baseJson._id} Location`] = location;
            locale[`${baseJson._id} Description`] = description;
        }
    }

    private addItemToLocales(tables: IDatabaseTables, itemTpl: string, name: string, shortName: string, Description: string)
    {
        // For each language, add locale for the new trader
        const locales = Object.values(tables.locales.global) as Record<string, string>[];
        for (const locale of locales) {
            locale[`${itemTpl} Name`] = name;
            locale[`${itemTpl} ShortName`] = shortName;
            locale[`${itemTpl} Description`] = Description;
        }
    }
}

module.exports = { mod: new Punisher() }