"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ConfigTypes_1 = require("C:/snapshot/project/obj/models/enums/ConfigTypes");
const Traders_1 = require("C:/snapshot/project/obj/models/enums/Traders");
//import custom JSON Files
//import * as WeaponPreset from "../db/presets.json";
// New trader settings
const baseJson = require("../db/base.json");
class Punisher {
    mod;
    logger;
    //private configServer: ConfigServer;
    //private ragfairConfig: IRagfairConfig; 
    constructor() {
        this.mod = "Punisher"; // Set name of mod so we can log it to console later
    }
    /**
     * Some work needs to be done prior to SPT code being loaded, registering the profile image + setting trader update time inside the trader config json
     * @param container Dependency container
     */
    preSptLoad(container) {
        //Get a Logger
        this.logger = container.resolve("WinstonLogger");
        this.logger.debug(`[${this.mod}] preSpt Loading... `);
        //Get SPT Code
        const preSptModLoader = container.resolve("PreSptModLoader");
        const imageRouter = container.resolve("ImageRouter");
        const configServer = container.resolve("ConfigServer");
        const traderConfig = configServer.getConfig(ConfigTypes_1.ConfigTypes.TRADER);
        const ragfairConfig = configServer.getConfig(ConfigTypes_1.ConfigTypes.RAGFAIR);
        //Custom Logger, Don't worry it's fake bullshit for flair
        this.logger.info("[Punisher] CONNECTED");
        //Meta crap i guess
        this.registerProfileImage(preSptModLoader, imageRouter);
        this.setTraderUpdateTime(traderConfig, baseJson, 3600, 4000);
        this.logger.debug(`[${this.mod}] preSpt Loaded`);
        // Add trader to trader enum
        Traders_1.Traders[baseJson._id] = baseJson._id;
        // Add trader to flea market
        ragfairConfig.traders[baseJson._id] = false;
    }
    /**
     * Majority of trader-related work occurs after the aki database has been loaded but prior to SPT code being run
     * @param container Dependency container
     */
    postDBLoad(container) {
        this.logger.debug(`[${this.mod}] postDb Loading... `);
        // Resolve SPT classes we'll use
        const databaseServer = container.resolve("DatabaseServer");
        const jsonUtil = container.resolve("JsonUtil");
        // Get a reference to the database tables
        const tables = databaseServer.getTables();
        // Add new trader to the trader dictionary in DatabaseServer
        this.addTraderToDb(baseJson, tables, jsonUtil);
        this.addTraderToLocales(tables, baseJson.name, "Punisher", baseJson.nickname, baseJson.location, "Where there's conflict, there's profit. I have a lot of clients; Servicemen, Scientists, Cultists, and the Lonely Wanderers, I can certainly find you a buyer, or perhaps, you're interested in our supplies? We might have a few things lying around you'll like.");
        this.logger.debug(`[${this.mod}] postDb Loaded`);
    }
    /**
     * Add profile picture to our trader
     * @param preSptModLoader mod loader class - used to get the mods file path
     * @param imageRouter image router class - used to register the trader image path so we see their image on trader page
     */
    registerProfileImage(preSptModLoader, imageRouter) {
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
    setTraderUpdateTime(traderConfig, baseJson, refreshTimeSecondsMin, refreshTimeSecondsMax) {
        // Add refresh time in seconds to config
        const traderRefreshRecord = {
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
    addTraderToDb(traderDetailsToAdd, tables, jsonUtil) {
        // Add trader to trader table, key is the traders id
        tables.traders[traderDetailsToAdd._id] = {
            assort: this.createAssortTable(tables, jsonUtil), // assorts are the 'offers' trader sells, can be a single item (e.g. carton of milk) or multiple items as a collection (e.g. a gun)
            base: jsonUtil.deserialize(jsonUtil.serialize(traderDetailsToAdd)),
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
    createAssortTable(tables, jsonUtil) {
        // Create a blank assort object, ready to have items added
        const assortTable = {
            nextResupply: 0,
            items: [
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
                    "_id": "Flir",
                    "_tpl": "5d1b5e94d7ad1a2b865a96b0",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 99999
                    }
                },
                {
                    "_id": "RGO",
                    "_tpl": "618a431df1eb8e24b8741deb",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 4
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
                    "_id": "Twhite",
                    "_tpl": "5c94bbff86f7747ee735c08f",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": false,
                        "StackObjectsCount": 1
                    }
                },
                {
                    "_id": "7n40",
                    "_tpl": "64898602f09d032aa9399d56",
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
                    "_tpl": "657025ebc5d7d4cb4d078588",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 99999
                    }
                },
                {
                    "_id": "m61",
                    "_tpl": "6570254fcfc010a0f5006a22",
                    "parentId": "hideout",
                    "slotId": "hideout",
                    "upd": {
                        "UnlimitedCount": true,
                        "StackObjectsCount": 99999
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
                        "StackObjectsCount": 1
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
                }
            ],
            "barter_scheme": {
                "PM": [
                    [
                        {
                            "_tpl": "5d235b4d86f7742e017bc88a",
                            "count": 1
                        }
                    ]
                ],
                "LBT": [
                    [
                        {
                            "_tpl": "5d235b4d86f7742e017bc88a",
                            "count": 1
                        }
                    ]
                ],
                "Flir": [
                    [
                        {
                            "_tpl": "5d235b4d86f7742e017bc88a",
                            "count": 30
                        }
                    ]
                ],
                "6sh": [
                    [
                        {
                            "_tpl": "5d235b4d86f7742e017bc88a",
                            "count": 1
                        },
                        {
                            "_tpl": "5f5e46b96bdad616ad46d613",
                            "count": 1
                        }
                    ]
                ],
                "Twhite": [
                    [
                        {
                            "_tpl": "5d235b4d86f7742e017bc88a",
                            "count": 4
                        }
                    ]
                ],
                "7n40": [
                    [
                        {
                            "_tpl": "5d235b4d86f7742e017bc88a",
                            "count": 3
                        },
                        {
                            "_tpl": "56dff061d2720bb5668b4567",
                            "count": 20
                        }
                    ]
                ],
                "m433": [
                    [
                        {
                            "_tpl": "5d235b4d86f7742e017bc88a",
                            "count": 1
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
                            "_tpl": "5d235b4d86f7742e017bc88a",
                            "count": 15
                        },
                        {
                            "_tpl": "56dff061d2720bb5668b4567",
                            "count": 120
                        }
                    ]
                ],
                "m61": [
                    [
                        {
                            "_tpl": "5d235b4d86f7742e017bc88a",
                            "count": 5
                        },
                        {
                            "_tpl": "58dd3ad986f77403051cba8f",
                            "count": 20
                        }
                    ]
                ],
                "RGO": [
                    [
                        {
                            "_tpl": "5d235b4d86f7742e017bc88a",
                            "count": 1
                        }
                    ]
                ],
                "rsp(r)": [
                    [
                        {
                            "_tpl": "5d235b4d86f7742e017bc88a",
                            "count": 5
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
                "fast_black": [
                    [
                        {
                            "_tpl": "59faff1d86f7746c51718c9c",
                            "count": 5
                        },
                        {
                            "_tpl": "5ac8d6885acfc400180ae7b0",
                            "count": 1
                        }
                    ]
                ]
            },
            "loyal_level_items": {
                "PM": 1,
                "LBT": 3,
                "RGO": 1,
                "6sh": 1,
                "Flir": 2,
                "Twhite": 2,
                "7n40": 2,
                "m433": 2,
                "m61": 3,
                "Igla": 3,
                "rsp(r)": 3,
                "thicc_item": 4,
                "fast_black": 4
            }
        };
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
    addSingleItemToAssort(assortTable, itemTpl, unlimitedCount, stackCount, loyaltyLevel, currencyType, currencyValue) {
        // Define item in the table
        const newItem = {
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
    addCollectionToAssort(jsonUtil, assortTable, items, unlimitedCount, stackCount, loyaltyLevel, currencyType, currencyValue) {
        // Deserialize and serialize to ensure we dont alter the original data
        const collectionToAdd = jsonUtil.deserialize(jsonUtil.serialize(items));
        // Update item base with values needed to make item sellable by trader
        collectionToAdd[0].upd = {
            UnlimitedCount: unlimitedCount,
            StackObjectsCount: stackCount
        };
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
    addTraderToLocales(tables, fullName, firstName, nickName, location, description) {
        // For each language, add locale for the new trader
        const locales = Object.values(tables.locales.global);
        for (const locale of locales) {
            locale[`${baseJson._id} FullName`] = fullName;
            locale[`${baseJson._id} FirstName`] = firstName;
            locale[`${baseJson._id} Nickname`] = nickName;
            locale[`${baseJson._id} Location`] = location;
            locale[`${baseJson._id} Description`] = description;
        }
    }
    addItemToLocales(tables, itemTpl, name, shortName, Description) {
        // For each language, add locale for the new trader
        const locales = Object.values(tables.locales.global);
        for (const locale of locales) {
            locale[`${itemTpl} Name`] = name;
            locale[`${itemTpl} ShortName`] = shortName;
            locale[`${itemTpl} Description`] = Description;
        }
    }
}
module.exports = { mod: new Punisher() };
//# sourceMappingURL=mod.js.map