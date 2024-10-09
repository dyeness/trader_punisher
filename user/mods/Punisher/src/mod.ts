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
        this.logger.info("Punisher ACTIVE");
        
        //Meta crap i guess
        this.registerProfileImage(preSptModLoader, imageRouter);
        this.setTraderUpdateTime(traderConfig, baseJson, 3600, 4000);
        
        this.logger.debug(`[${this.mod}] preSpt Loaded`);

        // Add trader to trader enum
        Traders[baseJson._id] = baseJson._id;
        // Add trader to flea market
        ragfairConfig.traders[baseJson._id] = false;

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
                    "_id": "kiteco_6lvl",
                    "_tpl": "656fafe3498d1b7e3e071da4",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 4
                    }
                },
                //? ==========================WEAPON==========================
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
                            "count": 50
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
                            "count": 3
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
                            "count": 3
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
                            "count": 1
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
                            "count": 2
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
                            "count": 1
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
                            "count": 3
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
                            "count": 3
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
                            "count": 1500
                        }
                    ]
                ],
                "korundvm_5lvl": [
                    [
                        {
                            "_tpl": "5f0c892565703e5c461894e9",
                            "count": 10
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
                "MP5_600EU": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 600
                        },
                    ]
                ],
                "AK_Zhukov": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 1450
                        },
                    ]
                ],
                "Mark_G28": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 2200
                        },
                    ]
                ],
                "GayZZer_HK": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 2750
                        },
                    ]
                ],
                "PA_AKM": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 2550
                        },
                    ]
                ],
                "Red_WPO": [
                    [
                        {
                            "_tpl": "569668774bdc2da2298b4568", 
                            "count": 550
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
                            "count": 1
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
                "lega": [
                    [
                        {
                            "_tpl": "59faff1d86f7746c51718c9c", 
                            "count": 2
                        }
                    ]
                ]
            },
            "loyal_level_items": {
                //* === LVL1 ===
                "PM":1,
                "RGO":1,
                "6sh":1,
                "lega":1,
                "MP5_600EU":1,
                "Red_WPO":1,
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
                //* === LVL3 ===
                "m61":3,
                "MAI_AP":3,
                "m993":3,
                "bs":3,
                "lm_ap":3,
                "rsp(r)": 3,
                "thicc_item_L": 3,
                "kiteco_6lvl":3,
                "Flir":3,
                "w_thicc":3,
                //* === LVL4 ===
                "fast_black": 4,
                "thicc_item":4
            }
        }
        return assortTable;
    }

         //Custom Presets -- Add Presets in /db/presets.json
        /*//Build the Presets in-game, then export them to the presets.json, then format accordingly.
        const PunisherGunPreset = WeaponPreset.ItemPresets["TM_cc7d623412685ff3cdcf3684"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, PunisherGunPreset, false, 2, 4, Money.EUROS, 800); //LL4
        const worgenGunPreset = WeaponPreset.ItemPresets["TM_4122ee65dba464cc331fc561"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, worgenGunPreset, false, 1, 4, Money.EUROS, 3000); //LL4
        const volkGunPreset = WeaponPreset.ItemPresets["TM_9ec2a50629b619a9369a39b8"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, volkGunPreset, false, 3, 2, Money.EUROS, 750); //LL2
        const falGunPreset = WeaponPreset.ItemPresets["TM_d45232f69adf456ce15ea7c5"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, falGunPreset, false, 1, 4, Money.EUROS, 1100); //LL4
        const P226RGunPreset = WeaponPreset.ItemPresets["TM_48024b9027ee65a48187256a"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, P226RGunPreset, false, 2, 2, Money.EUROS, 220); //LL2

        //Mags
        const STANAG_ID = "55d4887d4bdc2d962f8b4570";
        this.addSingleItemToAssort(assortTable, STANAG_ID, false, 30, 1, Money.EUROS, 9);
        const FALMAG_ID = "5b7d37845acfc400170e2f87";
        this.addSingleItemToAssort(assortTable, FALMAG_ID, false, 10, 3, Money.EUROS, 42); //LL3
        const G36MAG_ID = "62307b7b10d2321fa8741921";
        this.addSingleItemToAssort(assortTable, G36MAG_ID, false, 30, 1, Money.EUROS, 24);
        const MAG20_ID = "5448c1d04bdc2dff2f8b4569";
        this.addSingleItemToAssort(assortTable, MAG20_ID, false, 5, 1, Money.EUROS, 18);
        const MPXMAG_ID = "5894a05586f774094708ef75";
        this.addSingleItemToAssort(assortTable, MPXMAG_ID, false, 5, 1, Money.EUROS, 16);
        const P226M_ID = "56d59948d2720bb7418b4582";
        this.addSingleItemToAssort(assortTable, P226M_ID, false, 25, 1, Money.EUROS, 14);
        const G28MAG_ID = "617131a4568c120fdd29482d";
        this.addSingleItemToAssort(assortTable, G28MAG_ID, false, 4, 4, Money.EUROS, 100); //LL4
        const PMAG_ID = "55802d5f4bdc2dac148b458e";
        this.addSingleItemToAssort(assortTable, PMAG_ID, false, 10, 2, Money.EUROS, 25); //LL2
        const P90MAG_ID = "5cc70093e4a949033c734312";
        this.addSingleItemToAssort(assortTable, P90MAG_ID, false, 3, 2, Money.EUROS, 75); //LL2
        const HK_STANAG_ID = "5c05413a0db834001c390617";
        this.addSingleItemToAssort(assortTable, HK_STANAG_ID, false, 20, 1, Money.EUROS, 14);
        const AK101MAG_ID = "5ac66c5d5acfc4001718d314";
        this.addSingleItemToAssort(assortTable, AK101MAG_ID, false, 20, 2, Money.EUROS, 16); //LL2


        //Parts
        const ACOG_ID = "59db7e1086f77448be30ddf3";
        this.addSingleItemToAssort(assortTable, ACOG_ID, false, 1, 1, Money.EUROS, 200);
        const SIL1_ID = "5a9fbb84a2750c00137fa685";
        this.addSingleItemToAssort(assortTable, SIL1_ID, false, 2, 1, Money.EUROS, 360);
        const PRISM_ID = "5c1cdd512e22161b267d91ae";
        this.addSingleItemToAssort(assortTable, PRISM_ID, false, 2, 1, Money.EUROS, 150);
        const PRISM2_ID = "5d2dc3e548f035404a1a4798";
        this.addSingleItemToAssort(assortTable, PRISM2_ID, false, 2, 2, Money.EUROS, 200); //LL2
        const EOTECH_ID = "5c07dd120db834001c39092d";
        this.addSingleItemToAssort(assortTable, EOTECH_ID, false, 2, 1, Money.EUROS, 300);
        const KIBA_ID = "5c1cdd302e221602b3137250";
        this.addSingleItemToAssort(assortTable, KIBA_ID, false, 5, 1, Money.EUROS, 10);
        const G36VENT_ID = "62386b7153757417e93a4e9f";
        this.addSingleItemToAssort(assortTable, G36VENT_ID, false, 3, 1, Money.EUROS, 40);
        const G36BARREL_ID = "622b3858034a3e17ad0b81f5";
        this.addSingleItemToAssort(assortTable, G36BARREL_ID, false, 2, 1, Money.EUROS, 125);
        const G36SMOUNT_ID = "622b3c081b89c677a33bcda6";
        this.addSingleItemToAssort(assortTable, G36SMOUNT_ID, false, 1, 1, Money.EUROS, 32);
        const G36SMOUNT2_ID = "622b3d5cf9cfc87d675d2de9";
        this.addSingleItemToAssort(assortTable, G36SMOUNT2_ID, false, 2, 1, Money.EUROS, 22);
        const G36BIPOD_ID = "622b397c9a3d4327e41843b6";
        this.addSingleItemToAssort(assortTable, G36BIPOD_ID, false, 2, 1, Money.EUROS, 30);
        const G36FRONT_ID = "623166e08c43374ca1567195";
        this.addSingleItemToAssort(assortTable, G36FRONT_ID, false, 5, 1, Money.EUROS, 15);
        const G36REAR_ID = "6231670f0b8aa5472d060095";
        this.addSingleItemToAssort(assortTable, G36REAR_ID, false, 5, 1, Money.EUROS, 15);
        const SA58BEL = "5b7d671b5acfc43d82528ddd";
        this.addSingleItemToAssort(assortTable, SA58BEL, false, 1, 3, Money.EUROS, 24); //LL3
        const SA58STOCK = "5b7d63cf5acfc4001876c8df";
        this.addSingleItemToAssort(assortTable, SA58STOCK, false, 2, 3, Money.EUROS, 120); //LL3
        const SA58BARREL = "5b7be1265acfc400161d0798";
        this.addSingleItemToAssort(assortTable, SA58BARREL, false, 1, 3, Money.EUROS, 225); //LL3
        const SA58BRAKE = "5b7d68af5acfc400170e30c3";
        this.addSingleItemToAssort(assortTable, SA58BRAKE, false, 3, 3, Money.EUROS, 15); //LL3
        const M3STOCK = "625eb0faa6e3a82193267ad9";
        this.addSingleItemToAssort(assortTable, M3STOCK, false, 2, 2, Money.EUROS, 45); //LL2
        const M3TUBE = "6259bdcabd28e4721447a2aa";
        this.addSingleItemToAssort(assortTable, M3TUBE, false, 1, 2, Money.EUROS, 15); //LL2
        const HKE1_ID = "5c87a07c2e2216001219d4a2";
        this.addSingleItemToAssort(assortTable, HKE1_ID, false, 2, 1, Money.EUROS, 105);
        const HKGRIFF_ID = "619386379fb0c665d5490dbe";
        this.addSingleItemToAssort(assortTable, HKGRIFF_ID, false, 4, 1, Money.EUROS, 30);
        const SIL2MZZL556_ID = "5c7e5f112e221600106f4ede";
        this.addSingleItemToAssort(assortTable, SIL2MZZL556_ID, false, 4, 1, Money.EUROS, 88);
        const SIL2_ID = "5a34fe59c4a282000b1521a2";
        this.addSingleItemToAssort(assortTable, SIL2_ID, false, 2, 1, Money.EUROS, 508);
        const HK416A5_FLIPRAIL_ID = "5bb20df1d4351e00347787d5";
        this.addSingleItemToAssort(assortTable, HK416A5_FLIPRAIL_ID, false, 1, 2, Money.EUROS, 74); //LL2
        const HK416A5_LONGRAIL_ID = "5bb20dfcd4351e00334c9e24";
        this.addSingleItemToAssort(assortTable, HK416A5_LONGRAIL_ID, false, 1, 2, Money.EUROS, 107); //LL2
        const HK416A5_11BARREL_ID = "5bb20d92d4351e00853263eb";
        this.addSingleItemToAssort(assortTable, HK416A5_11BARREL_ID, false, 1, 2, Money.EUROS, 178); //LL2
        const HK416A5_20Barrel_ID = "5bb20dadd4351e00367faeff";
        this.addSingleItemToAssort(assortTable, HK416A5_20Barrel_ID, false, 1, 2, Money.EUROS, 345); //LL2
        const G36WELL_ID = "622f039199f4ea1a4d6c9a17";
        this.addSingleItemToAssort(assortTable, G36WELL_ID, false, 5, 1, Money.EUROS, 17);

        //Ammo
        const M80_ID = "58dd3ad986f77403051cba8f";
        this.addSingleItemToAssort(assortTable, M80_ID, false, 30, 2, Money.EUROS, 6); //LL2
        const FMJSIG_ID = "6529302b8c26af6326029fb7";
        this.addSingleItemToAssort(assortTable, FMJSIG_ID, true, 999999, 2, Money.EUROS, 5); //LL2
        const LPS_ID = "5887431f2459777e1612938f";
        this.addSingleItemToAssort(assortTable, LPS_ID, false, 30, 2, Money.EUROS, 6); //LL2
        const M855A1_ID = "54527ac44bdc2d36668b4567";
        this.addSingleItemToAssort(assortTable, M855A1_ID, false, 90, 3, Money.EUROS, 10); //LL3
        const MAG338_ID = "5fc275cf85fd526b824a571a";
        this.addSingleItemToAssort(assortTable, MAG338_ID, false, 20, 4, Money.EUROS, 30); //LL4
        const M993_ID = "5efb0c1bd79ff02a1f5e68d9";
        this.addSingleItemToAssort(assortTable, M993_ID, false, 20, 4, Money.EUROS, 25); //LL4
        const SX_ID = "5ba2678ad4351e44f824b344";
        this.addSingleItemToAssort(assortTable, SX_ID, false, 90, 2, Money.EUROS, 4); //LL2
        const AP63_ID = "5c925fa22e221601da359b7b";
        this.addSingleItemToAssort(assortTable, AP63_ID, false, 120, 2, Money.EUROS, 4); //LL2
        const M67_ID = "58d3db5386f77426186285a0";
        this.addSingleItemToAssort(assortTable, M67_ID, false, 3, 1, Money.EUROS, 50);
        const M855_ID = "54527a984bdc2d4e668b4567";
        this.addSingleItemToAssort(assortTable, M855_ID, true, 999999, 2, Money.EUROS, 2); //LL2
        const FMJ556_ID = "59e6920f86f77411d82aa167";
        this.addSingleItemToAssort(assortTable, FMJ556_ID, true, 999999, 1, Money.EUROS, 1);
        const AP20_ID = "5d6e68a8a4b9360b6c0d54e2";
        this.addSingleItemToAssort(assortTable, AP20_ID, false, 20, 3, Money.EUROS, 30); //LL3
        const SH65M_ID = "5d6e67fba4b9361bc73bc779";
        this.addSingleItemToAssort(assortTable, SH65M_ID, true, 999999, 1, Money.EUROS, 1);
        const APERS_ID = "5ede475339ee016e8c534742";
        this.addSingleItemToAssort(assortTable, APERS_ID, false, 10, 2, Money.EUROS, 20); //LL2
        const M441_ID = "5ede47405b097655935d7d16";
        this.addSingleItemToAssort(assortTable, M441_ID, false, 3, 3, Money.EUROS, 200); //LL3
        const M18_ID = "617aa4dd8166f034d57de9c5";
        this.addSingleItemToAssort(assortTable, M18_ID, false, 8, 1, Money.EUROS, 20);
        const SS19_ID = "5cc80f8fe4a949033b0224a2";
        this.addSingleItemToAssort(assortTable, SS19_ID, true, 999999, 1, Money.EUROS, 2);
        const L191_ID = "5cc80f53e4a949000e1ea4f8";
        this.addSingleItemToAssort(assortTable, L191_ID, false, 100, 2, Money.EUROS, 10); //LL2
        const MATCH45_ID = "5e81f423763d9f754677bf2e";
        this.addSingleItemToAssort(assortTable, MATCH45_ID, true, 999999, 1, Money.EUROS, 1);
        const FMJ9MM_ID = "64b7bbb74b75259c590fa897";
        this.addSingleItemToAssort(assortTable, FMJ9MM_ID, true, 999999, 1, Money.EUROS, 3);
        const VMAX_ID = "6196364158ef8c428c287d9f";
        this.addSingleItemToAssort(assortTable, VMAX_ID, true, 999999, 1, Money.EUROS, 1);
        const BKOM62_ID = "619636be6db0f2477964e710";
        this.addSingleItemToAssort(assortTable, BKOM62_ID, false, 90, 2, Money.EUROS, 3); //LL2
        const M995_ID = "59e690b686f7746c9f75e848";
        this.addSingleItemToAssort(assortTable, M995_ID, false, 30, 4, Money.EUROS, 30); //LL4

        
        //Gear
        const AFG_ID = "59e770b986f7742cbd762754";
        this.addSingleItemToAssort(assortTable, AFG_ID, false, 5, 1, Money.EUROS, 23);
        const VIS_ID = "5a16b672fcdbcb001912fa83";
        this.addSingleItemToAssort(assortTable, VIS_ID, false, 5, 2, Money.EUROS, 80); //LL2
        const RESP_ID = "59e7715586f7742ee5789605";
        this.addSingleItemToAssort(assortTable, RESP_ID, false, 5, 1, Money.EUROS, 100);
        const BLKRK_ID = "5648a69d4bdc2ded0b8b457b";
        this.addSingleItemToAssort(assortTable, BLKRK_ID, false, 2, 1, Money.EUROS, 500);
        const COM2_ID = "5645bcc04bdc2d363b8b4572";
        this.addSingleItemToAssort(assortTable, COM2_ID, false, 1, 1, Money.EUROS, 300);
        const T20_ID = "618bb76513f5097c8d5aa2d5";
        this.addSingleItemToAssort(assortTable, T20_ID, false, 1, 2, Money.EUROS, 300); //LL2
        const TRANS_ID = "56e33680d2720be2748b4576";
        this.addSingleItemToAssort(assortTable, TRANS_ID, false, 5, 1, Money.EUROS, 15);
        const HALFMASK_ID = "572b7fa524597762b747ce82";
        this.addSingleItemToAssort(assortTable, HALFMASK_ID, false, 10, 1, Money.EUROS, 20);
        const OAK_ID = "5c1a1cc52e221602b3136e3d";
        this.addSingleItemToAssort(assortTable, OAK_ID, false, 10, 1, Money.EUROS, 35);
        const THERMAL_ID  = "5c110624d174af029e69734c";
        this.addSingleItemToAssort(assortTable, THERMAL_ID, false, 1, 4, Money.EUROS, 9500); //LL4
        const BLACKCOM_ID  = "5b44c8ea86f7742d1627baf1";
        this.addSingleItemToAssort(assortTable, BLACKCOM_ID, false, 2, 1, Money.EUROS, 175);
        const SLING_ID  = "5ab8f04f86f774585f4237d8";
        this.addSingleItemToAssort(assortTable, SLING_ID, false, 10, 1, Money.EUROS, 10);
        const CROSS_ID  = "5d5fca1ea4b93635fd598c07";
        this.addSingleItemToAssort(assortTable, CROSS_ID, false, 10, 1, Money.EUROS, 20);
        const MOMEX_ID  = "5b432f3d5acfc4704b4a1dfb";
        this.addSingleItemToAssort(assortTable, MOMEX_ID, false, 10, 1, Money.EUROS, 20);

        //Plates
        const SAPI_ID  = "655746010177119f4a097ff7";
        this.addSingleItemToAssort(assortTable, SAPI_ID, false, 2, 4, Money.EUROS, 1000); //LL4
        const MONO_ID  = "656fad8c498d1b7e3e071da0";
        this.addSingleItemToAssort(assortTable, MONO_ID, false, 4, 3, Money.EUROS, 500); //LL3

        //Misc
        const GPU_ID = "57347ca924597744596b4e71";
        this.addSingleItemToAssort(assortTable, GPU_ID, false, 1, 3, Money.EUROS, 1500); //LL3
        const WIRE_ID = "5c06779c86f77426e00dd782";
        this.addSingleItemToAssort(assortTable, WIRE_ID, false, 16, 1, Money.EUROS, 75);
        const LUBE_ID = "5bc9b355d4351e6d1509862a";
        this.addSingleItemToAssort(assortTable, LUBE_ID, false, 16, 1, Money.EUROS, 200);
        const FUEL_ID = "5d1b36a186f7742523398433";
        this.addSingleItemToAssort(assortTable, FUEL_ID, false, 2, 2, Money.EUROS, 350); //LL2
        const OFZ_ID = "5d0379a886f77420407aa271";
        this.addSingleItemToAssort(assortTable, OFZ_ID, false, 8, 2, Money.EUROS, 500); //LL2
        const GAS_ID = "590c595c86f7747884343ad7";
        this.addSingleItemToAssort(assortTable, GAS_ID, false, 4, 1, Money.EUROS, 230);
        const TOOL_ID = "590c2e1186f77425357b6124";
        this.addSingleItemToAssort(assortTable, TOOL_ID, false, 2, 1, Money.EUROS, 299);
        const KITE_ID = "590c5a7286f7747884343aea";
        this.addSingleItemToAssort(assortTable, KITE_ID, false, 2, 1, Money.EUROS, 90);
        const HAWK_ID = "5d6fc87386f77449db3db94e";
        this.addSingleItemToAssort(assortTable, HAWK_ID, false, 2, 3, Money.EUROS, 220); //LL3
        const EAGLE_ID = "5d6fc78386f77449d825f9dc";
        this.addSingleItemToAssort(assortTable, EAGLE_ID, false, 2, 2, Money.EUROS, 190); //LL2
        const ZIPPO_ID = "56742c2e4bdc2d95058b456d";
        this.addSingleItemToAssort(assortTable, ZIPPO_ID, false, 3, 1, Money.EUROS, 25);
        const PMEDS_ID = "5d1b3a5d86f774252167ba22";
        this.addSingleItemToAssort(assortTable, PMEDS_ID, false, 30, 1, Money.EUROS, 25);
        const MEDT_ID = "619cc01e0a7c3a1a2731940c";
        this.addSingleItemToAssort(assortTable, MEDT_ID, false, 10, 1, Money.EUROS, 40);
        const MILTUBE_ID = "619cbf476b8a1b37a54eebf8";
        this.addSingleItemToAssort(assortTable, MILTUBE_ID, false, 5, 2, Money.EUROS, 150); //LL2
        const RATP_ID = "60b0f561c4449e4cb624c1d7";
        this.addSingleItemToAssort(assortTable, RATP_ID, false, 3, 1, Money.EUROS, 270);
        const GBAT_ID = "5e2aedd986f7746d404f3aa4";
        this.addSingleItemToAssort(assortTable, GBAT_ID, false, 4, 1, Money.EUROS, 500);
        const ACDC_ID = "6389c85357baa773a825b356";
        this.addSingleItemToAssort(assortTable, ACDC_ID, false, 1, 4, Money.EUROS, 20000); //LL4
        const MILCAB_ID = "5d0375ff86f774186372f685";
        this.addSingleItemToAssort(assortTable, MILCAB_ID, false, 2, 3, Money.EUROS, 300); //LL3
        const PCB_ID = "590a3b0486f7743954552bdb";
        this.addSingleItemToAssort(assortTable, PCB_ID, false, 3, 1, Money.EUROS, 200);
        const MDYKES_ID = "5d40419286f774318526545f";
        this.addSingleItemToAssort(assortTable, MDYKES_ID, false, 1, 1, Money.EUROS, 175);
        const TP200_ID = "60391b0fb847c71012789415";
        this.addSingleItemToAssort(assortTable, TP200_ID, false, 1, 2, Money.EUROS, 250); //LL2
        const THERMITE_ID = "60391a8b3364dc22b04d0ce5";
        this.addSingleItemToAssort(assortTable, THERMITE_ID, false, 2, 4, Money.EUROS, 500); //LL4
        const LABS_ID = "5c94bbff86f7747ee735c08f";
        this.addSingleItemToAssort(assortTable, LABS_ID, false, 1, 4, Money.EUROS, 2500); //LL4


        //Medical
        const SURV_ID = "5d02797c86f774203f38e30a";
        this.addSingleItemToAssort(assortTable, SURV_ID, false, 1, 3, Money.EUROS, 750); //LL3
        const IFAK_ID = "590c678286f77426c9660122";
        this.addSingleItemToAssort(assortTable, IFAK_ID, false, 3, 1, Money.EUROS, 175);
        const CMS_ID = "5d02778e86f774203e7dedbe";
        this.addSingleItemToAssort(assortTable, CMS_ID, false, 3, 1, Money.EUROS, 250);
        const CALOK_ID = "5e8488fa988a8701445df1e4";
        this.addSingleItemToAssort(assortTable, CALOK_ID, false, 6, 2, Money.EUROS, 100); //LL2

        //Cases
        const AMM_ID = "5aafbde786f774389d0cbc0f";
        this.addSingleItemToAssort(assortTable, AMM_ID, false, 1, 2, Money.EUROS, 2100); //LL2
        const GREN_ID = "5e2af55f86f7746d4159f07c";
        this.addSingleItemToAssort(assortTable, GREN_ID, false, 1, 1, Money.EUROS, 1500);
        const MON_ID = "59fb016586f7746d0d4b423a";
        this.addSingleItemToAssort(assortTable, MON_ID, false, 1, 1, Money.EUROS, 2800);
        const DOC_ID = "590c60fc86f77412b13fddcf";
        this.addSingleItemToAssort(assortTable, DOC_ID, false, 1, 2, Money.EUROS, 1250); //LL2
        const GINGY_ID = "62a09d3bcf4a99369e262447";
        this.addSingleItemToAssort(assortTable, GINGY_ID, false, 1, 1, Money.EUROS, 50);

        //Food
        const COLA_ID = "57514643245977207f2c2d09";
        this.addSingleItemToAssort(assortTable, COLA_ID, false, 30, 1, Money.EUROS, 25);
        const DAN_ID = "5d403f9186f7743cac3f229b";
        this.addSingleItemToAssort(assortTable, DAN_ID, false, 15, 1, Money.EUROS, 200);
        const MRE_ID = "590c5f0d86f77413997acfab";
        this.addSingleItemToAssort(assortTable, MRE_ID, false, 15, 2, Money.EUROS, 100); //LL2
        const CRACK_ID = "5448ff904bdc2d6f028b456e";
        this.addSingleItemToAssort(assortTable, CRACK_ID, false, 30, 1, Money.EUROS, 25);
        const WATER_ID = "5448fee04bdc2dbc018b4567";
        this.addSingleItemToAssort(assortTable, WATER_ID, false, 15, 2, Money.EUROS, 100); //LL2

        //Conversion
        const USD_ID = "5696686a4bdc2da3298b456a";
        this.addSingleItemToAssort(assortTable, USD_ID, true, 25000000, 1, Money.EUROS, 1);
        const EURO_ID = "569668774bdc2da2298b4568";
        this.addSingleItemToAssort(assortTable, EURO_ID, true, 25000000, 1, Money.DOLLARS, 1);
        
        //Guns
        // Get the G36 preset and add to the traders assort (Could make your own Items[] array, doesnt have to be presets)
        const g36GunPreset = tables.globals.ItemPresets["6297738b9f1b474e440c45b5"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, g36GunPreset, false, 2, 1, Money.EUROS, 484);

        const g36cGunPreset = tables.globals.ItemPresets["629774055c32d414f8797477"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, g36cGunPreset, false, 2, 1, Money.EUROS, 520);

        const sa58bGunPreset = tables.globals.ItemPresets["5b439b5686f77428bd137424"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, sa58bGunPreset, false, 2, 3, Money.EUROS, 999); //LL3

        const hk416GunPreset = tables.globals.ItemPresets["5c0d1e9386f77440120288b7"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, hk416GunPreset, false, 2, 2, Money.EUROS, 720); //LL2

        const augGunPreset = tables.globals.ItemPresets["6398636bb483a550805be5e5"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, augGunPreset, false, 2, 2, Money.EUROS, 490); //LL2

        const p226GunPreset = tables.globals.ItemPresets["584149242459775a7726350a"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, p226GunPreset, false, 5, 1, Money.EUROS, 80);

        const m4specGunPreset = tables.globals.ItemPresets["5ebbfe23ba87a5065a00a563"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, m4specGunPreset, false, 1, 3, Money.EUROS, 2250); //LL3

        const mpxGunPreset = tables.globals.ItemPresets["58dffca786f774083a256ab1"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, mpxGunPreset, false, 1, 1, Money.EUROS, 345);

        const g28GunPreset = tables.globals.ItemPresets["6193e590069d61205d490dd8"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, g28GunPreset, false, 1, 4, Money.EUROS, 2800); //LL4
        
        const m3GunPreset = tables.globals.ItemPresets["62975de85c32d414f8797433"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, m3GunPreset, false, 1, 2, Money.EUROS, 290); //LL2

        const p90GunPreset = tables.globals.ItemPresets["5d2340e986f77461496241bc"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, p90GunPreset, false, 1, 2, Money.EUROS, 2000); //LL2

        const MCXGunPreset = tables.globals.ItemPresets["657eb3773271d8578610fe28"]._items;
        this.addCollectionToAssort(jsonUtil, assortTable, MCXGunPreset, false, 1, 2, Money.EUROS, 2500); //LL2

        return assortTable;
    }*/

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