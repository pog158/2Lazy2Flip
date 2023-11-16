const {default: axios} = require("axios")
const config = require("./config.json")
const discord = require('discord.js')
const {Worker} = require("worker_threads")
const {asyncInterval} = require("./src/utils/asyncUtils")
const {initServer, servUtils} = require('./src/server/server')
const {strRemoveColorCodes} = require("./src/utils/removeColorCodes");
let webhook
let threadsToUse = config.nec["threadsToUse/speed"]
let itemDatas = {}
let lastUpdated = 0
let doneWorkers = 0
let startingTime
let matches
let maxPrice = 0
const workers = []
const currencyFormat = new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'})
const webhookRegex = /https:\/\/discord.com\/api\/webhooks\/(.+)\/(.+)/

const cachedBzData = {
    "RECOMBOBULATOR_3000": 0,
    "HOT_POTATO_BOOK": 0,
    "FUMING_POTATO_BOOK": 0
}

async function initialize() {
    if (config.webhook.useWebhook) {
        matches = config.webhook.discordWebhookUrl.match(webhookRegex)
        if (!matches) return console.log(`[Main thread] Couldn't parse Webhook URL`)
        webhook = new discord.WebhookClient(matches[1], matches[2]);
    }

    await initServer()
    await getBzData()
    await getMoulberry()
    await getLBINs()

    // create the worker threads
    for (let j = 0; j < threadsToUse; j++) {
        workers[j] = new Worker("./necWorker.js", {
            workerData: {
                itemDatas: itemDatas,
                bazaarData: cachedBzData,
                workerNumber: j,
                maxPrice: maxPrice
            }
        })

        workers[j].on("message", async (result) => {
            if (result.itemData !== undefined) {
                servUtils.newFlip(result)
                if (config.webhook.useWebhook) {
                    await webhook.send({
                        username: config.webhook.webhookName,
                        avatarURL: config.webhook.webhookPFP,
                        embeds: [new discord.MessageEmbed()
                            .setTitle(`I found a flip!`)
                            .setDescription(`${strRemoveColorCodes(result.itemData.name)} was found for ${currencyFormat.format(result.auctionData.price)}`)
                            .setColor("#f65575")
                            .setThumbnail(`https://sky.shiiyu.moe/item/${result.itemData.id}`)
                            .addFields([
                                {name: "Auction", value: `/viewauction ${result.auctionData.auctionID}`, inline: true},
                                {
                                    name: "Item LBIN",
                                    value: `${currencyFormat.format(result.auctionData.lbin)}`,
                                    inline: true
                                },
                                {
                                    name: "Expected profit",
                                    value: `${currencyFormat.format(result.auctionData.profit)}`,
                                    inline: true
                                },
                                {name: "Sales/Day", value: `${result.auctionData.sales}`, inline: true},
                                {name: "% Profit", value: `${result.auctionData.percentProfit}`, inline: true},
                                {name: "Type", value: `${result.auctionData.ahType}`, inline: true}
                            ])
                            .setTimestamp()]
                    });
                }
            } else if (result === "finished") {
                doneWorkers++
                if (doneWorkers === threadsToUse) {
                    doneWorkers = 0
                    console.log(`[Main thread]: All done ${(Date.now() - startingTime) / 1000} seconds`)
                    startingTime = 0
                    workers[0].emit("done")
                }
            }
        });
    }

    // refresh LBINS every 60s
    asyncInterval(async () => {
        await getLBINs()
        workers.forEach((worker) => {
            worker.postMessage({type: "moulberry", data: itemDatas})
        })
    }, "lbin", 60000)

    // avgs every 10 mins
    asyncInterval(async () => {
        await getMoulberry()
        workers.forEach((worker) => {
            worker.postMessage({type: "moulberry", data: itemDatas})
        })
    }, "avg", 60e5)


    asyncInterval(async () => {
        return new Promise(async (resolve) => {
            const ahFirstPage = await axios.get("https://api.hypixel.net/skyblock/auctions?page=0")
            const totalPages = ahFirstPage.data.totalPages
            if (ahFirstPage.data.lastUpdated === lastUpdated) {
                resolve()
            } else {
                lastUpdated = ahFirstPage.data.lastUpdated
                startingTime = Date.now()
                console.log("Requested for new flips...")
                workers.forEach((worker) => {
                    worker.postMessage({type: "pageCount", data: totalPages})
                })
                workers[0].once("done", () => {
                    resolve()
                })
            }
        })
    }, "check", 0)
}

async function getLBINs() {
    const lbins = await axios.get("https://moulberry.codes/lowestbin.json")
    const lbinData = lbins.data
    for (const item of Object.keys(lbinData)) {
        if (!itemDatas[item]) itemDatas[item] = {}
        itemDatas[item].lbin = lbinData[item]
    }
}

async function getMoulberry() {
    const moulberryAvgs = await axios.get("https://moulberry.codes/auction_averages/3day.json")
    const avgData = moulberryAvgs.data
    for (const item of Object.keys(avgData)) {
        itemDatas[item] = {}
        const itemInfo = avgData[item]
        if (itemInfo.sales !== undefined) {
            itemDatas[item].sales = itemInfo.sales
        } else {
            itemDatas[item].sales = 0
        }
        if (itemInfo.clean_price) {
            itemDatas[item].cleanPrice = itemInfo.clean_price
        } else {
            itemDatas[item].cleanPrice = itemInfo.price
        }
    }
}

async function getBzData() {
    const bzData = await axios.get("https://api.hypixel.net/skyblock/bazaar")
    cachedBzData["RECOMBOBULATOR_3000"] = bzData.data.products.RECOMBOBULATOR_3000.quick_status.buyPrice
    cachedBzData["HOT_POTATO_BOOK"] = bzData.data.products.HOT_POTATO_BOOK.quick_status.buyPrice
    cachedBzData["FUMING_POTATO_BOOK"] = bzData.data.products.FUMING_POTATO_BOOK.quick_status.buyPrice
}


initialize()
