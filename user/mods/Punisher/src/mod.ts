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
                {
                    "_id": "slick_black",
                    "_tpl": "5e4abb5086f77406975c9342",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 1
                    }
                },
                {
                    "_id": "slick_olive",
                    "_tpl": "6038b4ca92ec1c3103795a0d",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 1
                    }
                },
                {
                    "_id": "slick_tan",
                    "_tpl": "6038b4b292ec1c3103795a0b",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 1
                    }
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
                        "UnlimitedCount": false,
                        "StackObjectsCount": 99999
                    }
                },
                {
                    "_id": "Flir",
                    "_tpl": "5d1b5e94d7ad1a2b865a96b0",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 99999
                    }
                },
                //? ==========================OTHER===========================
                {
                    "_id": "Twhite_Kila",
                    "_tpl": "5c94bbff86f7747ee735c08f",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 1
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
                            "count": 600
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
                "Lega":1,
                //* === LVL2 ===
                "Flir":2,
                "Twhite_Kila":2,
                "Tblack":2,
                "7n40":2,
                "m433":2,
                "Igla":2,
                "slick_black":2,
                "slick_olive":2,
                "slick_tan":2,
                //* === LVL3 ===
                "LBT":3,
                "m61":3,
                "MAI_AP":3,
                "m993":3,
                "bs":3,
                "lm_ap":3,
                "rsp(r)": 3,
                "thicc_item":3,
                "gac_5lvl":3,
                "korundvm_5lvl":3,
                //* === LVL4 ===
                "kiteco_6lvl":4,
                "thicc_item_L": 4,
                "fast_black": 4
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