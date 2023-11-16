import requests
from threading import Thread
from time import sleep
import re

threads_to_use = 4
item_datas = {}
done_workers = 0
matches = None
workers = []
currency_format = "{:,.2f}"

webhook_regex = re.compile(r'https://discord.com/api/webhooks/(.+)/(.+)')

class Item:
    def __init__(self, name, auction_id, price, rarity, enchants, hpbs, fpbs, recomb, artofwar, stars, gemstones, item_id, category, lbin, sales, lore):
        self.item_data = {
            "name": name,
            "id": item_id,
            "stars": stars,
            "rarity": rarity,
            "recomb": recomb,
            "enchants": enchants,
            "hpbs": hpbs,
            "fpbs": fpbs,
            "gemstones": gemstones,
            "aow": artofwar,
            "lore": lore
        }
        self.auction_data = {
            "auction_id": auction_id,
            "category": category,
            "sales": sales,
            "price": price,
            "lbin": lbin
        }

def fetch_auction_data(item_id):
    # Replace this with actual Hypixel API request logic
    # Example URL: https://api.hypixel.net/skyblock/auctions
    url = f"https://api.hypixel.net/skyblock/auction

    try:
        response = requests.get(url)
        data = response.json()

        # Extract relevant item data from the response
        auctions = data.get("auctions", [])
        if auctions:
            # Assuming the first auction has the necessary data
            auction_data = auctions[0]
            return {
                "name": auction_data.get("item_name", "Unknown"),
                "auction_id": auction_data.get("uuid", ""),
                "price": auction_data.get("starting_bid", 0),
                "rarity": "EPIC",  # Replace with actual rarity data
                # Add other relevant data
            }
    except Exception as e:
        print(f"Error fetching auction data for item {item_id}: {e}")

def initialize():
    global matches

    # Add other initialization steps

    # Create worker threads
    for j in range(threads_to_use):
        workers.append(Thread(target=nec_worker, args=(j,)))

    for worker in workers:
        worker.start()

def async_interval(func, name, interval):
    def wrapper():
        while True:
            func()
            sleep(interval)

    thread = Thread(target=wrapper, name=name)
    thread.start()

def get_lb_ins():
    try:
        response = requests.get("https://moulberry.codes/lowestbin.json")
        lbins_data = response.json()

        for item, lbin_value in lbins_data.items():
            if item not in item_datas:
                item_datas[item] = {}
            item_datas[item]["lbin"] = lbin_value
    except Exception as e:
        print(f"Error fetching LBINs: {e}")

def nec_worker(worker_number):
    # Replace "example_item" with the actual item ID you want to monitor
    item_id = "example_item"

    while True:
        auction_data = fetch_auction_data(item_id)
        if auction_data:
            item_instance = Item(**auction_data)
            check_and_notify(item_instance)

def check_and_notify(item):
    # Place your flip analysis logic here
    # Example: check for profit, percent profit, etc.
    calculate_profit(item)

def calculate_profit(item):
    # This is a simplified profit calculation example, adjust based on your needs
    cost = item.auction_data["price"]
    lbin = item.auction_data["lbin"]
    profit = (lbin - cost) - (lbin * 0.02)  # Adjust the profit calculation based on your needs
    percent_profit = (profit * 100) / lbin

    if percent_profit > 5:  # Example condition, adjust as needed
        print_notification(item, profit, percent_profit)

def print_notification(item, profit, percent_profit):
    print(f"Profitable Item Found!\n"
          f"Item Name: {item.item_data['name']}\n"
          f"Item ID: {item.item_data['id']}\n"
          f"Profit: {currency_format.format(profit)}\n"
          f"Percent Profit: {percent_profit:.2f}%\n")

def main():
    initialize()

if __name__ == "__main__":
    main()
