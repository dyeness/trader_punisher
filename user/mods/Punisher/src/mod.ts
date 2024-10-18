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
        this.addTraderToLocales(tables, baseJson.name, "Punisher", baseJson.nickname, baseJson.location, "До конфликта работал наемным киллером, выполняя самые конченные заказы. Тарков стал местом, где можно спрятаться и продолжить свою спокойную жизнь. На сегодняшний день имеет подземное убежище на берегу. Из-за изобилия денежных ресурсов стал выдавать задачи, требующие особые навыки и выдержку. Не очень любит скупщика.");

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
        imageRouter.addRoute(baseJson.avatar.replace(".jpg", ""), `${imageFilepath}/Punisher.jpg`);
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
                    "_id": "RGO",
                    "_tpl": "618a431df1eb8e24b8741deb",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 15
                    }
                },
                {
                    "_id": "7n40",
                    "_tpl": "61962b617c6c7b169525f168",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 99999
                    }
                },
                {
                    "_id": "m433",
                    "_tpl": "5f0c892565703e5c461894e9", 
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 10
                    }
                },
                {
                    "_id": "Igla",
                    "_tpl": "5c0d5e4486f77478390952fe",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 99999
                    }
                },
                {
                    "_id": "m61",
                    "_tpl": "5a6086ea4f39f99cd479502f",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 99999
                    }
                },
                {
                    "_id": "MAI_AP", 
                    "_tpl": "601aa3d2b2bcb34913271e6d",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 99999
                    }
                },
                {
                    "_id": "m993", 
                    "_tpl": "5efb0c1bd79ff02a1f5e68d9",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 60
                    }
                },
                {
                    "_id": "bs", 
                    "_tpl": "5e023d48186a883be655e551",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 240
                    }
                },
                {
                    "_id": "lm_ap", 
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
                    "_id": "LBT",
                    "_tpl": "5e9db13186f7742f845ee9d3",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 3
                    }
                },
                {
                    "_id": "6sh",
                    "_tpl": "5df8a4d786f77412672a1e3b",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 3
                    }
                },
                {
                    "_id": "fast_black",
                    "_tpl": "5a154d5cfcdbcb001a3b00da",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 3
                    }
                },
                { // *Plates
                    "_id": "slick_black",
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
                    "_id": "slick_black_Fa",
                    "_tpl": "6575e71760703324250610c3",
                    "parentId": "slick_black",
                    "slotId": "Soft_armor_front"
                  },
                  {
                    "_id": "slick_black_Ba",
                    "_tpl": "6575e72660703324250610c7",
                    "parentId": "slick_black",
                    "slotId": "Soft_armor_back"
                  },
                  {
                    "_id": "slick_black_F",
                    "_tpl": "656fafe3498d1b7e3e071da4",
                    "parentId": "slick_black",
                    "slotId": "Front_plate"
                  },
                  {
                    "_id": "slick_black_B",
                    "_tpl": "656fafe3498d1b7e3e071da4",
                    "parentId": "slick_black",
                    "slotId": "Back_plate"
                  },
                { // *Plates
                    "_id": "slick_olive",
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
                    "_id": "slick_olive_Fa",
                    "_tpl": "6575e71760703324250610c3",
                    "parentId": "slick_olive",
                    "slotId": "Soft_armor_front"
                  },
                  {
                    "_id": "slick_olive_Ba",
                    "_tpl": "6575e72660703324250610c7",
                    "parentId": "slick_olive",
                    "slotId": "Soft_armor_back"
                  },
                  {
                    "_id": "slick_olive_F",
                    "_tpl": "656fafe3498d1b7e3e071da4",
                    "parentId": "slick_olive",
                    "slotId": "Front_plate"
                  },
                  {
                    "_id": "slick_olive_B",
                    "_tpl": "656fb0bd7c2d57afe200c0dc",
                    "parentId": "slick_olive",
                    "slotId": "Back_plate"
                  },
                { // *Plates
                    "_id": "slick_tan",
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
                    "_id": "slick_tan_Fa",
                    "_tpl": "6575e71760703324250610c3",
                    "parentId": "slick_tan",
                    "slotId": "Soft_armor_front"
                  },
                  {
                    "_id": "slick_tan_Ba",
                    "_tpl": "6575e72660703324250610c7",
                    "parentId": "slick_tan",
                    "slotId": "Soft_armor_back"
                  },
                  {
                    "_id": "slick_tan_F",
                    "_tpl": "656fafe3498d1b7e3e071da4",
                    "parentId": "slick_tan",
                    "slotId": "Front_plate"
                  },
                  {
                    "_id": "slick_tan_B",
                    "_tpl": "656fb0bd7c2d57afe200c0dc",
                    "parentId": "slick_tan",
                    "slotId": "Back_plate"
                  },
                {
                    "_id": "gac_5lvl",
                    "_tpl": "656fae5f7c2d57afe200c0d7",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 4
                    }
                },
                {
                  "_id": "gac_5lvl_l",
                  "_tpl": "656fae5f7c2d57afe200c0d7",
                  "parentId": "hideout",
                  "slotId": "hideout",
                  "upd": {
                      "UnlimitedCount": true,
                      "StackObjectsCount": 999
                  }
              },
                {
                    "_id": "korundvm_5lvl",
                    "_tpl": "5f5f41476bdad616ad46d631",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 4
                    }
                },
                {
                  "_id": "korundvm_5lvl_l",
                  "_tpl": "656f664200d62bcd2e024077",
                  "parentId": "hideout",
                  "slotId": "hideout",
                  "upd": {
                      "UnlimitedCount": true,
                      "StackObjectsCount": 999
                  }
              },
                {
                    "_id": "kiteco_6lvl",
                    "_tpl": "656fafe3498d1b7e3e071da4",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 2
                    }
                },
                {
                  "_id": "kiteco_6lvl_l",
                  "_tpl": "656fafe3498d1b7e3e071da4",
                  "parentId": "hideout",
                  "slotId": "hideout",
                  "upd": {
                      "UnlimitedCount": true,
                      "StackObjectsCount": 999
                  }
              },
                {
                  "_id": "red_zr",
                  "_tpl": "6530e8587cbfc1e309011e37",
                  "parentId": "hideout",
                  "slotId": "hideout",
                  "upd": {
                      "UnlimitedCount": false,
                      "StackObjectsCount": 1
                  }
              },
              {
                "_id": "THOR",
                "_tpl": "60a283193cb70855c43a381d",
                "parentId": "hideout",
                "slotId": "hideout",
                "upd": {
                  "UnlimitedCount": false,
                  "StackObjectsCount": 2
              }
              },
              {
                "_id": "576ea8e46600d80c70ba7db",
                "_tpl": "6575d561b15fef3dd4051670",
                "parentId": "THOR",
                "slotId": "Soft_armor_front"
              },
              {
                "_id": "576ea8e46600d80c70ba7dc",
                "_tpl": "6575d56b16c2762fba005818",
                "parentId": "THOR",
                "slotId": "Soft_armor_back"
              },
              {
                "_id": "576ea8e46600d80c70ba7dd",
                "_tpl": "6575d57a16c2762fba00581c",
                "parentId": "THOR",
                "slotId": "Soft_armor_left"
              },
              {
                "_id": "576ea8e46600d80c70ba7de",
                "_tpl": "6575d589b15fef3dd4051674",
                "parentId": "THOR",
                "slotId": "soft_armor_right"
              },
              {
                "_id": "576ea8e46600d80c70ba7df",
                "_tpl": "6575d598b15fef3dd4051678",
                "parentId": "THOR",
                "slotId": "Collar"
              },
              {
                "_id": "576ea8e46600d80c70ba7e0",
                "_tpl": "6575d5b316c2762fba005824",
                "parentId": "THOR",
                "slotId": "Shoulder_l"
              },
              {
                "_id": "576ea8e46600d80c70ba7e1",
                "_tpl": "6575d5bd16c2762fba005828",
                "parentId": "THOR",
                "slotId": "Shoulder_r"
              },
              {
                "_id": "576ea8e46600d80c70ba7e2",
                "_tpl": "6575d5a616c2762fba005820",
                "parentId": "THOR",
                "slotId": "Groin"
              },
              {
                "_id": "576ea8e46600d80c70ba7e3",
                "_tpl": "656fa61e94b480b8a500c0e8",
                "parentId": "THOR",
                "slotId": "Front_plate"
              },
              {
                "_id": "576ea8e46600d80c70ba7e4",
                "_tpl": "656fa61e94b480b8a500c0e8",
                "parentId": "THOR",
                "slotId": "Back_plate"
              },
              {
                "_id": "576ea8e46600d80c70ba7e5",
                "_tpl": "64afdb577bb3bfe8fe03fd1d",
                "parentId": "THOR",
                "slotId": "Left_side_plate"
              },
              {
                "_id": "576ea8e46600d80c70ba7e6",
                "_tpl": "64afdb577bb3bfe8fe03fd1d",
                "parentId": "THOR",
                "slotId": "Right_side_plate"
              },
                //? ==========================WEAPON==========================
                {
                  "_id": "Reapir",
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
                    "_id": "PM",
                    "_tpl": "5448bd6b4bdc2dfc2f8b4569",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                         "StackObjectsCount": 9999999,
                    }
                },
                {
                  "_id": "PM1",
                  "_tpl": "5448c12b4bdc2d02308b456f",
                  "parentId": "PM",
                  "slotId": "mod_magazine"
                },
                {
                  "_id": "PM2",
                  "_tpl": "6374a822e629013b9c0645c8",
                  "parentId": "PM",
                  "slotId": "mod_reciever"
                },
                {
                  "_id": "PM3",
                  "_tpl": "63c6adcfb4ba094317063742",
                  "parentId": "666aa319e8e00edadd0d1da7",
                  "slotId": "mod_sight_rear"
                },
                {
                  "_id": "PM4",
                  "_tpl": "6374a7e7417239a7bf00f042",
                  "parentId": "PM",
                  "slotId": "mod_pistolgrip"
                },
                {
                    "_id": "Flir",
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
                  "_id": "mdr_7",
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
                  "parentId": "mdr_7",
                  "slotId": "mod_pistol_grip"
                },
                {
                  "_id": "f887461f43722b9d019df4df",
                  "_tpl": "65293c7a17e14363030ad308",
                  "parentId": "mdr_7",
                  "slotId": "mod_magazine"
                },
                {
                  "_id": "9bcdefb749d70ef76257db90",
                  "_tpl": "5c48a14f2e2216152006edd7",
                  "parentId": "mdr_7",
                  "slotId": "mod_handguard"
                },
                {
                  "_id": "3ddf1c2494a18001dbfcf575",
                  "_tpl": "5dcbe9431e1f4616d354987e",
                  "parentId": "mdr_7",
                  "slotId": "mod_barrel"
                },
                {
                  "_id": "b383779282fa3b89e6e2df2e",
                  "_tpl": "60a23797a37c940de7062d02",
                  "parentId": "mdr_7",
                  "slotId": "mod_scope",
                },
                {
                  "_id": "5dff1da78a588a2a21c1c1a9",
                  "_tpl": "5894a81786f77427140b8347",
                  "parentId": "mdr_7",
                  "slotId": "mod_sight_rear",
                },
                {
                  "_id": "dbcbc1bbdb7767a9f9465e05",
                  "_tpl": "5e023e53d4353e3302577c4c",
                  "parentId": "mdr_7",
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
                  "_id": "mdr_7_l",
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
                  "_id": "397118adbad1a65f0e60187",
                  "_tpl": "5dcbd6dddbd3d91b3e5468de",
                  "parentId": "mdr_7_l",
                  "slotId": "mod_pistol_grip"
                },
                {
                  "_id": "f8846143722b9d019df4df",
                  "_tpl": "65293c7a17e14363030ad308",
                  "parentId": "mdr_7_l",
                  "slotId": "mod_magazine"
                },
                {
                  "_id": "9cdefb749d70ef76257db90",
                  "_tpl": "5c48a14f2e2216152006edd7",
                  "parentId": "mdr_7_l",
                  "slotId": "mod_handguard"
                },
                {
                  "_id": "3df1c2494a18001dbfcf575",
                  "_tpl": "5dcbe9431e1f4616d354987e",
                  "parentId": "mdr_7_l",
                  "slotId": "mod_barrel"
                },
                {
                  "_id": "383779282fa3b89e6e2df2e",
                  "_tpl": "60a23797a37c940de7062d02",
                  "parentId": "mdr_7_l",
                  "slotId": "mod_scope",
                },
                {
                  "_id": "dff1da78a588a2a21c1c1a9",
                  "_tpl": "5894a81786f77427140b8347",
                  "parentId": "mdr_7_l",
                  "slotId": "mod_sight_rear",
                },
                {
                  "_id": "bcbc1bbdb7767a9f9465e05",
                  "_tpl": "5e023e53d4353e3302577c4c",
                  "parentId": "mdr_7_l",
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
                  "_id": "kid_colt",
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
                  "_id": "b217e53bc4dc5b4e69e86537",
                  "_tpl": "59db3a1d86f77429e05b4e92",
                  "parentId": "kid_colt",
                  "slotId": "mod_pistol_grip"
                },
                {
                  "_id": "9c6d37308822a605345fae48",
                  "_tpl": "5aaa5dfee5b5b000140293d3",
                  "parentId": "kid_colt",
                  "slotId": "mod_magazine"
                },
                {
                  "_id": "16933222072e39ece7482491",
                  "_tpl": "59bfe68886f7746004266202",
                  "parentId": "kid_colt",
                  "slotId": "mod_reciever"
                },
                {
                  "_id": "e03cdd2c89f91d84ebbee22c",
                  "_tpl": "5649be884bdc2d79388b4577",
                  "parentId": "kid_colt",
                  "slotId": "mod_stock"
                },
                {
                  "_id": "dea167d5638b4ac5f68fa7b2",
                  "_tpl": "5b2240bf5acfc40dc528af69",
                  "parentId": "kid_colt",
                  "slotId": "mod_charge"
                },
                {
                  "_id": "135ce2ca95a48efb135b03a2",
                  "_tpl": "55d3632e4bdc2d972f8b4569",
                  "parentId": "16933222072e39ece7482491",
                  "slotId": "mod_barrel"
                },
                {
                  "_id": "bdd67d29a5d2890f52aece00",
                  "_tpl": "595cfa8b86f77427437e845b",
                  "parentId": "16933222072e39ece7482491",
                  "slotId": "mod_handguard"
                },
                {
                  "_id": "99c6ada725dcb09335cc6947",
                  "_tpl": "5bc09a18d4351e003562b68e",
                  "parentId": "16933222072e39ece7482491",
                  "slotId": "mod_sight_rear",
                },
                {
                  "_id": "7c59d17f56d34c406082e108",
                  "_tpl": "5d44069ca4b9361ebd26fc37",
                  "parentId": "e03cdd2c89f91d84ebbee22c",
                  "slotId": "mod_stock_000"
                },
                {
                  "_id": "a2aaaf4d3ed34a6a680ec395",
                  "_tpl": "5cf6937cd7f00c056c53fb39",
                  "parentId": "135ce2ca95a48efb135b03a2",
                  "slotId": "mod_muzzle"
                },
                {
                  "_id": "c182324aa61417007526fb40",
                  "_tpl": "63d3ce281fe77d0f2801859e",
                  "parentId": "135ce2ca95a48efb135b03a2",
                  "slotId": "mod_gas_block"
                },
                {
                  "_id": "a1633f2045287fdd87524a5a",
                  "_tpl": "59e0bed186f774156f04ce84",
                  "parentId": "bdd67d29a5d2890f52aece00",
                  "slotId": "mod_mount_000"
                },
                {
                  "_id": "ac8e304439c2d6ecda780f01",
                  "_tpl": "59e0be5d86f7742d48765bd2",
                  "parentId": "bdd67d29a5d2890f52aece00",
                  "slotId": "mod_mount_002"
                },
                {
                  "_id": "a2b85d66f4e2b751f5eed79a",
                  "_tpl": "59e0bdb186f774156f04ce82",
                  "parentId": "bdd67d29a5d2890f52aece00",
                  "slotId": "mod_mount_004"
                },
                {
                  "_id": "89ea077e39325e5e816bc42a",
                  "_tpl": "5c17804b2e2216152006c02f",
                  "parentId": "bdd67d29a5d2890f52aece00",
                  "slotId": "mod_sight_front",
                },
                {
                  "_id": "0f7249e978094892b46e805d",
                  "_tpl": "5b057b4f5acfc4771e1bd3e9",
                  "parentId": "a1633f2045287fdd87524a5a",
                  "slotId": "mod_foregrip"
                },
                {
                    "_id": "PA_AKM",
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
                    "parentId": "PA_AKM",
                    "slotId": "mod_gas_block"
                  },
                  {
                    "_id": "f3d7bd87d6ebabbb53380749",
                    "_tpl": "64942bfc6ee699f6890dff95",
                    "parentId": "PA_AKM",
                    "slotId": "mod_muzzle"
                  },
                  {
                    "_id": "e879faf9244c842298bf803f",
                    "_tpl": "6087e663132d4d12c81fd96b",
                    "parentId": "PA_AKM",
                    "slotId": "mod_pistol_grip"
                  },
                  {
                    "_id": "c843a0243b60f0e2c124db0c",
                    "_tpl": "5d2c76ed48f03532f2136169",
                    "parentId": "PA_AKM",
                    "slotId": "mod_reciever"
                  },
                  {
                    "_id": "66e7f6646bf879a165082a6a",
                    "_tpl": "6087e2a5232e5a31c233d552",
                    "parentId": "PA_AKM",
                    "slotId": "mod_stock"
                  },
                  {
                    "_id": "833fc60819d321e760c881b0",
                    "_tpl": "59d6272486f77466146386ff",
                    "parentId": "PA_AKM",
                    "slotId": "mod_magazine"
                  },
                  {
                    "_id": "032112e60ee4eb2b74061774",
                    "_tpl": "6130ca3fd92c473c77020dbd",
                    "parentId": "PA_AKM",
                    "slotId": "mod_charge"
                  },
                  {
                    "_id": "3ad25247aaf6d993d943360e",
                    "_tpl": "59e0d99486f7744a32234762",
                    "parentId": "PA_AKM",
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
                    "_id": "GayZZer_HK",
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
                    "parentId": "GayZZer_HK",
                    "slotId": "mod_pistol_grip"
                  },
                  {
                    "_id": "8f63314d39445aaf32ad26e6",
                    "_tpl": "5c05413a0db834001c390617",
                    "parentId": "GayZZer_HK",
                    "slotId": "mod_magazine"
                  },
                  {
                    "_id": "550d0ef7da310f08bcff3d5a",
                    "_tpl": "5bb20d53d4351e4502010a69",
                    "parentId": "GayZZer_HK",
                    "slotId": "mod_reciever"
                  },
                  {
                    "_id": "d4c37979ef006adde9d8e1af",
                    "_tpl": "5bb20e58d4351e00320205d7",
                    "parentId": "GayZZer_HK",
                    "slotId": "mod_stock"
                  },
                  {
                    "_id": "691a38dc451cedefaf68f1fd",
                    "_tpl": "651bf5617b3b552ef6712cb7",
                    "parentId": "GayZZer_HK",
                    "slotId": "mod_charge"
                  },
                  {
                    "_id": "046dd58368011ebfe114be49",
                    "_tpl": "54527a984bdc2d4e668b4567",
                    "parentId": "GayZZer_HK",
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
                    "_id": "Red_WPO",
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
                    "parentId": "Red_WPO",
                    "slotId": "mod_gas_block"
                  },
                  {
                    "_id": "bafbc576f7ae3050ef78456c",
                    "_tpl": "5c878ebb2e2216001219d48a",
                    "parentId": "Red_WPO",
                    "slotId": "mod_muzzle"
                  },
                  {
                    "_id": "dccc1f2a008382ad3c5c1269",
                    "_tpl": "6087e663132d4d12c81fd96b",
                    "parentId": "Red_WPO",
                    "slotId": "mod_pistol_grip"
                  },
                  {
                    "_id": "c064de6a9575309d3d367cfb",
                    "_tpl": "59e6449086f7746c9f75e822",
                    "parentId": "Red_WPO",
                    "slotId": "mod_reciever"
                  },
                  {
                    "_id": "701ca1bdf8f67b9be571b784",
                    "_tpl": "5649d9a14bdc2d79388b4580",
                    "parentId": "Red_WPO",
                    "slotId": "mod_sight_rear",
                  },
                  {
                    "_id": "3170c24e89c9deb0d02b564d",
                    "_tpl": "5e217ba4c1434648c13568cd",
                    "parentId": "Red_WPO",
                    "slotId": "mod_stock"
                  },
                  {
                    "_id": "64a37904b4749154318ea303",
                    "_tpl": "59d625f086f774661516605d",
                    "parentId": "Red_WPO",
                    "slotId": "mod_magazine"
                  },
                  {
                    "_id": "70620e5dbb09f2b877dd9213",
                    "_tpl": "6130ca3fd92c473c77020dbd",
                    "parentId": "Red_WPO",
                    "slotId": "mod_charge"
                  },
                  {
                    "_id": "6ce12f28bc16254bff8c9201",
                    "_tpl": "64b7af734b75259c590fa895",
                    "parentId": "Red_WPO",
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
                    "_id": "Mark_G28",
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
                    "parentId": "Mark_G28",
                    "slotId": "mod_pistol_grip"
                  },
                  {
                    "_id": "81f4c2cf5af23a0e78113f36",
                    "_tpl": "617131a4568c120fdd29482d",
                    "parentId": "Mark_G28",
                    "slotId": "mod_magazine"
                  },
                  {
                    "_id": "4806b6b2a9412c28031969a6",
                    "_tpl": "617153016c780c1e710c9a2f",
                    "parentId": "Mark_G28",
                    "slotId": "mod_stock"
                  },
                  {
                    "_id": "9a5124209191b9c421502385",
                    "_tpl": "61713a8fd92c473c770214a4",
                    "parentId": "Mark_G28",
                    "slotId": "mod_reciever"
                  },
                  {
                    "_id": "267960a2016f1717a336abe8",
                    "_tpl": "61702d8a67085e45ef140b24",
                    "parentId": "Mark_G28",
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
                    "_id": "AK_Zhukov",
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
                    "parentId": "AK_Zhukov",
                    "slotId": "mod_gas_block"
                  },
                  {
                    "_id": "daf22c574b2652486fdcca53",
                    "_tpl": "64942bfc6ee699f6890dff95",
                    "parentId": "AK_Zhukov",
                    "slotId": "mod_muzzle"
                  },
                  {
                    "_id": "807e7aa9885df18e1e913a54",
                    "_tpl": "5f6341043ada5942720e2dc5",
                    "parentId": "AK_Zhukov",
                    "slotId": "mod_pistol_grip"
                  },
                  {
                    "_id": "adf5657e151af526bd391369",
                    "_tpl": "5d2c772c48f0355d95672c25",
                    "parentId": "AK_Zhukov",
                    "slotId": "mod_reciever"
                  },
                  {
                    "_id": "449d1f9901dbf16291e6910b",
                    "_tpl": "6087e2a5232e5a31c233d552",
                    "parentId": "AK_Zhukov",
                    "slotId": "mod_stock"
                  },
                  {
                    "_id": "0eecd592b0f0bee44b7b3873",
                    "_tpl": "59d6272486f77466146386ff",
                    "parentId": "AK_Zhukov",
                    "slotId": "mod_magazine"
                  },
                  {
                    "_id": "5404c51ee64af446070af6b3",
                    "_tpl": "6130ca3fd92c473c77020dbd",
                    "parentId": "AK_Zhukov",
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
                    "_id": "MP5_600EU",
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
                    "parentId": "MP5_600EU",
                    "slotId": "mod_magazine"
                  },
                  {
                    "_id": "a79ea618f142e62d7c0e6e7e",
                    "_tpl": "5926f2e086f7745aae644231",
                    "parentId": "MP5_600EU",
                    "slotId": "mod_reciever"
                  },
                  {
                    "_id": "c3d15bf36f7be7cf473416f9",
                    "_tpl": "5926c32286f774616e42de99",
                    "parentId": "MP5_600EU",
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
                    "_id": "Twhite_Kila",
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
                    "_id": "Tblack",
                    "_tpl": "5c1d0f4986f7744bb01837fa",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 1
                    }
                },
                {
                    "_id": "rsp(r)",
                    "_tpl": "62178c4d4ecf221597654e3d",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 3
                    }
                },
                {
                    "_id": "thicc_item",
                    "_tpl": "5c0a840b86f7742ffa4f2482",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 2
                    }
                },
                {
                    "_id": "thicc_item_L",
                    "_tpl": "5c0a840b86f7742ffa4f2482",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 1 
                    }
                },
                {
                    "_id": "w_thicc",
                    "_tpl": "5b6d9ce188a4501afc1b2b25",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 1 
                    }
                },
                { //* 6 leg
                  "_id": "RB_VO", //30000/5=6
                  "_tpl": "5d80c62a86f7744036212b3f",
                  "parentId": "hideout",
                  "slotId": "hideout",
                  "upd": {
                      "UnlimitedCount": true,
                      "StackObjectsCount": 1 
                  }
              },
              { //* 9 leg
                "_id": "RB_BK",
                "_tpl": "5d80c60f86f77440373c4ece",
                "parentId": "hideout",
                "slotId": "hideout",
                "upd": {
                    "UnlimitedCount": true,
                    "StackObjectsCount": 1 
                }
              },
              { //* 4 leg
                "_id": "RB_PKPM",
                "_tpl": "5ede7a8229445733cb4c18e2",
                "parentId": "hideout",
                "slotId": "hideout",
                "upd": {
                    "UnlimitedCount": true,
                    "StackObjectsCount": 1
                }
              },
              { //* 5 leg
                "_id": "314_ob",
                "_tpl": "5780cf7f2459777de4559322",
                "parentId": "hideout",
                "slotId": "hideout",
                "upd": {
                    "UnlimitedCount": true,
                    "StackObjectsCount": 1 
                }
              },
              { //* 4 leg
                "_id": "item_case",
                "_tpl": "59fb042886f7746c5005a7b2",
                "parentId": "hideout",
                "slotId": "hideout",
                "upd": {
                    "UnlimitedCount": false,
                    "StackObjectsCount": 1 
                }
              },
                {
                    "_id": "lega",
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
                "7n40": [
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
                "m433": [
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
                "Igla": [
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
                "m61": [
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
                "RGO": [
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
                "MAI_AP": [
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
                "m993": [
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
                "bs": [
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
                "lm_ap": [
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
                "LBT": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568",
                            "count": 600
                        }
                    ]
                ],
                "6sh": [
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
                "fast_black": [
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
                "slick_black": [
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
                "slick_olive": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86",
                            "count": 1
                        }
                    ]
                ],
                "slick_tan": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86",
                            "count": 1
                        }
                    ]
                ],
                "gac_5lvl": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568",
                            "count": 1850
                        }
                    ]
                ],
                "gac_5lvl_l": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86",
                          "count": 1
                      }
                  ]
              ],
                "korundvm_5lvl": [
                    [
                        {
                            "_tpl": "5f0c892565703e5c461894e9",
                            "count": 20
                        }
                    ]
                ],
                "korundvm_5lvl_l": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86",
                          "count": 1
                      }
                  ]
              ],
                "kiteco_6lvl": [
                    [
                        {
                            "_tpl": "656fae5f7c2d57afe200c0d7",
                            "count": 2
                        }
                    ]
                ],
                "kiteco_6lvl_l": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86",
                          "count": 1
                      }
                  ]
              ],
              "THOR": [
                [
                    {
                        "_tpl": "6656560053eaaa7a23349c86",
                        "count": 4
                    }
                ]
            ],
                "red_zr": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86",
                          "count": 4
                      }
                  ]
              ],
                //? ==========================WEAPON==========================
                "PM": [
                    [
                        {
                            "_tpl": "5448be9a4bdc2dfd2f8b456a", // 5d235b4d86f7742e017bc88a - gp
                            "count": 1
                        }
                    ]
                ],
                "Flir": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86",
                            "count": 2
                        }
                    ]
                ],
                "Reapir": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86",
                          "count": 3
                      }
                  ]
              ],
                "MP5_600EU": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 600
                        },
                    ]
                ],
                "mdr_7_l": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86", 
                          "count": 1
                      },
                  ]
              ],
                "mdr_7": [
                  [
                      {
                          "_tpl": "569668774bdc2da2298b4568", 
                          "count": 2000
                      },
                  ]
              ],
                "kid_colt": [
                  [
                      {
                          "_tpl": "569668774bdc2da2298b4568", 
                          "count": 2000
                      },
                  ]
              ],
                "AK_Zhukov": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 1900
                        },
                    ]
                ],
                "Mark_G28": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 2900
                        },
                    ]
                ],
                "GayZZer_HK": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 2600
                        },
                    ]
                ],
                "PA_AKM": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 2400
                        },
                    ]
                ],
                "Red_WPO": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 950
                        },
                    ]
                ],
                //? ==========================OTHER===========================
                "Twhite_Kila": [
                    [
                        {
                            "_tpl": "5c0e874186f7745dc7616606",
                            "count": 2
                        }
                    ]
                ],
                "Tblack": [
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
                "rsp(r)": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86",
                            "count": 1
                        }
                    ]
                ],
                "thicc_item": [
                    [
                        {
                            "_tpl": "59faff1d86f7746c51718c9c",
                            "count": 40
                        }
                    ]
                ],
                "w_thicc": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86",
                            "count": 6
                        }
                    ]
                ],
                "thicc_item_L": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86", 
                            "count": 20
                        }
                    ]
                ],
                "RB_VO": [
                    [
                        {
                            "_tpl": "6656560053eaaa7a23349c86", 
                            "count": 6
                        }
                    ]
                ],
                "RB_BK": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86", 
                          "count": 9
                      }
                  ]
              ],
              "RB_PKPM": [
                  [
                      {
                          "_tpl": "6656560053eaaa7a23349c86", 
                          "count": 4
                      }
                  ]
              ],
              "314_ob": [
                [
                    {
                        "_tpl": "6656560053eaaa7a23349c86", 
                        "count": 5
                    }
                ]
            ],
            "item_case": [
              [
                  {
                      "_tpl": "6656560053eaaa7a23349c86", 
                      "count": 4
                  }
              ]
          ],
                "lega": [
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
              "PM":1,
              "RGO":1,
              "6sh":1,
              "lega":1,
              "MP5_600EU":1,
              "Red_WPO":1,
              "item_case":1,
              "korundvm_5lvl_l":1,
              "gac_5lvl_l":1,
              "mdr_7_l":1,
              //* === LVL2 ===
              "AK_Zhukov":2,
              "PA_AKM":2,
              "Mark_G28":2,
              "GayZZer_HK":2,
              "Twhite_Kila":2,
              "Tblack":2,
              "7n40":2,
              "m433":2,
              "Igla":2,
              "slick_black":2,
              "slick_olive":2,
              "slick_tan":2,
              "LBT":2,
              "gac_5lvl":2,
              "korundvm_5lvl":2,
              "RB_VO":2,
              "RB_BK":2,
              "314_ob":2,
              "RB_PKPM":2,
              "kid_colt":2,
              "mdr_7":2,
              //* === LVL3 ===
              "m61":3,
              "MAI_AP":3,
              "m993":3,
              "bs":3,
              "lm_ap":3,
              "rsp(r)": 3,
              "thicc_item_L": 3,
              "kiteco_6lvl":3,
              "kiteco_6lvl_l":3,
              "Flir":3,
              "Reapir":3,
              "w_thicc":3,
              "red_zr":3,
              "THOR":3,
              "fast_black": 3,
              //* === LVL4 ===
              "thicc_item":4
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